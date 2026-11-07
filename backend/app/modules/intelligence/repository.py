"""Data access of the Inteligência Contábil module (tables intel_*).

JSON columns are written with dumps_js, the same text format already stored. Functions do not commit unless stated: callers group
writes in one transaction.
"""

import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from app.core.database import utc_now_iso
from app.core.jsontext import dumps_js
from app.extensions import db
from app.modules.intelligence.catalog import SUBJECTS, collectable_ids
from app.modules.intelligence.text import normalize_for_match, parse_iso_datetime

REFORM_SUBJECTS = ["reforma-tributaria", "ibs-cbs", "imposto-seletivo"]
MAX_RUNS_KEPT = 200
# Uma execução "em andamento" mais antiga que isso é considerada interrompida
RUNNING_STALE_MS = 15 * 60 * 1000
ORDER_BY = "COALESCE(p.published_at, '') DESC, COALESCE(p.published_time, '') DESC, p.collected_at DESC"


def _rows(sql: str, **params) -> list[dict]:
    return [dict(row) for row in db.session.execute(text(sql), params).mappings()]


def _row(sql: str, **params) -> dict | None:
    rows = _rows(sql, **params)
    return rows[0] if rows else None


def _iso(moment: datetime) -> str:
    return moment.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


def _default_settings() -> dict:
    collectable = collectable_ids()
    return {
        "runTime": "06:00",
        "enabledSources": collectable,
        # fontes já vistas: uma fonte coletável fora desta lista é nova no catálogo e entra ativa
        "knownSources": collectable,
        "enabledSubjects": [s["id"] for s in SUBJECTS],
    }


def get_settings() -> dict:
    """Settings with defaults; sources added to the catalog enabled, removed ones dropped."""
    saved = {r["key"]: json.loads(r["value"]) for r in _rows("SELECT key, value FROM intel_settings")}
    settings = {**_default_settings(), **saved}
    collectable = collectable_ids()
    known = set(saved.get("knownSources") or collectable)
    added = [sid for sid in collectable if sid not in known]
    if added and saved.get("enabledSources"):
        settings["enabledSources"] = list(dict.fromkeys([*saved["enabledSources"], *added]))
    settings["knownSources"] = collectable
    settings["enabledSources"] = [sid for sid in settings["enabledSources"] if sid in collectable]
    return settings


def save_settings(partial: dict) -> dict:
    """Saves the given settings over the current ones (commits) and returns the result."""
    merged = {**get_settings(), **partial}
    for key in ("runTime", "enabledSources", "knownSources", "enabledSubjects"):
        db.session.execute(
            text("INSERT INTO intel_settings (key, value) VALUES (:key, :value) ON CONFLICT (key) DO UPDATE SET value = excluded.value"),
            {"key": key, "value": dumps_js(merged[key])},
        )
    db.session.commit()
    return get_settings()


# ---------------------------------------------------------------------------
# Source status
# ---------------------------------------------------------------------------


def get_source_status() -> dict[str, dict]:
    return {
        r["source_id"]: {"lastSuccessAt": r["last_success_at"], "lastError": r["last_error"], "lastErrorAt": r["last_error_at"]}
        for r in _rows("SELECT source_id, last_success_at, last_error, last_error_at FROM intel_source_status")
    }


def record_source_success(source_id: str, at: str) -> None:
    db.session.execute(
        text(
            "INSERT INTO intel_source_status (source_id, last_success_at, last_error) VALUES (:id, :at, NULL) "
            "ON CONFLICT (source_id) DO UPDATE SET last_success_at = excluded.last_success_at, last_error = NULL"
        ),
        {"id": source_id, "at": at},
    )


def record_source_error(source_id: str, error: str, at: str) -> None:
    db.session.execute(
        text(
            "INSERT INTO intel_source_status (source_id, last_error, last_error_at) VALUES (:id, :error, :at) "
            "ON CONFLICT (source_id) DO UPDATE SET last_error = excluded.last_error, last_error_at = excluded.last_error_at"
        ),
        {"id": source_id, "error": error, "at": at},
    )


# ---------------------------------------------------------------------------
# Runs
# ---------------------------------------------------------------------------


def _row_to_run(r: dict) -> dict:
    return {
        "id": r["id"],
        "trigger": r["trigger"],
        "requestedBy": r["requested_by"],
        "startedAt": r["started_at"],
        "finishedAt": r["finished_at"],
        "status": r["status"],
        "newCount": r["new_count"],
        "duplicateCount": r["duplicate_count"],
        "error": r["error"],
        "sources": json.loads(r["sources"]),
    }


def insert_run(run: dict) -> None:
    """Inserts a full run record (used by tests and seeds)."""
    db.session.execute(
        text(
            "INSERT INTO intel_runs (id, trigger, requested_by, started_at, finished_at, status, new_count, duplicate_count, "
            "error, sources) VALUES (:id, :trigger, :requested_by, :started_at, :finished_at, :status, :new_count, "
            ":duplicate_count, :error, :sources)"
        ),
        {
            "id": run["id"],
            "trigger": run.get("trigger") or "manual",
            "requested_by": run.get("requestedBy"),
            "started_at": run["startedAt"],
            "finished_at": run.get("finishedAt"),
            "status": run["status"],
            "new_count": run.get("newCount") or 0,
            "duplicate_count": run.get("duplicateCount") or 0,
            "error": run.get("error"),
            "sources": dumps_js(run.get("sources") or []),
        },
    )


def _stale_limit(now_ms: int | None = None) -> str:
    now = datetime.now(UTC) if now_ms is None else datetime.fromtimestamp(now_ms / 1000, UTC)
    return _iso(now - timedelta(milliseconds=RUNNING_STALE_MS))


def has_active_run(now_ms: int | None = None) -> bool:
    """True when a run is marked as running and started less than 15 minutes ago (any process)."""
    row = _row("SELECT 1 AS x FROM intel_runs WHERE status = 'running' AND started_at > :since LIMIT 1", since=_stale_limit(now_ms))
    return row is not None


def start_run(run_id: str, trigger: str, requested_by: str | None, started_at: str) -> bool:
    """Records a new running run unless another one is active (commits).

    The check and the insert are one statement, so two processes cannot both start.
    Runs left "running" by a restart are closed as failed. Returns False when busy.
    """
    inserted = db.session.execute(
        text(
            "INSERT INTO intel_runs (id, trigger, requested_by, started_at, status, sources) "
            "SELECT :id, :trigger, :requested_by, :started_at, 'running', '[]' "
            "WHERE NOT EXISTS (SELECT 1 FROM intel_runs WHERE status = 'running' AND started_at > :since)"
        ),
        {"id": run_id, "trigger": trigger, "requested_by": requested_by, "started_at": started_at, "since": _stale_limit()},
    ).rowcount
    if not inserted:
        db.session.rollback()
        return False
    db.session.execute(
        text(
            "UPDATE intel_runs SET status = 'failed', finished_at = COALESCE(finished_at, :at), "
            "error = 'Execução interrompida (servidor reiniciado)' WHERE status = 'running' AND id <> :id"
        ),
        {"at": started_at, "id": run_id},
    )
    db.session.commit()
    return True


def fail_run(run_id: str, error: str) -> None:
    """Closes a run that stopped on an unexpected error (commits)."""
    db.session.rollback()
    db.session.execute(
        text("UPDATE intel_runs SET status = 'failed', finished_at = :at, error = :error WHERE id = :id AND status = 'running'"),
        {"at": utc_now_iso(), "error": error, "id": run_id},
    )
    db.session.commit()


def finish_run(run_id: str, finished_at: str, status: str, new_count: int, duplicate_count: int, sources: list[dict]) -> dict:
    db.session.execute(
        text(
            "UPDATE intel_runs SET finished_at = :finished_at, status = :status, new_count = :new_count, "
            "duplicate_count = :duplicate_count, sources = :sources WHERE id = :id"
        ),
        {
            "finished_at": finished_at,
            "status": status,
            "new_count": new_count,
            "duplicate_count": duplicate_count,
            "sources": dumps_js(sources),
            "id": run_id,
        },
    )
    db.session.execute(
        text("DELETE FROM intel_runs WHERE id NOT IN (SELECT id FROM intel_runs ORDER BY started_at DESC LIMIT :keep)"),
        {"keep": MAX_RUNS_KEPT},
    )
    return get_run(run_id)


def get_run(run_id: str) -> dict | None:
    row = _row("SELECT * FROM intel_runs WHERE id = :id", id=run_id)
    return _row_to_run(row) if row else None


def list_runs(limit: int = 50) -> list[dict]:
    """Newest first."""
    return [_row_to_run(r) for r in _rows("SELECT * FROM intel_runs ORDER BY started_at DESC LIMIT :limit", limit=limit)]


def last_run() -> dict | None:
    runs = list_runs(1)
    return runs[0] if runs else None


def last_manual_run_end_ms() -> int:
    """End time (ms) of the latest finished manual run, or 0."""
    row = _row("SELECT MAX(finished_at) AS at FROM intel_runs WHERE trigger = 'manual' AND finished_at IS NOT NULL")
    return int(parse_iso_datetime(row["at"]).timestamp() * 1000) if row and row["at"] else 0


def schedule_data(now: datetime | None = None) -> dict:
    """Settings and the runs of the last two days, oldest first (what the scheduler needs)."""
    now = now or datetime.now(UTC)
    since = _iso(now - timedelta(days=2))
    runs = [_row_to_run(r) for r in _rows("SELECT * FROM intel_runs WHERE started_at >= :since ORDER BY started_at", since=since)]
    return {"settings": get_settings(), "runs": runs}


# ---------------------------------------------------------------------------
# Publications
# ---------------------------------------------------------------------------


def _search_text(pub: dict) -> str:
    return normalize_for_match(f"{pub['title']} {pub.get('excerpt') or ''} {pub.get('organ') or ''}")


def _row_to_publication(r: dict) -> dict:
    pub = {
        "id": r["id"],
        "sourceId": r["source_id"],
        "externalId": r["external_id"],
        "hash": r["hash"],
        "title": r["title"],
        "url": r["url"],
        "publishedAt": r["published_at"],
        "publishedTime": r["published_time"],
        "excerpt": r["excerpt"],
        "actType": r["act_type"],
        "organ": r["organ"],
        "subjects": json.loads(r["subjects"]),
        "relevance": r["relevance"],
        "normType": r["norm_type"],
        "effectiveDate": r["effective_date"],
        "collectedAt": r["collected_at"],
        "runId": r["run_id"],
    }
    if r.get("classification_reason"):
        pub["classificationReason"] = json.loads(r["classification_reason"])
    if "favorite" in r:
        pub["favorite"] = bool(r["favorite"])
    if r.get("favorited_at"):
        pub["favoritedAt"] = r["favorited_at"]
    return pub


def _replace_subjects(publication_id: str, subjects: list[str] | None) -> None:
    db.session.execute(text("DELETE FROM intel_publication_subjects WHERE publication_id = :id"), {"id": publication_id})
    for subject in subjects or []:
        db.session.execute(
            text("INSERT OR IGNORE INTO intel_publication_subjects (publication_id, subject_id) VALUES (:id, :subject)"),
            {"id": publication_id, "subject": subject},
        )


def insert_publications(publications: list[dict]) -> int:
    """Inserts publications, ignoring any already stored for the same source + external id.

    ON CONFLICT ignores only duplicates; missing required fields raise instead of
    disappearing silently. Returns how many were inserted (no commit).
    """
    inserted = 0
    for p in publications:
        result = db.session.execute(
            text(
                "INSERT INTO intel_publications (id, source_id, external_id, hash, title, url, published_at, published_time, "
                "excerpt, act_type, organ, subjects, relevance, norm_type, effective_date, classification_reason, collected_at, "
                "run_id, search_text) "
                "VALUES (:id, :source_id, :external_id, :hash, :title, :url, :published_at, :published_time, :excerpt, :act_type, :organ, "
                ":subjects, :relevance, :norm_type, :effective_date, :classification_reason, :collected_at, :run_id, :search_text) "
                "ON CONFLICT DO NOTHING"
            ),
            {
                "id": p["id"],
                "source_id": p["sourceId"],
                "external_id": p["externalId"],
                "hash": p.get("hash") or None,
                "title": p["title"],
                "url": p["url"],
                "published_at": p.get("publishedAt") or None,
                "published_time": p.get("publishedTime") or None,
                "excerpt": p.get("excerpt") or "",
                "act_type": p.get("actType") or "",
                "organ": p.get("organ") or "",
                "subjects": dumps_js(p.get("subjects") or []),
                "relevance": p.get("relevance"),
                "norm_type": p.get("normType") or None,
                "effective_date": p.get("effectiveDate") or None,
                "classification_reason": dumps_js(p["classificationReason"]) if p.get("classificationReason") else None,
                "collected_at": p["collectedAt"],
                "run_id": p.get("runId") or None,
                "search_text": _search_text(p),
            },
        )
        if result.rowcount:
            _replace_subjects(p["id"], p.get("subjects"))
            inserted += 1
    return inserted


def known_publication_keys() -> tuple[set[str], set[str]]:
    """Keys ("source:externalId") and content hashes of every stored publication."""
    rows = _rows("SELECT source_id, external_id, hash FROM intel_publications")
    return {f"{r['source_id']}:{r['external_id']}" for r in rows}, {r["hash"] for r in rows if r["hash"]}


def list_publications(filters: dict, limit: int, offset: int, user: str | None = None) -> dict:
    """Filtered, paginated list {total, items} (filters already validated by the caller)."""
    where = []
    params: dict = {}
    subjects = filters.get("subjects") or []
    if subjects:
        names = []
        for i, subject in enumerate(subjects):
            params[f"s{i}"] = subject
            names.append(f":s{i}")
        where.append(
            f"EXISTS (SELECT 1 FROM intel_publication_subjects s WHERE s.publication_id = p.id AND s.subject_id IN ({', '.join(names)}))"
        )
    if filters.get("relevance"):
        where.append("p.relevance = :relevance")
        params["relevance"] = filters["relevance"]
    if filters.get("source"):
        where.append("p.source_id = :source")
        params["source"] = filters["source"]
    # sem data de publicação: fica fora do filtro "de" e dentro do filtro "até"
    if filters.get("from"):
        where.append("p.published_at >= :date_from")
        params["date_from"] = filters["from"]
    if filters.get("to"):
        where.append("COALESCE(p.published_at, '') <= :date_to")
        params["date_to"] = filters["to"]
    if filters.get("runId"):
        where.append("p.run_id = :run_id")
        params["run_id"] = filters["runId"]
    if filters.get("text"):
        where.append("p.search_text LIKE :search ESCAPE '\\'")
        escaped = normalize_for_match(filters["text"]).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        params["search"] = f"%{escaped}%"
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    total = _row(f"SELECT COUNT(*) AS n FROM intel_publications p {where_sql}", **params)["n"]
    rows = _rows(
        "SELECT p.*, (f.username IS NOT NULL) AS favorite FROM intel_publications p "
        "LEFT JOIN intel_favorites f ON f.publication_id = p.id AND f.username = :user "
        f"{where_sql} ORDER BY {ORDER_BY} LIMIT :limit OFFSET :offset",
        user=user,
        limit=limit,
        offset=offset,
        **params,
    )
    return {"total": total, "items": [_row_to_publication(r) for r in rows]}


def get_publication(publication_id: str, user: str | None = None) -> dict | None:
    row = _row(
        "SELECT p.*, (f.username IS NOT NULL) AS favorite FROM intel_publications p "
        "LEFT JOIN intel_favorites f ON f.publication_id = p.id AND f.username = :user WHERE p.id = :id",
        user=user,
        id=publication_id,
    )
    return _row_to_publication(row) if row else None


def count_by_subject() -> dict[str, int]:
    return {r["subject_id"]: r["n"] for r in _rows("SELECT subject_id, COUNT(*) AS n FROM intel_publication_subjects GROUP BY subject_id")}


def count_by_source() -> dict[str, int]:
    return {r["source_id"]: r["n"] for r in _rows("SELECT source_id, COUNT(*) AS n FROM intel_publications GROUP BY source_id")}


def totals(recent_from: str) -> dict:
    reform = ", ".join(f"'{s}'" for s in REFORM_SUBJECTS)
    return {
        "publications": _row("SELECT COUNT(*) AS n FROM intel_publications")["n"],
        "critical": _row("SELECT COUNT(*) AS n FROM intel_publications WHERE relevance = 'critica'")["n"],
        "recent": _row("SELECT COUNT(*) AS n FROM intel_publications WHERE published_at >= :since", since=recent_from)["n"],
        "reform": _row(f"SELECT COUNT(DISTINCT publication_id) AS n FROM intel_publication_subjects WHERE subject_id IN ({reform})")["n"],
    }


def reclassify_publications(classify_fn) -> dict:
    """Re-applies a classification to every stored publication (commits).

    Items no longer relevant are removed unless someone saved them as favorite.
    """
    favorited = {r["publication_id"] for r in _rows("SELECT DISTINCT publication_id FROM intel_favorites")}
    result = {"updated": 0, "removed": 0, "keptFavorites": 0}
    for row in _rows("SELECT * FROM intel_publications"):
        pub = _row_to_publication(row)
        classification = classify_fn(pub)
        relevant = classification.pop("relevant")
        if not relevant and pub["id"] not in favorited:
            db.session.execute(text("DELETE FROM intel_publications WHERE id = :id"), {"id": pub["id"]})
            result["removed"] += 1
            continue
        if not relevant:
            result["keptFavorites"] += 1
        db.session.execute(
            text(
                "UPDATE intel_publications SET subjects = :subjects, relevance = :relevance, norm_type = :norm_type, "
                "effective_date = :effective_date, classification_reason = :reason WHERE id = :id"
            ),
            {
                "subjects": dumps_js(classification["subjects"]),
                "relevance": classification["relevance"],
                "norm_type": classification.get("normType") or None,
                "effective_date": classification.get("effectiveDate") or None,
                "reason": dumps_js(classification.get("classificationReason")),
                "id": pub["id"],
            },
        )
        _replace_subjects(pub["id"], classification["subjects"])
        result["updated"] += 1
    db.session.commit()
    return result


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------


def list_favorites(user: str) -> list[dict]:
    """User favorites, newest first."""
    rows = _rows(
        "SELECT p.*, 1 AS favorite, f.created_at AS favorited_at FROM intel_favorites f "
        "JOIN intel_publications p ON p.id = f.publication_id WHERE f.username = :user ORDER BY f.created_at DESC",
        user=user,
    )
    return [_row_to_publication(r) for r in rows]


def add_favorite(user: str, publication_id: str) -> str:
    """Returns "created", "exists" or "missing" (commits)."""
    if not _row("SELECT 1 AS x FROM intel_publications WHERE id = :id", id=publication_id):
        return "missing"
    result = db.session.execute(
        text("INSERT OR IGNORE INTO intel_favorites (username, publication_id, created_at) VALUES (:user, :id, :at)"),
        {"user": user, "id": publication_id, "at": utc_now_iso()},
    )
    db.session.commit()
    return "created" if result.rowcount else "exists"


def remove_favorite(user: str, publication_id: str) -> None:
    db.session.execute(
        text("DELETE FROM intel_favorites WHERE username = :user AND publication_id = :id"), {"user": user, "id": publication_id}
    )
    db.session.commit()
