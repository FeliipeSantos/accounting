"""External services of the installation (/api/integrations), changed in Ajustes > Integrações.

The AI assistant uses the person's own subscription through the official CLIs (see ai_cli.py):
Claude (Claude Pro/Max) or ChatGPT (Plus/Pro). There is no API key.

    GET    /ai                          -> status
    PUT    /ai/active                   { provider } -> chooses the AI in use, returns the status
    POST   /ai/<provider>/login         -> starts the official login (link + code), returns the status
    POST   /ai/<provider>/login/code    { code } -> Claude: sends the code shown by the browser
    DELETE /ai/<provider>/login         -> cancels a login in progress
    POST   /ai/<provider>/logout        -> disconnects the subscription (removes the CLI login)

status = { activeProvider, providers: [{ id, name, plan, installed, connected, account, error }],
           login: { provider, state, url, code, needsCode, message } | null }
"""

import logging

from flask import Blueprint, g, request

from app.core import ai_cli
from app.core.database import utc_now_iso
from app.core.http import json_error, json_response
from app.core.models import AppSetting
from app.extensions import db

logger = logging.getLogger(__name__)

ACTIVE_SETTING = "ai.provider"
DEFAULT_PROVIDER = "claude"
MAX_BODY_BYTES = 4 * 1024
MAX_CODE_LENGTH = 512

bp = Blueprint("integrations", __name__, url_prefix="/api/integrations")


def active_provider() -> str:
    """AI chosen in Ajustes (Claude unless ChatGPT was chosen); its connection is checked on use."""
    setting = db.session.get(AppSetting, ACTIVE_SETTING)
    return setting.value if setting and setting.value in ai_cli.PROVIDERS else DEFAULT_PROVIDER


def _status(fresh: bool = False) -> dict:
    providers = []
    for provider in ai_cli.PROVIDERS.values():
        providers.append({"id": provider.id, "name": provider.name, "plan": provider.plan, **ai_cli.connection(provider.id, fresh=fresh)})
    login = next((state for p in ai_cli.PROVIDERS if (state := ai_cli.login_state(p))), None)
    return {"activeProvider": active_provider(), "providers": providers, "login": login}


def _body() -> dict:
    request.max_content_length = MAX_BODY_BYTES
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _known(provider_id: str) -> bool:
    return provider_id in ai_cli.PROVIDERS


@bp.get("/ai")
def ai_status():
    return json_response(_status(fresh=request.args.get("fresh") == "1"))


@bp.put("/ai/active")
def choose_active():
    provider_id = _body().get("provider")
    if not isinstance(provider_id, str) or not _known(provider_id):
        return json_error(400, "Tipo de IA desconhecido.")
    now = utc_now_iso()
    setting = db.session.get(AppSetting, ACTIVE_SETTING)
    if setting:
        setting.value, setting.updated_at, setting.updated_by = provider_id, now, g.user
    else:
        db.session.add(AppSetting(key=ACTIVE_SETTING, value=provider_id, updated_at=now, updated_by=g.user))
    db.session.commit()
    return json_response(_status())


@bp.post("/ai/<provider_id>/login")
def start_login(provider_id: str):
    if not _known(provider_id):
        return json_error(404, "Tipo de IA desconhecido.")
    # um login por vez: começar outro cancela o que estava aberto
    for other in ai_cli.PROVIDERS:
        if other != provider_id:
            ai_cli.cancel_login(other)
    try:
        ai_cli.start_login(provider_id)
    except ai_cli.AiError as err:
        return json_error(400, str(err))
    logger.info("[ia] login do %s iniciado por %s", provider_id, g.user)
    return json_response(_status())


@bp.post("/ai/<provider_id>/login/code")
def send_code(provider_id: str):
    if not _known(provider_id):
        return json_error(404, "Tipo de IA desconhecido.")
    code = _body().get("code")
    if not isinstance(code, str) or not code.strip() or len(code) > MAX_CODE_LENGTH:
        return json_error(400, "Cole o código mostrado na página de login.")
    try:
        ai_cli.submit_code(provider_id, code)
    except ai_cli.AiError as err:
        return json_error(400, str(err))
    return json_response(_status())


@bp.delete("/ai/<provider_id>/login")
def cancel_login(provider_id: str):
    if not _known(provider_id):
        return json_error(404, "Tipo de IA desconhecido.")
    ai_cli.cancel_login(provider_id)
    return json_response(_status())


@bp.post("/ai/<provider_id>/logout")
def logout(provider_id: str):
    if not _known(provider_id):
        return json_error(404, "Tipo de IA desconhecido.")
    ai_cli.logout(provider_id)
    logger.info("[ia] %s desconectado por %s", provider_id, g.user)
    return json_response(_status(fresh=True))
