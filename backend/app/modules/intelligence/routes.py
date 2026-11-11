"""HTTP routes of the Publicações module, mounted at /api/intelligence.

The session (g.user) and the JSON content type are checked before these routes
(app.core.http).
"""

import json
import re
import time
from datetime import UTC, datetime, timedelta

from flask import Blueprint, current_app, g, request
from werkzeug.exceptions import RequestEntityTooLarge

from app.core.http import json_error, json_response
from app.modules.intelligence import ai_summary, fulltext, monitor, repository, scheduler
from app.modules.intelligence.catalog import RELEVANCE_LEVELS, SOURCE_IDS, SOURCES, SUBJECT_IDS, SUBJECTS, collectable_ids
from app.modules.intelligence.classifier import RULES_DESCRIPTION
from app.modules.intelligence.keypoints import extract_key_points

MAX_BODY_BYTES = 100 * 1024
USER_PATTERN = re.compile(r"[\w.@-]{1,64}", re.ASCII)
ID_PATTERN = re.compile(r"[\w-]{1,128}", re.ASCII)
DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}", re.ASCII)
TIME_PATTERN = re.compile(r"([01]\d|2[0-3]):[0-5]\d", re.ASCII)
INT_PREFIX = re.compile(r"\s*([+-]?\d+)", re.ASCII)
RECENT_DAYS = 7
# Intervalo mínimo entre execuções manuais (evita sobrecarregar os sites oficiais)
MANUAL_RUN_COOLDOWN_MS = 60 * 1000
NOT_FOUND = "Rota não encontrada"

bp = Blueprint("intelligence", __name__, url_prefix="/api/intelligence")


def _read_json_body() -> dict:
    request.max_content_length = MAX_BODY_BYTES
    raw = request.get_data(cache=False)
    if not raw:
        return {}
    try:
        body = json.loads(raw)
    except ValueError:
        raise _BadRequest("JSON inválido") from None
    return body if isinstance(body, dict) else {}


class _BadRequest(Exception):
    pass


def _iso_days_ago(days: int) -> str:
    return (datetime.now(UTC) - timedelta(days=days)).date().isoformat()


def _js_parse_int(value: str | None) -> int | None:
    """parseInt(value, 10): leading integer of the text, or None (NaN)."""
    match = INT_PREFIX.match(value or "")
    return int(match.group(1)) if match else None


def _parse_filters(args) -> tuple[str | None, dict]:
    subjects = [s for s in (args.get("subject") or "").split(",") if s]
    relevance = args.get("relevance") or None
    source = args.get("source") or None
    date_from = args.get("from") or None
    date_to = args.get("to") or None
    run_id = args.get("run") or None
    search = (args.get("q") or "").strip()

    if any(s not in SUBJECT_IDS for s in subjects):
        return "Assunto inválido", {}
    if relevance and relevance not in RELEVANCE_LEVELS:
        return "Relevância inválida", {}
    if source and source not in SOURCE_IDS:
        return "Fonte inválida", {}
    if (date_from and not DATE_PATTERN.fullmatch(date_from)) or (date_to and not DATE_PATTERN.fullmatch(date_to)):
        return "Período inválido", {}
    if run_id and not repository.get_run(run_id):
        return "Execução não encontrada", {}
    return None, {
        "subjects": subjects,
        "relevance": relevance,
        "source": source,
        "from": date_from,
        "to": date_to,
        "runId": run_id,
        "text": search,
    }


def _parse_paging(args) -> tuple[int, int]:
    limit = min(max(_js_parse_int(args.get("limit")) or 50, 1), 200)
    offset = max(_js_parse_int(args.get("offset")) or 0, 0)
    return limit, offset


def _schedule_info() -> dict:
    enabled = scheduler.is_scheduler_enabled()
    return {"schedulerEnabled": enabled, "nextRunAt": scheduler.compute_next_run_at(repository.schedule_data()) if enabled else None}


def _public_settings(settings: dict) -> dict:
    return {key: value for key, value in settings.items() if key != "knownSources"}


def _validate_settings(body: dict) -> tuple[str | None, dict]:
    collectable = set(collectable_ids())
    changes = {}
    if "runTime" in body:
        run_time = body["runTime"]
        if not isinstance(run_time, str) or not TIME_PATTERN.fullmatch(run_time):
            return "Horário inválido (use HH:MM)", {}
        changes["runTime"] = run_time
    if "enabledSources" in body:
        sources = body["enabledSources"]
        if not isinstance(sources, list) or not all(isinstance(s, str) and s in collectable for s in sources):
            return "Lista de fontes inválida", {}
        changes["enabledSources"] = list(dict.fromkeys(sources))
    if "enabledSubjects" in body:
        subjects = body["enabledSubjects"]
        if not isinstance(subjects, list) or not all(isinstance(s, str) and s in SUBJECT_IDS for s in subjects):
            return "Lista de assuntos inválida", {}
        changes["enabledSubjects"] = list(dict.fromkeys(subjects))
    return None, changes


@bp.before_request
def _require_user():
    # toda rota do módulo exige o usuário da sessão atual (nunca vem de cabeçalhos)
    user = getattr(g, "user", None)
    if not isinstance(user, str) or not USER_PATTERN.fullmatch(user):
        return json_error(401, "Usuário não identificado")
    return None


@bp.get("/summary")
def summary():
    recent_from = _iso_days_ago(RECENT_DAYS)
    counts = repository.count_by_subject()
    return json_response(
        {
            "totals": repository.totals(recent_from),
            "recentDays": RECENT_DAYS,
            "byCategory": [{"id": s["id"], "name": s["name"], "count": counts.get(s["id"], 0)} for s in SUBJECTS],
            "recentItems": repository.list_publications({"from": recent_from}, limit=6, offset=0, user=g.user)["items"],
            "lastRun": repository.last_run(),
            **_schedule_info(),
        }
    )


@bp.get("/publications")
def publications():
    error, filters = _parse_filters(request.args)
    if error:
        return json_error(400, error)
    limit, offset = _parse_paging(request.args)
    return json_response(repository.list_publications(filters, limit=limit, offset=offset, user=g.user))


@bp.get("/publications/<publication_id>")
def publication(publication_id: str):
    if not ID_PATTERN.fullmatch(publication_id):
        return json_error(404, NOT_FOUND)
    pub = repository.get_publication(publication_id, g.user)
    if pub is None:
        return json_error(404, "Publicação não encontrada")
    # só no detalhe: o texto completo e os pontos principais extraídos dele
    stored = repository.get_publication_text(publication_id)
    if stored is None:
        # notícias, projetos de lei e portais nunca têm texto completo: não ficam "pendentes"
        pub["fullText"] = {"status": "pending" if fulltext.has_full_text(pub["sourceId"]) else "unavailable"}
    elif stored["status"] == "ok":
        pub["fullText"] = {"status": "ok", "url": stored["url"], "text": stored["text"], **extract_key_points(stored["text"])}
    else:
        pub["fullText"] = {"status": stored["status"]}
    return json_response(pub)


@bp.get("/publications/<publication_id>/ai-summary")
def publication_ai_summary(publication_id: str):
    if not ID_PATTERN.fullmatch(publication_id):
        return json_error(404, NOT_FOUND)
    result = ai_summary.get(publication_id)
    if result is None:
        return json_error(404, "Publicação não encontrada")
    return json_response(result)


@bp.post("/publications/<publication_id>/ai-summary")
def request_ai_summary(publication_id: str):
    # gerado só quando pedido, com a assinatura escolhida em Ajustes > Integrações
    if not ID_PATTERN.fullmatch(publication_id):
        return json_error(404, NOT_FOUND)
    try:
        result = ai_summary.request_summary(publication_id, g.user)
    except ai_summary.SummaryError as err:
        return json_error(err.status, err.message)
    return json_response(result, 202)


@bp.get("/subjects")
def subjects():
    enabled = repository.get_settings()["enabledSubjects"]
    counts = repository.count_by_subject()
    return json_response(
        [
            {"id": s["id"], "name": s["name"], "keywords": s["keywords"], "enabled": s["id"] in enabled, "count": counts.get(s["id"], 0)}
            for s in SUBJECTS
        ]
    )


@bp.get("/sources")
def sources():
    enabled = repository.get_settings()["enabledSources"]
    status = repository.get_source_status()
    counts = repository.count_by_source()
    return json_response(
        [{**s, "enabled": s["id"] in enabled, "status": status.get(s["id"]), "count": counts.get(s["id"], 0)} for s in SOURCES]
    )


@bp.get("/rules")
def rules():
    return json_response(RULES_DESCRIPTION)


@bp.get("/status")
def status():
    return json_response(
        {"running": monitor.is_running() or repository.has_active_run(), "lastRun": repository.last_run(), **_schedule_info()}
    )


@bp.post("/runs")
def start_run():
    if monitor.is_running() or repository.has_active_run():
        return json_error(409, "Já existe uma coleta em andamento")
    wait = repository.last_manual_run_end_ms() + MANUAL_RUN_COOLDOWN_MS - int(time.time() * 1000)
    if wait > 0:
        return json_error(429, f"Aguarde {-(-wait // 1000)} s para executar novamente")
    # roda em segundo plano; a tela acompanha pelo GET /status
    monitor.run_in_background(g.user, current_app._get_current_object())
    return json_response({"started": True}, 202)


@bp.get("/runs")
def runs():
    return json_response(repository.list_runs(50))


@bp.get("/settings")
def get_settings():
    return json_response(_public_settings(repository.get_settings()))


@bp.put("/settings")
def put_settings():
    error, changes = _validate_settings(_read_json_body())
    if error:
        return json_error(400, error)
    return json_response(_public_settings(repository.save_settings(changes)))


@bp.get("/favorites")
def favorites():
    return json_response(repository.list_favorites(g.user))


@bp.post("/favorites")
def add_favorite():
    body = _read_json_body()
    publication_id = body.get("publicationId") if isinstance(body.get("publicationId"), str) else ""
    result = repository.add_favorite(g.user, publication_id)
    if result == "missing":
        return json_error(404, "Publicação não encontrada")
    return json_response({"publicationId": publication_id, "favorite": True}, 201 if result == "created" else 200)


@bp.delete("/favorites/<publication_id>")
def remove_favorite(publication_id: str):
    if not ID_PATTERN.fullmatch(publication_id):
        return json_error(404, NOT_FOUND)
    repository.remove_favorite(g.user, publication_id)
    return json_response({"publicationId": publication_id, "favorite": False})


@bp.errorhandler(_BadRequest)
def _bad_request(error: _BadRequest):
    return json_error(400, str(error))


@bp.errorhandler(RequestEntityTooLarge)
def _too_large(_error):
    return json_error(413, "Payload muito grande")
