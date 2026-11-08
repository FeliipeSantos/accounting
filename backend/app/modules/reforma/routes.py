"""HTTP routes of Calendário, mounted at /api/reforma.

Personal module: every route except /access requires a user allowed by REFORMA_USERS
(see access.py). The session and the JSON content type are checked before (app.core.http).

    GET  /access                         -> { allowed }
    GET  /status                         -> sources, last run, schedule, totals
    GET  /runs                           -> latest runs
    GET  /runs/<id>                      -> one run with each source's result
    POST /runs                           -> starts a manual synchronization
    GET  /documents                      -> documents (source, kind, q, changed, limit, offset)
    GET  /documents/<id>                 -> one document with its version history
    GET  /documents/<id>/versions/<vid>  -> full text of one version
    GET  /events                         -> calendar events of a period (from, to, kind, importance, subject,
                                            by=publicacao for the acts published in the period)
    GET  /events/<id>                    -> one event with its history
"""

import re
from datetime import datetime

from flask import Blueprint, current_app, g, request

from app.core.http import json_error, json_response
from app.modules.intelligence.catalog import SUBJECT_IDS
from app.modules.reforma import access, monitor, recurring, repository, scheduler
from app.modules.reforma import events as events_module
from app.modules.reforma.catalog import KINDS, SOURCE_IDS, SOURCES
from app.modules.reforma.subjects import subject_list

ID_PATTERN = re.compile(r"[\w-]{1,64}", re.ASCII)
MANUAL_COOLDOWN_SECONDS = 120
MAX_LIMIT = 100

bp = Blueprint("reforma", __name__, url_prefix="/api/reforma")


@bp.before_request
def _require_access():
    if request.path.rstrip("/").endswith("/api/reforma/access"):
        return None
    if not access.can_access(getattr(g, "user", None)):
        return json_error(403, "Acesso restrito ao usuário do módulo Calendário")
    return None


@bp.get("/access")
def access_route():
    return json_response({"allowed": access.can_access(getattr(g, "user", None))})


def _schedule() -> dict:
    return {
        "schedulerEnabled": scheduler.is_enabled(),
        "runTime": scheduler.run_time(),
        "nextRunAt": scheduler.next_run_at(repository.schedule_data()),
    }


@bp.get("/status")
def status():
    results = repository.last_source_results()
    counts = repository.count_by_source()
    month_start = datetime.now().astimezone().strftime("%Y-%m-01")
    return json_response(
        {
            "running": monitor.is_running() or repository.has_active_run(),
            "lastRun": repository.last_run(),
            **_schedule(),
            "totals": repository.totals(month_start),
            "events": repository.event_totals(datetime.now().astimezone().strftime("%Y-%m-%d")),
            "eventKinds": events_module.CALENDAR_KINDS,
            "subjects": subject_list(),
            "recurringReviews": recurring.review_list(repository.recurring_reviews()),
            "kinds": KINDS,
            "sources": [{**source, "documents": counts.get(source["id"], 0), "last": results.get(source["id"])} for source in SOURCES],
        }
    )


@bp.get("/runs")
def runs():
    return json_response(repository.list_runs())


@bp.get("/runs/<run_id>")
def run(run_id: str):
    found = repository.get_run(run_id) if ID_PATTERN.fullmatch(run_id) else None
    return json_response(found) if found else json_error(404, "Sincronização não encontrada")


@bp.post("/runs")
def start_run():
    if monitor.is_running() or repository.has_active_run():
        return json_error(409, "Já existe uma sincronização em andamento")
    last = repository.last_manual_run_end()
    if last and (datetime.now().astimezone() - last).total_seconds() < MANUAL_COOLDOWN_SECONDS:
        return json_error(429, "Aguarde dois minutos entre sincronizações manuais")
    monitor.run_in_background(g.user, current_app._get_current_object())
    return json_response({"started": True}, 202)


def _int(value: str | None, default: int, low: int, high: int) -> int:
    try:
        number = int(value) if value is not None else default
    except ValueError:
        number = default
    return max(low, min(high, number))


@bp.get("/documents")
def documents():
    args = request.args
    if args.get("source") and args["source"] not in SOURCE_IDS:
        return json_error(400, "Fonte inválida")
    if args.get("kind") and args["kind"] not in KINDS:
        return json_error(400, "Tipo inválido")
    filters = {"source": args.get("source"), "kind": args.get("kind"), "q": (args.get("q") or "")[:200], "changed": args.get("changed")}
    limit = _int(args.get("limit"), 50, 1, MAX_LIMIT)
    offset = _int(args.get("offset"), 0, 0, 1_000_000)
    return json_response(repository.list_documents(filters, limit=limit, offset=offset))


@bp.get("/documents/<doc_id>")
def document(doc_id: str):
    found = repository.get_document(doc_id) if ID_PATTERN.fullmatch(doc_id) else None
    return json_response(found) if found else json_error(404, "Documento não encontrado")


DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}", re.ASCII)
IMPORTANCE = {"critico", "alto", "medio", "informativo"}


@bp.get("/events")
def calendar_events():
    """Active events between `from` and `to` (yyyy-mm-dd, at most ~13 months apart)."""
    args = request.args
    date_from, date_to = args.get("from", ""), args.get("to", "")
    if not DATE_PATTERN.fullmatch(date_from) or not DATE_PATTERN.fullmatch(date_to) or date_from > date_to:
        return json_error(400, "Informe o período (from e to no formato aaaa-mm-dd)")
    if (datetime.fromisoformat(date_to) - datetime.fromisoformat(date_from)).days > 400:
        return json_error(400, "Período longo demais (máximo de 13 meses)")
    if args.get("kind") and args["kind"] not in events_module.CALENDAR_KINDS:
        return json_error(400, "Tipo de evento inválido")
    importance = [v for v in (args.get("importance") or "").split(",") if v]
    if any(v not in IMPORTANCE for v in importance):
        return json_error(400, "Importância inválida")
    subjects = [v for v in (args.get("subject") or "").split(",") if v]
    if any(v not in SUBJECT_IDS for v in subjects):
        return json_error(400, "Assunto inválido")
    filters = {
        "kind": args.get("kind"),
        "importance": importance,
        "subjects": subjects,
        "hidePublications": args.get("hidePublications") == "true",
        "officialOnly": args.get("officialOnly") == "true",
        # by=publicacao: atos publicados no período (as mudanças da semana), qualquer que seja a data
        "byPublication": args.get("by") == "publicacao",
    }
    return json_response(repository.list_events(date_from, date_to, filters))


@bp.get("/events/<event_id>")
def calendar_event(event_id: str):
    found = repository.get_event(event_id) if ID_PATTERN.fullmatch(event_id) else None
    return json_response(found) if found else json_error(404, "Evento não encontrado")


@bp.get("/documents/<doc_id>/versions/<version_id>")
def version_text(doc_id: str, version_id: str):
    if not ID_PATTERN.fullmatch(doc_id) or not ID_PATTERN.fullmatch(version_id):
        return json_error(404, "Versão não encontrada")
    text = repository.get_version_text(doc_id, version_id)
    if text is None and repository.get_document(doc_id) is None:
        return json_error(404, "Versão não encontrada")
    return json_response({"text": text or ""})
