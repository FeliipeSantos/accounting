"""Data access of the Calendário module (tables reforma_*).

Functions do not commit unless stated: the sync groups its writes per source.
"""

import hashlib
import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from app.core.database import utc_now_iso
from app.extensions import db
from app.modules.intelligence.text import normalize_for_match, parse_iso_datetime
from app.modules.reforma import recurring
from app.modules.reforma.events import date_reason, importance_reason
from app.modules.reforma.subjects import subjects_of

# uma sincronização "em andamento" mais antiga que isso é considerada interrompida
RUNNING_STALE = timedelta(minutes=45)
MAX_RUNS_KEPT = 200


def _rows(sql: str, **params) -> list[dict]:
    return [dict(row) for row in db.session.execute(text(sql), params).mappings()]


def _row(sql: str, **params) -> dict | None:
    rows = _rows(sql, **params)
    return rows[0] if rows else None


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def document_id(source_id: str, external_id: str) -> str:
    return f"doc-{_sha(f'{source_id}:{external_id}')[:16]}"


def content_hash(item: dict) -> str:
    """Identity of a version: what the source shows of it (not text read later)."""
    identity = {
        "title": item["title"],
        "summary": item.get("summary") or "",
        "versionLabel": item.get("versionLabel"),
        "fileUrl": item.get("fileUrl"),
        "contentText": item.get("contentText"),
        "publishedAt": item.get("publishedAt"),
    }
    return _sha(json.dumps(identity, ensure_ascii=False, sort_keys=True))


# ---------------------------------------------------------------------------
# Documents and versions
# ---------------------------------------------------------------------------


def known_external_ids(source_id: str) -> set[str]:
    return {r["external_id"] for r in _rows("SELECT external_id FROM reforma_documents WHERE source_id = :s", s=source_id)}


def upsert_document(source_id: str, item: dict, run_id: str | None, now: str | None = None) -> str:
    """Stores one collected item. Returns "new" (new document), "version" (new version of a
    known document) or "same" (nothing changed). No commit."""
    now = now or utc_now_iso()
    doc_id = document_id(source_id, item["externalId"])
    item_hash = content_hash(item)
    existing = _row("SELECT id, current_version_id FROM reforma_documents WHERE id = :id", id=doc_id)
    version = _row("SELECT id FROM reforma_document_versions WHERE document_id = :d AND content_hash = :h", d=doc_id, h=item_hash)
    search = normalize_for_match(f"{item['title']} {item.get('summary') or ''}")

    if existing and version:
        # já conhecido e sem mudança: só registra a verificação (e a situação dada pela fonte)
        db.session.execute(
            text("UPDATE reforma_documents SET last_checked_at = :now, source_status = :status WHERE id = :id"),
            {"now": now, "status": item.get("sourceStatus"), "id": doc_id},
        )
        return "same"

    version_id = f"ver-{_sha(f'{doc_id}:{item_hash}')[:16]}"
    fields = {
        "id": doc_id,
        "source": source_id,
        "external": item["externalId"],
        "kind": item["kind"],
        "title": item["title"],
        "url": item["url"],
        "published": item.get("publishedAt"),
        "status": item.get("sourceStatus"),
        "version": version_id,
        "now": now,
        "search": search,
    }
    # o documento antes da versão (chave estrangeira); sem versão nova, nada é gravado aqui
    if existing:
        db.session.execute(
            text(
                "UPDATE reforma_documents SET kind = :kind, title = :title, url = :url, "
                "published_at = COALESCE(:published, published_at), source_status = :status, current_version_id = :version, "
                "version_count = version_count + 1, updated_at = :now, last_checked_at = :now, search_text = :search WHERE id = :id"
            ),
            fields,
        )
    else:
        db.session.execute(
            text(
                "INSERT INTO reforma_documents (id, source_id, external_id, kind, title, url, published_at, source_status, "
                "current_version_id, version_count, first_seen_at, updated_at, last_checked_at, search_text) VALUES (:id, :source, "
                ":external, :kind, :title, :url, :published, :status, :version, 1, :now, :now, :now, :search)"
            ),
            fields,
        )
    has_file = bool(item.get("fileUrl"))
    db.session.execute(
        text(
            "INSERT INTO reforma_document_versions (id, document_id, version_label, content_hash, title, summary, published_at, "
            "full_text, file_url, file_status, analysis_status, detected_at, run_id) VALUES (:id, :doc, :label, :hash, :title, "
            ":summary, :published, :full_text, :file_url, :file_status, 'pending', :now, :run)"
        ),
        {
            "id": version_id,
            "doc": doc_id,
            "label": item.get("versionLabel"),
            "hash": item_hash,
            "title": item["title"],
            "summary": item.get("summary") or "",
            "published": item.get("publishedAt"),
            "full_text": item.get("contentText") or item.get("fullText"),
            "file_url": item.get("fileUrl"),
            "file_status": "pending" if has_file else "none",
            "now": now,
            "run": run_id,
        },
    )
    return "version" if existing else "new"


def versions_needing_file(limit: int) -> list[dict]:
    return _rows(
        "SELECT v.id, v.document_id, v.file_url, v.published_at, d.published_at AS doc_published FROM reforma_document_versions v "
        "JOIN reforma_documents d ON d.id = v.document_id WHERE v.file_status IN ('pending', 'error') "
        "ORDER BY COALESCE(v.published_at, d.published_at, '') DESC, v.detected_at DESC LIMIT :limit",
        limit=limit,
    )


def skip_files_before(since: str) -> None:
    """Marks as skipped the pending files of documents published before `since` (no commit)."""
    db.session.execute(
        text(
            "UPDATE reforma_document_versions SET file_status = 'skipped', file_error = :reason WHERE file_status = 'pending' "
            "AND COALESCE(published_at, (SELECT d.published_at FROM reforma_documents d WHERE d.id = document_id)) < :since"
        ),
        {"since": since, "reason": f"Publicado antes de {since[8:10]}/{since[5:7]}/{since[:4]}: não baixado"},
    )


def save_file_result(version_id: str, status: str, path: str | None, sha256: str | None, full_text: str | None, error: str | None) -> None:
    db.session.execute(
        text(
            "UPDATE reforma_document_versions SET file_status = :status, file_path = :path, file_sha256 = :sha, "
            "full_text = COALESCE(:text, full_text), file_error = :error WHERE id = :id"
        ),
        {"status": status, "path": path, "sha": sha256, "text": full_text, "error": error, "id": version_id},
    )


def versions_needing_text(source_ids: set[str], limit: int) -> list[dict]:
    """Current versions without full text, of sources whose text is read from the item page."""
    names = {f"s{i}": source for i, source in enumerate(sorted(source_ids))}
    return _rows(
        "SELECT v.id, v.document_id, d.source_id, d.external_id, d.url FROM reforma_document_versions v "
        "JOIN reforma_documents d ON d.current_version_id = v.id "
        f"WHERE v.full_text IS NULL AND v.file_url IS NULL AND d.source_id IN ({', '.join(':' + n for n in names)}) "
        "ORDER BY v.detected_at DESC LIMIT :limit",
        limit=limit,
        **names,
    )


def save_page_text(version_id: str, document_id_: str, full_text: str | None, published_at: str | None) -> None:
    # texto novo: as datas do calendário são extraídas de novo
    db.session.execute(
        text("UPDATE reforma_document_versions SET full_text = :t, events_status = 'pending' WHERE id = :id"),
        {"t": full_text, "id": version_id},
    )
    if published_at:
        db.session.execute(
            text("UPDATE reforma_document_versions SET published_at = COALESCE(published_at, :p) WHERE id = :id"),
            {"p": published_at, "id": version_id},
        )
        db.session.execute(
            text("UPDATE reforma_documents SET published_at = COALESCE(published_at, :p) WHERE id = :id"),
            {"p": published_at, "id": document_id_},
        )


# ---------------------------------------------------------------------------
# Sync runs
# ---------------------------------------------------------------------------


def _row_to_run(r: dict) -> dict:
    return {
        "id": r["id"],
        "trigger": r["trigger"],
        "requestedBy": r["requested_by"],
        "startedAt": r["started_at"],
        "finishedAt": r["finished_at"],
        "status": r["status"],
        "newDocuments": r["new_documents"],
        "newVersions": r["new_versions"],
        "filesDownloaded": r["files_downloaded"],
        "error": r["error"],
    }


def _row_to_source_result(r: dict) -> dict:
    return {
        "sourceId": r["source_id"],
        "checkedAt": r["checked_at"],
        "status": r["status"],
        "fetched": r["fetched"],
        "newDocuments": r["new_documents"],
        "newVersions": r["new_versions"],
        "error": r["error"],
        "durationMs": r["duration_ms"],
    }


def has_active_run(now: datetime | None = None) -> bool:
    limit = ((now or datetime.now(UTC)) - RUNNING_STALE).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    return _row("SELECT 1 AS x FROM reforma_sync_runs WHERE status = 'running' AND started_at >= :l", l=limit) is not None


def start_run(run_id: str, trigger: str, requested_by: str | None, started_at: str) -> bool:
    """Registers a run; False (nothing written) when another one is in progress. Commits."""
    if has_active_run():
        return False
    # execuções "em andamento" antigas foram interrompidas (processo encerrado)
    db.session.execute(
        text(
            "UPDATE reforma_sync_runs SET status = 'failed', finished_at = :now, error = 'Execução interrompida' WHERE status = 'running'"
        ),
        {"now": started_at},
    )
    db.session.execute(
        text("INSERT INTO reforma_sync_runs (id, trigger, requested_by, started_at, status) VALUES (:id, :t, :u, :s, 'running')"),
        {"id": run_id, "t": trigger, "u": requested_by, "s": started_at},
    )
    db.session.commit()
    return True


def record_source_result(run_id: str, result: dict) -> None:
    db.session.execute(
        text(
            "INSERT INTO reforma_sync_sources (run_id, source_id, checked_at, status, fetched, new_documents, new_versions, error, "
            "duration_ms) VALUES (:run, :source, :at, :status, :fetched, :new, :versions, :error, :ms)"
        ),
        {
            "run": run_id,
            "source": result["sourceId"],
            "at": result["checkedAt"],
            "status": result["status"],
            "fetched": result["fetched"],
            "new": result["newDocuments"],
            "versions": result["newVersions"],
            "error": result["error"],
            "ms": result["durationMs"],
        },
    )


def finish_run(run_id: str, status: str, new_documents: int, new_versions: int, files: int, error: str | None = None) -> None:
    """Closes the run and prunes old ones. Commits."""
    db.session.execute(
        text(
            "UPDATE reforma_sync_runs SET status = :status, finished_at = :now, new_documents = :d, new_versions = :v, "
            "files_downloaded = :f, error = :e WHERE id = :id"
        ),
        {"status": status, "now": utc_now_iso(), "d": new_documents, "v": new_versions, "f": files, "e": error, "id": run_id},
    )
    db.session.execute(
        text("DELETE FROM reforma_sync_runs WHERE id NOT IN (SELECT id FROM reforma_sync_runs ORDER BY started_at DESC LIMIT :keep)"),
        {"keep": MAX_RUNS_KEPT},
    )
    db.session.commit()


def get_run(run_id: str) -> dict | None:
    row = _row("SELECT * FROM reforma_sync_runs WHERE id = :id", id=run_id)
    if row is None:
        return None
    run = _row_to_run(row)
    run["sources"] = [
        _row_to_source_result(r) for r in _rows("SELECT * FROM reforma_sync_sources WHERE run_id = :id ORDER BY source_id", id=run_id)
    ]
    return run


def list_runs(limit: int = 30) -> list[dict]:
    return [_row_to_run(r) for r in _rows("SELECT * FROM reforma_sync_runs ORDER BY started_at DESC LIMIT :l", l=limit)]


def last_run() -> dict | None:
    row = _row("SELECT id FROM reforma_sync_runs WHERE status != 'running' ORDER BY started_at DESC LIMIT 1")
    return get_run(row["id"]) if row else None


def last_manual_run_end() -> datetime | None:
    row = _row("SELECT MAX(finished_at) AS at FROM reforma_sync_runs WHERE trigger = 'manual' AND finished_at IS NOT NULL")
    return parse_iso_datetime(row["at"]) if row and row["at"] else None


def last_source_results() -> dict[str, dict]:
    """Latest result and latest success of each source."""
    latest = _rows(
        "SELECT s.* FROM reforma_sync_sources s JOIN (SELECT source_id, MAX(checked_at) AS at FROM reforma_sync_sources "
        "GROUP BY source_id) m ON m.source_id = s.source_id AND m.at = s.checked_at"
    )
    success = {
        r["source_id"]: r["at"]
        for r in _rows("SELECT source_id, MAX(checked_at) AS at FROM reforma_sync_sources WHERE status = 'success' GROUP BY source_id")
    }
    return {r["source_id"]: {**_row_to_source_result(r), "lastSuccessAt": success.get(r["source_id"])} for r in latest}


def schedule_data(now: datetime | None = None) -> dict:
    """Runs of the last two days in the shape the shared scheduler expects."""
    since = ((now or datetime.now(UTC)) - timedelta(days=2)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    runs = [_row_to_run(r) for r in _rows("SELECT * FROM reforma_sync_runs WHERE started_at >= :s ORDER BY started_at", s=since)]
    return {"runs": runs}


# ---------------------------------------------------------------------------
# Queries for the screen
# ---------------------------------------------------------------------------


def _row_to_document(r: dict) -> dict:
    return {
        "id": r["id"],
        "sourceId": r["source_id"],
        "externalId": r["external_id"],
        "kind": r["kind"],
        "title": r["title"],
        "url": r["url"],
        "publishedAt": r["published_at"],
        "sourceStatus": r["source_status"],
        "versionCount": r["version_count"],
        "firstSeenAt": r["first_seen_at"],
        "updatedAt": r["updated_at"],
        "lastCheckedAt": r["last_checked_at"],
        "currentVersion": {
            "id": r["current_version_id"],
            "label": r.get("v_label"),
            "summary": r.get("v_summary") or "",
            "fileStatus": r.get("v_file_status"),
            "analysisStatus": r.get("v_analysis_status"),
            "hasText": bool(r.get("v_has_text")),
        },
    }


_DOCUMENT_SELECT = (
    "SELECT d.*, v.version_label AS v_label, v.summary AS v_summary, v.file_status AS v_file_status, "
    "v.analysis_status AS v_analysis_status, (v.full_text IS NOT NULL AND v.full_text != '') AS v_has_text "
    "FROM reforma_documents d LEFT JOIN reforma_document_versions v ON v.id = d.current_version_id"
)


def list_documents(filters: dict, limit: int, offset: int) -> dict:
    where, params = [], {}
    if filters.get("source"):
        where.append("d.source_id = :source")
        params["source"] = filters["source"]
    if filters.get("kind"):
        where.append("d.kind = :kind")
        params["kind"] = filters["kind"]
    if filters.get("q"):
        for i, term in enumerate(normalize_for_match(filters["q"]).split()[:6]):
            where.append(f"d.search_text LIKE :q{i}")
            params[f"q{i}"] = f"%{term}%"
    if filters.get("changed") == "versions":
        where.append("d.version_count > 1")
    clause = f" WHERE {' AND '.join(where)}" if where else ""
    total = _row(f"SELECT COUNT(*) AS n FROM reforma_documents d{clause}", **params)["n"]
    rows = _rows(
        f"{_DOCUMENT_SELECT}{clause} ORDER BY d.updated_at DESC, COALESCE(d.published_at, '') DESC LIMIT :limit OFFSET :offset",
        limit=limit,
        offset=offset,
        **params,
    )
    return {"total": total, "items": [_row_to_document(r) for r in rows]}


def get_document(doc_id: str) -> dict | None:
    row = _row(f"{_DOCUMENT_SELECT} WHERE d.id = :id", id=doc_id)
    if row is None:
        return None
    document = _row_to_document(row)
    document["versions"] = [
        {
            "id": v["id"],
            "label": v["version_label"],
            "title": v["title"],
            "summary": v["summary"],
            "publishedAt": v["published_at"],
            "detectedAt": v["detected_at"],
            "fileUrl": v["file_url"],
            "fileStatus": v["file_status"],
            "fileError": v["file_error"],
            "analysisStatus": v["analysis_status"],
            "textLength": v["text_length"] or 0,
        }
        for v in _rows(
            "SELECT id, version_label, title, summary, published_at, detected_at, file_url, file_status, file_error, analysis_status, "
            "LENGTH(full_text) AS text_length FROM reforma_document_versions WHERE document_id = :id ORDER BY detected_at DESC",
            id=doc_id,
        )
    ]
    return document


def get_version_text(doc_id: str, version_id: str) -> str | None:
    row = _row("SELECT full_text FROM reforma_document_versions WHERE id = :v AND document_id = :d", v=version_id, d=doc_id)
    return row["full_text"] if row else None


def totals(month_start: str) -> dict:
    row = _row(
        "SELECT (SELECT COUNT(*) FROM reforma_documents) AS documents, "
        "(SELECT COUNT(*) FROM reforma_document_versions) AS versions, "
        "(SELECT COUNT(*) FROM reforma_documents WHERE first_seen_at >= :m) AS new_this_month, "
        "(SELECT COUNT(*) FROM reforma_document_versions v JOIN reforma_documents d ON d.id = v.document_id "
        " WHERE v.detected_at >= :m AND v.detected_at > d.first_seen_at) AS changed_this_month, "
        "(SELECT COUNT(*) FROM reforma_document_versions WHERE analysis_status = 'pending') AS pending_analysis, "
        "(SELECT COUNT(*) FROM reforma_document_versions WHERE file_status IN ('pending', 'error')) AS pending_files",
        m=month_start,
    )
    return {
        "documents": row["documents"],
        "versions": row["versions"],
        "newThisMonth": row["new_this_month"],
        "changedThisMonth": row["changed_this_month"],
        "pendingAnalysis": row["pending_analysis"],
        "pendingFiles": row["pending_files"],
    }


def count_by_source() -> dict[str, int]:
    return {r["source_id"]: r["n"] for r in _rows("SELECT source_id, COUNT(*) AS n FROM reforma_documents GROUP BY source_id")}


# ---------------------------------------------------------------------------
# Calendar events
# ---------------------------------------------------------------------------

_EVENT_FIELDS = ("kind", "event_date", "title", "quote", "date_status", "date_note", "legal_status", "importance")


def versions_needing_events(limit: int) -> list[dict]:
    """Current versions whose dates were not extracted yet and whose text is settled
    (text read, or no file still to download)."""
    return _rows(
        "SELECT v.id, v.document_id, v.full_text, COALESCE(v.published_at, d.published_at) AS published_at, d.kind, d.title, "
        "v.summary "
        "FROM reforma_document_versions v JOIN reforma_documents d ON d.current_version_id = v.id "
        "WHERE v.events_status = 'pending' AND v.file_status != 'pending' "
        "ORDER BY v.detected_at DESC LIMIT :limit",
        limit=limit,
    )


def _event_row(r: dict) -> dict:
    return {key: r[key] for key in _EVENT_FIELDS}


def replace_document_events(document_id: str, version_id: str, extracted: list[dict], now: str) -> dict:
    """Applies the events extracted from a document's current version: creates the new ones,
    updates those that changed, supersedes those that disappeared. Every change goes to the
    history. Marks the version as processed. No commit. Returns counts."""
    current = {r["event_key"]: r for r in _rows("SELECT * FROM reforma_events WHERE document_id = :d AND origin = 'regra'", d=document_id)}
    counts = {"created": 0, "updated": 0, "superseded": 0}
    for event in extracted:
        values = {
            "kind": event["kind"],
            "event_date": event["date"],
            "title": event["title"],
            "quote": event["quote"],
            "date_status": event["dateStatus"],
            "date_note": event["dateNote"],
            "legal_status": event["legalStatus"],
            "importance": event["importance"],
        }
        existing = current.pop(event["eventKey"], None)
        if existing is None:
            event_id = f"evt-{event['eventKey'][:16]}"
            db.session.execute(
                text(
                    "INSERT INTO reforma_events (id, document_id, version_id, event_key, kind, event_date, title, description, quote, "
                    "date_status, date_note, legal_status, importance, origin, status, created_at, updated_at) VALUES (:id, :doc, :ver, "
                    ":key, :kind, :event_date, :title, '', :quote, :date_status, :date_note, :legal_status, :importance, 'regra', "
                    "'ativo', :now, :now)"
                ),
                {"id": event_id, "doc": document_id, "ver": version_id, "key": event["eventKey"], "now": now, **values},
            )
            _history(event_id, now, "criado", version_id, None)
            counts["created"] += 1
        elif existing["status"] != "ativo" or any(existing[k] != values[k] for k in _EVENT_FIELDS):
            db.session.execute(
                text(
                    "UPDATE reforma_events SET version_id = :ver, kind = :kind, event_date = :event_date, title = :title, "
                    "quote = :quote, date_status = :date_status, date_note = :date_note, legal_status = :legal_status, "
                    "importance = :importance, status = 'ativo', updated_at = :now WHERE id = :id"
                ),
                {"id": existing["id"], "ver": version_id, "now": now, **values},
            )
            _history(existing["id"], now, "atualizado", version_id, {**_event_row(existing), "status": existing["status"]})
            counts["updated"] += 1
    for gone in current.values():
        if gone["status"] == "ativo":
            db.session.execute(
                text("UPDATE reforma_events SET status = 'substituido', updated_at = :now WHERE id = :id"),
                {"id": gone["id"], "now": now},
            )
            _history(gone["id"], now, "substituido", version_id, _event_row(gone))
            counts["superseded"] += 1
    db.session.execute(text("UPDATE reforma_document_versions SET events_status = 'done' WHERE id = :id"), {"id": version_id})
    return counts


def _history(event_id: str, now: str, change: str, version_id: str | None, before: dict | None) -> None:
    db.session.execute(
        text(
            "INSERT INTO reforma_event_history (event_id, changed_at, change, version_id, before) VALUES (:e, :now, :change, :v, :before)"
        ),
        {
            "e": event_id,
            "now": now,
            "change": change,
            "v": version_id,
            "before": json.dumps(before, ensure_ascii=False) if before else None,
        },
    )


def clear_page_texts(source_ids: set[str]) -> int:
    """Forgets the text read from the item pages of these sources, to read them again. No commit."""
    names = {f"s{i}": source for i, source in enumerate(sorted(source_ids))}
    return db.session.execute(
        text(
            "UPDATE reforma_document_versions SET full_text = NULL WHERE file_url IS NULL AND id IN "
            f"(SELECT current_version_id FROM reforma_documents WHERE source_id IN ({', '.join(':' + n for n in names)}))"
        ),
        names,
    ).rowcount


def reset_event_extraction() -> int:
    """Marks every current version for a new extraction (after the rules change). No commit."""
    return db.session.execute(
        text(
            "UPDATE reforma_document_versions SET events_status = 'pending' WHERE id IN (SELECT current_version_id FROM reforma_documents)"
        )
    ).rowcount


def _row_to_event(r: dict) -> dict:
    return {
        "id": r["id"],
        "documentId": r["document_id"],
        "versionId": r["version_id"],
        "kind": r["kind"],
        "date": r["event_date"],
        "title": r["title"],
        "quote": r["quote"],
        "dateStatus": r["date_status"],
        "dateNote": r["date_note"],
        "legalStatus": r["legal_status"],
        "importance": r["importance"],
        "importanceReason": importance_reason(r["importance"], r["kind"], r["date_status"], {"kind": r["doc_kind"]}),
        "dateReason": date_reason(r["date_status"], {"kind": r["doc_kind"]}, r["legal_status"] or ""),
        "origin": r["origin"],
        "status": r["status"],
        "createdAt": r["created_at"],
        "updatedAt": r["updated_at"],
        "document": {
            "title": r["doc_title"],
            "kind": r["doc_kind"],
            "sourceId": r["doc_source"],
            "url": r["doc_url"],
            "versionLabel": r.get("version_label"),
            # a ementa do ato ("Altera o Protocolo ICMS 41/08..."): diz o que muda
            "summary": _ementa(r.get("version_summary")),
        },
    }


def _ementa(summary: str | None) -> str | None:
    """The act's own summary; the note of an act found through a citation is not one."""
    if not summary or summary.startswith("Ato oficial citado"):
        return None
    return summary


_EVENT_SELECT = (
    "SELECT e.*, d.title AS doc_title, d.kind AS doc_kind, d.source_id AS doc_source, d.url AS doc_url, v.version_label, "
    "v.summary AS version_summary, d.external_id AS doc_external, substr(v.full_text, 1, 800) AS text_head, "
    "substr(coalesce(v.published_at, d.published_at, d.first_seen_at), 1, 10) AS published_day "
    "FROM reforma_events e JOIN reforma_documents d ON d.id = e.document_id "
    "LEFT JOIN reforma_document_versions v ON v.id = e.version_id"
)
_IMPORTANCE_ORDER = "CASE e.importance WHEN 'critico' THEN 0 WHEN 'alto' THEN 1 WHEN 'medio' THEN 2 ELSE 3 END"


_PUBLISHED_DAY = "substr(coalesce(v.published_at, d.published_at, d.first_seen_at), 1, 10)"


def list_events(date_from: str, date_to: str, filters: dict) -> list[dict]:
    """Active events dated in the period, or (filters["byPublication"]) the events of the acts
    published in the period, whatever their date: the changes of the week."""
    by_publication = bool(filters.get("byPublication"))
    period = _PUBLISHED_DAY if by_publication else "e.event_date"
    where = [f"{period} >= :f", f"{period} <= :t", "e.status = 'ativo'"]
    params: dict = {"f": date_from, "t": date_to}
    if filters.get("kind"):
        where.append("e.kind = :kind")
        params["kind"] = filters["kind"]
    if filters.get("importance"):
        names = {f"i{i}": value for i, value in enumerate(filters["importance"])}
        where.append(f"e.importance IN ({', '.join(':' + n for n in names)})")
        params.update(names)
    if filters.get("hidePublications"):
        where.append("e.kind != 'publicacao'")
    if filters.get("officialOnly"):
        where.append("e.date_status = 'confirmada'")
    rows = _rows(
        f"{_EVENT_SELECT} WHERE {' AND '.join(where)} ORDER BY e.event_date, {_IMPORTANCE_ORDER}, e.title LIMIT 2000",
        **params,
    )
    events = [
        {**_row_to_event(r), "subjects": subjects, "publishedAt": r["published_day"]}
        for r, subjects in zip(rows, subjects_of(rows), strict=True)
    ]
    if filters.get("subjects"):
        wanted = set(filters["subjects"])
        events = [e for e in events if wanted & set(e["subjects"])]
    stored = merge_duplicates(_without_confirmed_citations(events))
    if by_publication:
        # os recorrentes não são publicados: não entram nas mudanças
        return stored
    # prazos recorrentes: calculados para o período, não guardados
    recurring_events = [e for e in recurring.occurrences(date_from, date_to) if recurring.matches(e, filters)]
    if recurring_events:
        recurring.attach_reviews(recurring_events, recurring_reviews())
    rank = {"critico": 0, "alto": 1, "medio": 2}
    return sorted([*stored, *recurring_events], key=lambda e: (e["date"], rank.get(e["importance"], 3), e["title"]))


def recurring_reviews() -> dict[str, list[dict]]:
    """Acts published after the recurring rules were checked that may change one of them."""
    since = min([recurring.checked_on(r) for r in recurring.RULES], default=None)
    if since is None:
        return {}
    rows = _rows(
        "SELECT d.id, d.title, d.url, substr(coalesce(d.published_at, v.published_at, d.first_seen_at), 1, 10) AS day, "
        "v.summary, substr(v.full_text, 1, 3000) AS head "
        "FROM reforma_documents d LEFT JOIN reforma_document_versions v ON v.id = d.current_version_id "
        "WHERE substr(coalesce(d.published_at, v.published_at, d.first_seen_at), 1, 10) > :since",
        since=since,
    )
    documents = [
        {
            "id": r["id"],
            "title": r["title"],
            "url": r["url"],
            "date": r["day"],
            "text": normalize_for_match(" ".join(part for part in (r["title"], r["summary"], r["head"]) if part)),
        }
        for r in rows
    ]
    return recurring.reviews(documents)


def _cited_act_of(note: str) -> str:
    """The act named in the note of a cited date: "Data do ato citado no comunicado (Resolução
    CGSN nº 191): ..." (or the older "Data do Ato Conjunto ... citada no comunicado")."""
    inside = note.find("(")
    if note.startswith("Data do ato citado") and inside >= 0:
        return note[inside + 1 :]
    return note.removeprefix("Data do ").removeprefix("Data da ")


def _without_confirmed_citations(events: list[dict]) -> list[dict]:
    """Drops the dates a communication only reproduced ("citada") when the cited official act
    is stored: the act's own events, with official dates, take their place."""
    from app.modules.reforma.collectors.cited import act_key

    # também as previsões do mesmo comunicado ("prevista pela Resolução..."), que levam a mesma nota
    cited = [e for e in events if e["dateNote"] and (e["dateStatus"] == "citada" or e["dateNote"].startswith("Data do ato citado"))]
    if not cited:
        return events
    titles = db.session.execute(text("SELECT title FROM reforma_documents WHERE kind IN ('norma', 'resolucao')")).scalars()
    present = {key for key in (act_key(title) for title in titles) if key}
    confirmed = {e["id"] for e in cited if act_key(_cited_act_of(e["dateNote"])) in present}
    return [e for e in events if e["id"] not in confirmed]


# preferência ao juntar duplicatas: a data mais oficial fica como principal
_STATUS_RANK = {"confirmada": 0, "citada": 1, "previsao": 2}


def _duplicate_key(event: dict) -> tuple:
    """Same act (kind + number) with the same kind of date on the same day, or the same
    excerpt on the same day (the same news published by two portals)."""
    from app.modules.intelligence.fulltext import act_key

    act = act_key(event["document"]["title"]) if event["document"]["kind"] in ("norma", "resolucao", "protocolo", "proposta") else None
    if act:
        return ("act", *act, event["kind"], event["date"])
    return ("quote", event["kind"], event["date"], normalize_for_match(event["quote"])[:160])


def merge_duplicates(events: list[dict]) -> list[dict]:
    """One event per duplicate group; the others are listed in `alsoIn` (order is kept)."""
    groups: dict[tuple, list[dict]] = {}
    order: list[tuple] = []
    for event in events:
        key = _duplicate_key(event)
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(event)
    merged = []
    for key in order:
        group = sorted(groups[key], key=lambda e: _STATUS_RANK.get(e["dateStatus"], 3))
        main = {**group[0], "alsoIn": []}
        for other in group[1:]:
            main["alsoIn"].append({"eventId": other["id"], "documentId": other["documentId"], **other["document"]})
        merged.append(main)
    return merged


def get_event(event_id: str) -> dict | None:
    row = _row(f"{_EVENT_SELECT} WHERE e.id = :id", id=event_id)
    if row is None:
        return None
    event = {**_row_to_event(row), "subjects": subjects_of([row])[0]}
    event["history"] = [
        {
            "changedAt": h["changed_at"],
            "change": h["change"],
            "versionId": h["version_id"],
            "before": json.loads(h["before"]) if h["before"] else None,
        }
        for h in _rows("SELECT * FROM reforma_event_history WHERE event_id = :id ORDER BY changed_at DESC, id DESC", id=event_id)
    ]
    return event


def event_totals(today: str) -> dict:
    row = _row(
        "SELECT (SELECT COUNT(*) FROM reforma_events WHERE status = 'ativo') AS total, "
        "(SELECT COUNT(*) FROM reforma_events WHERE status = 'ativo' AND event_date >= :t AND kind != 'publicacao') AS upcoming, "
        "(SELECT COUNT(*) FROM reforma_document_versions WHERE events_status = 'pending') AS pending",
        t=today,
    )
    # os recorrentes contam nos próximos 12 meses (seriam infinitos)
    horizon = (datetime.fromisoformat(today) + timedelta(days=recurring.UPCOMING_DAYS)).date().isoformat()
    upcoming_recurring = len(recurring.occurrences(today, horizon))
    return {
        "total": row["total"],
        "upcoming": row["upcoming"] + upcoming_recurring,
        "recurringUpcoming": upcoming_recurring,
        "pendingExtraction": row["pending"],
    }
