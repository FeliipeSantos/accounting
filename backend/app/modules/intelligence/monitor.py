"""Monitoring run: collects every enabled source in isolation, validates, classifies,
de-duplicates and stores new publications, logging the run."""

import hashlib
import logging
import re
import threading
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from flask import Flask, current_app

from app.core.database import utc_now_iso
from app.extensions import db
from app.modules.intelligence import http_client, repository
from app.modules.intelligence.catalog import SOURCES
from app.modules.intelligence.classifier import classify
from app.modules.intelligence.collectors import CollectContext, registry
from app.modules.intelligence.text import add_days, clean_text, local_iso_date, parse_iso_datetime

logger = logging.getLogger(__name__)

# Janela da primeira coleta de cada fonte
BACKFILL_DAYS = 30
ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
TIME = re.compile(r"([01]\d|2[0-3]):[0-5]\d")

_current_run: str | None = None
_last_run_ms = 0
_state_lock = threading.Lock()


class MonitorBusyError(RuntimeError):
    """Another collection is in progress (in this process or recorded by another)."""


def is_running() -> bool:
    return _current_run is not None


def _sha1(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()


def publication_key(source_id: str, external_id: str) -> str:
    return f"{source_id}:{external_id}"


def content_hash(source_id: str, title: str, published_at: str | None) -> str:
    return _sha1(f"{source_id}|{title.lower()}|{published_at or ''}")


def _matches(pattern: re.Pattern, value) -> bool:
    return isinstance(value, str) and pattern.fullmatch(value) is not None


def sanitize(raw, source_id: str) -> dict | None:
    """Validates and normalizes a raw collector item; None when unusable."""
    if not isinstance(raw, dict):
        return None
    external_id = clean_text(raw.get("externalId"), 300)
    title = clean_text(raw.get("title"), 500)
    url = str(raw.get("url") or "")
    if not external_id or not title or not http_client.is_official_url(url):
        return None
    published_at = raw["publishedAt"] if _matches(ISO_DATE, raw.get("publishedAt")) else None
    # horário só quando a fonte informa e há data
    published_time = raw["publishedTime"] if published_at and _matches(TIME, raw.get("publishedTime")) else None
    return {
        "sourceId": source_id,
        "externalId": external_id,
        "title": title,
        "url": url,
        "publishedAt": published_at,
        "publishedTime": published_time,
        "excerpt": clean_text(raw.get("excerpt"), 2000),
        "actType": clean_text(raw.get("actType"), 120),
        "organ": clean_text(raw.get("organ"), 300),
    }


def _since_for(status: dict | None, today: str) -> str:
    if status and status.get("lastSuccessAt"):
        # um dia de sobreposição para não perder publicações do dia da última coleta
        return add_days(local_iso_date(parse_iso_datetime(status["lastSuccessAt"])), -1)
    return add_days(today, -BACKFILL_DAYS)


class _RunContext:
    def __init__(self, run_id, collectors, fetch_text, fetch_json, today, source_status, enabled_subjects, known_keys, known_hashes):
        self.run_id = run_id
        self.collectors = collectors
        self.fetch_text = fetch_text
        self.fetch_json = fetch_json
        self.today = today
        self.source_status = source_status
        self.enabled_subjects = enabled_subjects
        self.known_keys = known_keys
        self.known_hashes = known_hashes
        self.lock = threading.Lock()


def _collect_source(source: dict, ctx: _RunContext) -> tuple[dict, list[dict]]:
    started = time.monotonic()
    result = {
        "sourceId": source["id"],
        "status": "success",
        "fetched": 0,
        "invalid": 0,
        "relevant": 0,
        "newCount": 0,
        "duplicateCount": 0,
        "error": None,
        "durationMs": 0,
    }
    fresh = []
    try:
        collector = ctx.collectors.get(source["id"])
        if collector is None:
            raise RuntimeError("Coletor não implementado")
        raw_items = collector(
            CollectContext(
                fetch_text=ctx.fetch_text,
                fetch_json=ctx.fetch_json,
                today=ctx.today,
                since=_since_for(ctx.source_status.get(source["id"]), ctx.today),
                is_known=lambda external_id: publication_key(source["id"], external_id) in ctx.known_keys,
            )
        )
        result["fetched"] = len(raw_items)
        for raw in raw_items:
            item = sanitize(raw, source["id"])
            if item is None:
                result["invalid"] += 1
                continue
            classification = classify(item, ctx.enabled_subjects)
            if not classification.pop("relevant"):
                continue
            result["relevant"] += 1
            key = publication_key(source["id"], item["externalId"])
            item_hash = content_hash(source["id"], item["title"], item["publishedAt"])
            with ctx.lock:
                if key in ctx.known_keys or item_hash in ctx.known_hashes:
                    result["duplicateCount"] += 1
                    continue
                ctx.known_keys.add(key)
                ctx.known_hashes.add(item_hash)
            fresh.append(
                {
                    "id": f"pub-{_sha1(key)[:16]}",
                    **item,
                    **classification,
                    "hash": item_hash,
                    "collectedAt": utc_now_iso(),
                    "runId": ctx.run_id,
                }
            )
        result["newCount"] = len(fresh)
    except Exception as err:  # noqa: BLE001
        result["status"] = "error"
        result["error"] = clean_text(str(err), 300) or "Erro desconhecido"
    result["durationMs"] = int((time.monotonic() - started) * 1000)
    return result, fresh


def _collect_and_store(run_id: str, collectors, fetch_text, fetch_json, now: datetime | None) -> dict:
    settings = repository.get_settings()
    known_keys, known_hashes = repository.known_publication_keys()
    ctx = _RunContext(
        run_id=run_id,
        collectors=collectors or registry(),
        fetch_text=fetch_text or http_client.fetch_text,
        fetch_json=fetch_json or http_client.fetch_json,
        today=local_iso_date(now),
        source_status=repository.get_source_status(),
        enabled_subjects=settings["enabledSubjects"],
        known_keys=known_keys,
        known_hashes=known_hashes,
    )
    enabled = [s for s in SOURCES if s["collectable"] and s["id"] in settings["enabledSources"]]
    # fontes em paralelo e isoladas: a falha de uma não interrompe as demais
    with ThreadPoolExecutor(max_workers=max(len(enabled), 1)) as pool:
        outcomes = list(pool.map(lambda source: _collect_source(source, ctx), enabled))

    finished_at = utc_now_iso()
    results = [result for result, _ in outcomes]
    failures = sum(1 for r in results if r["status"] == "error")
    if not results or failures == 0:
        status = "success"
    else:
        status = "failed" if failures == len(results) else "partial"

    # grava publicações, situação das fontes e o resultado numa transação só
    inserted = repository.insert_publications([pub for _, fresh in outcomes for pub in fresh])
    for r in results:
        if r["status"] == "success":
            repository.record_source_success(r["sourceId"], finished_at)
        else:
            repository.record_source_error(r["sourceId"], r["error"], finished_at)
    run = repository.finish_run(run_id, finished_at, status, inserted, sum(r["duplicateCount"] for r in results), results)
    db.session.commit()

    logger.info(
        "[intelligence] execução %s (%s): %s, %s nova(s), %s duplicada(s)",
        run_id,
        run["trigger"],
        status,
        run["newCount"],
        run["duplicateCount"],
    )
    for r in results:
        if r["status"] == "error":
            logger.warning("[intelligence] fonte %s falhou: %s", r["sourceId"], r["error"])
    return run


def run_monitoring(
    trigger: str = "manual",
    requested_by: str | None = None,
    collectors: dict[str, Callable] | None = None,
    fetch_text: Callable | None = None,
    fetch_json: Callable | None = None,
    now: datetime | None = None,
) -> dict:
    """Runs one monitoring cycle (inside an app context). Only one at a time, also
    across processes. Returns the finished run record."""
    global _current_run, _last_run_ms
    with _state_lock:
        if _current_run is not None:
            raise MonitorBusyError("Já existe uma execução do monitoramento em andamento")
        # id = instante em ms, sem repetir mesmo com duas execuções no mesmo milissegundo
        _last_run_ms = max(int(time.time() * 1000), _last_run_ms + 1)
        run_id = f"run-{_last_run_ms}"
        _current_run = run_id
    try:
        # registra a execução; recusa se outra (ex.: comando em outro processo) estiver em andamento
        if not repository.start_run(run_id, trigger, requested_by, utc_now_iso()):
            raise MonitorBusyError("Já existe uma execução do monitoramento em andamento")
        try:
            return _collect_and_store(run_id, collectors, fetch_text, fetch_json, now)
        except Exception as err:
            # erro inesperado: a execução não fica "em andamento" por 15 minutos
            repository.fail_run(run_id, clean_text(str(err), 300) or "Erro inesperado")
            raise
    finally:
        with _state_lock:
            _current_run = None


def run_in_background(requested_by: str, app: Flask | None = None) -> threading.Thread:
    """Starts a manual run in a background thread; the screen follows it via GET /status."""
    app = app or current_app._get_current_object()

    def target():
        with app.app_context():
            try:
                run_monitoring(trigger="manual", requested_by=requested_by)
            except Exception as err:  # noqa: BLE001
                logger.error("[intelligence] falha na execução manual: %s", err)

    thread = threading.Thread(target=target, name="intel-manual-run", daemon=True)
    thread.start()
    return thread


def reclassify_all() -> dict:
    """Re-applies the current rules to stored publications (see repository)."""
    if is_running() or repository.has_active_run():
        raise MonitorBusyError("Aguarde o fim da execução em andamento")
    enabled = repository.get_settings()["enabledSubjects"]
    return repository.reclassify_publications(lambda pub: classify(pub, enabled))
