"""Synchronization of the Calendário sources.

    1. each source, in isolation: collect, validate, store documents and new versions
    2. full text of the item pages still without it (CGIBS, Receita, CONFAZ protocols, Publicações)
    3. official files (PDF) of new versions: download and extract the text
    4. the run and the result of each source are logged

One run at a time (also across processes). Requests are paced: official sites are slow
and some answer errors to bursts. Steps 2 and 3 are capped per run; what is left is done
in the next run.
"""

import logging
import threading
import time
from collections.abc import Callable
from datetime import datetime

from flask import Flask, current_app

from app.core.database import utc_now_iso
from app.extensions import db
from app.modules.intelligence import http_client
from app.modules.intelligence.collectors.confaz import parse_detail as confaz_detail
from app.modules.intelligence.fulltext import confaz_page_text
from app.modules.intelligence.text import clean_text, local_iso_date
from app.modules.reforma import events, files, repository
from app.modules.reforma.catalog import KINDS, SOURCES
from app.modules.reforma.collectors import SyncContext, registry
from app.modules.reforma.collectors.pages import main_text, published_date

logger = logging.getLogger(__name__)

PAUSE_SECONDS = 1.0
MAX_TEXTS_PER_RUN = 40
MAX_FILES_PER_RUN = 25
# fontes cujo texto completo vem da página de cada item (as demais já trazem o texto ou um PDF)
PAGE_TEXT_SOURCES = {"cgibs-comunicados", "cgibs-noticias", "receita-rt", "receita-noticias", "confaz-protocolos", "intel"}

_current: str | None = None
_last_id_ms = 0
_lock = threading.Lock()


class SyncBusyError(RuntimeError):
    """Another synchronization is in progress."""


def is_running() -> bool:
    return _current is not None


def paced(fetch: Callable[[str], str]) -> Callable[[str], str]:
    last = [0.0]

    def run(url: str) -> str:
        wait = last[0] + PAUSE_SECONDS - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        try:
            return fetch(url)
        finally:
            last[0] = time.monotonic()

    return run


def validate(item: dict) -> dict | None:
    """The item when usable (required fields, official link, known kind), else None."""
    if not isinstance(item, dict):
        return None
    external_id = clean_text(item.get("externalId"), 300)
    title = clean_text(item.get("title"), 500)
    url = str(item.get("url") or "")
    if not external_id or not title or item.get("kind") not in KINDS or not http_client.is_official_url(url):
        return None
    if item.get("fileUrl") and not http_client.is_official_url(item["fileUrl"]):
        return None
    return {**item, "externalId": external_id, "title": title}


def _sync_source(source: dict, collector, fetch_text, today: str, run_id: str, last_results: dict) -> dict:
    started = time.monotonic()
    result = {"sourceId": source["id"], "status": "success", "fetched": 0, "newDocuments": 0, "newVersions": 0, "error": None}
    try:
        ctx = SyncContext(
            fetch_text=fetch_text,
            fetch_json=lambda url: fetch_text(url),
            today=today,
            known=repository.known_external_ids(source["id"]),
            last_success_at=(last_results.get(source["id"]) or {}).get("lastSuccessAt"),
        )
        items = collector(ctx)
        result["fetched"] = len(items)
        now = utc_now_iso()
        for raw in items:
            item = validate(raw)
            if item is None:
                continue
            outcome = repository.upsert_document(source["id"], item, run_id, now)
            if outcome == "new":
                result["newDocuments"] += 1
            elif outcome == "version":
                result["newVersions"] += 1
        db.session.commit()
    except Exception as err:  # noqa: BLE001
        db.session.rollback()
        result["status"] = "error"
        result["error"] = clean_text(str(err), 300) or "Erro desconhecido"
    result["durationMs"] = int((time.monotonic() - started) * 1000)
    result["checkedAt"] = utc_now_iso()
    return result


def _intel_text(external_id: str) -> str | None:
    from sqlalchemy import text

    row = db.session.execute(
        text("SELECT full_text FROM intel_publication_texts WHERE publication_id = :id AND status = 'ok'"), {"id": external_id}
    ).first()
    return row[0] if row else None


def fill_page_texts(fetch_text: Callable[[str], str], limit: int = MAX_TEXTS_PER_RUN) -> int:
    """Full text of current versions that still lack it. Returns how many were filled."""
    filled = 0
    for version in repository.versions_needing_text(PAGE_TEXT_SOURCES, limit):
        try:
            published = None
            if version["source_id"] == "intel":
                # o módulo Publicações lê o texto depois da coleta: confere de novo; notícias
                # (sem texto completo lá) são lidas da página oficial; sem nada, fica vazio e não volta à fila
                full_text = _intel_text(version["external_id"])
                if not full_text and not version["url"].lower().endswith(".pdf"):
                    full_text = main_text(fetch_text(version["url"]), tables=True)
                full_text = full_text or ""
            elif version["source_id"] == "confaz-protocolos":
                html = fetch_text(version["url"])
                full_text = confaz_page_text(html)
                published = confaz_detail(html)["publishedAt"]
            else:
                html = fetch_text(version["url"])
                full_text = main_text(html, tables=True)
                published = published_date(html)
            repository.save_page_text(version["id"], version["document_id"], full_text, published)
            db.session.commit()
            filled += 1
        except Exception as err:  # noqa: BLE001
            db.session.rollback()
            logger.warning("[reforma] texto de %s indisponível: %s", version["url"], err)
    return filled


def download_files(limit: int = MAX_FILES_PER_RUN, fetch_bytes: Callable = files.fetch_bytes) -> int:
    """Downloads the official files of new versions. Returns how many were stored."""
    # arquivos de documentos anteriores ao período da Reforma não são baixados (de uma vez, fora da fila)
    repository.skip_files_before(files.FILES_SINCE)
    db.session.commit()
    stored = 0
    for version in repository.versions_needing_file(limit):
        try:
            data, content_type = fetch_bytes(version["file_url"])
            path, sha, text = files.store(version["document_id"], data, content_type)
            repository.save_file_result(version["id"], "ok", path, sha, text, None)
            stored += 1
        except Exception as err:  # noqa: BLE001
            db.session.rollback()
            repository.save_file_result(version["id"], "error", None, None, None, clean_text(str(err), 300) or "Erro desconhecido")
        db.session.commit()
        time.sleep(PAUSE_SECONDS)
    return stored


MAX_EVENT_EXTRACTIONS = 1000


def extract_pending_events(limit: int = MAX_EVENT_EXTRACTIONS) -> dict:
    """Calendar events of the current versions not processed yet (by rules). Returns counts."""
    totals = {"documents": 0, "created": 0, "updated": 0, "superseded": 0}
    for version in repository.versions_needing_events(limit):
        document = {"id": version["document_id"], "kind": version["kind"], "title": version["title"], "summary": version["summary"]}
        extracted = events.extract_events(document, version["full_text"], version["published_at"])
        counts = repository.replace_document_events(version["document_id"], version["id"], extracted, utc_now_iso())
        db.session.commit()
        totals["documents"] += 1
        for key in ("created", "updated", "superseded"):
            totals[key] += counts[key]
    return totals


def run_sync(
    trigger: str = "manual",
    requested_by: str | None = None,
    collectors: dict | None = None,
    fetch_text: Callable[[str], str] | None = None,
    fetch_bytes: Callable | None = None,
    now: datetime | None = None,
    max_texts: int = MAX_TEXTS_PER_RUN,
    max_files: int = MAX_FILES_PER_RUN,
) -> dict:
    """Runs one synchronization (inside an app context) and returns the finished run.

    max_texts / max_files cap the page texts and files read in this run (higher in the
    first load, `flask reforma run --backfill`)."""
    global _current, _last_id_ms
    with _lock:
        if _current is not None:
            raise SyncBusyError("Já existe uma sincronização em andamento")
        _last_id_ms = max(int(time.time() * 1000), _last_id_ms + 1)
        run_id = f"sync-{_last_id_ms}"
        _current = run_id
    try:
        if not repository.start_run(run_id, trigger, requested_by, utc_now_iso()):
            raise SyncBusyError("Já existe uma sincronização em andamento")
        try:
            fetch = fetch_text or paced(http_client.fetch_text)
            available = collectors or registry()
            today = local_iso_date(now)
            last_results = repository.last_source_results()
            results = []
            for source in SOURCES:
                collector = available.get(source["id"])
                if collector is None:
                    continue
                result = _sync_source(source, collector, fetch, today, run_id, last_results)
                repository.record_source_result(run_id, result)
                db.session.commit()
                results.append(result)
                if result["status"] == "error":
                    logger.warning("[reforma] fonte %s falhou: %s", source["id"], result["error"])

            fill_page_texts(fetch, max_texts)
            stored = download_files(max_files, fetch_bytes=fetch_bytes or files.fetch_bytes)
            extract_pending_events()

            failures = sum(1 for r in results if r["status"] == "error")
            status = "success" if failures == 0 else ("failed" if failures == len(results) else "partial")
            repository.finish_run(run_id, status, sum(r["newDocuments"] for r in results), sum(r["newVersions"] for r in results), stored)
        except Exception as err:
            db.session.rollback()
            repository.finish_run(run_id, "failed", 0, 0, 0, clean_text(str(err), 300) or "Erro inesperado")
            raise
        run = repository.get_run(run_id)
        logger.info(
            "[reforma] sincronização %s (%s): %s, %s documento(s) novo(s), %s versão(ões) nova(s), %s arquivo(s)",
            run_id,
            trigger,
            run["status"],
            run["newDocuments"],
            run["newVersions"],
            run["filesDownloaded"],
        )
        return run
    finally:
        with _lock:
            _current = None


def run_in_background(requested_by: str, app: Flask | None = None) -> threading.Thread:
    app = app or current_app._get_current_object()

    def target():
        with app.app_context():
            try:
                run_sync(trigger="manual", requested_by=requested_by)
            except Exception as err:  # noqa: BLE001
                logger.error("[reforma] falha na sincronização manual: %s", err)

    thread = threading.Thread(target=target, name="reforma-manual-sync", daemon=True)
    thread.start()
    return thread
