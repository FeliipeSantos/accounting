"""HTTP rules shared by every module: JSON responses, security headers,
session and content-type checks for /api, and JSON error handlers."""

import logging

from flask import Flask, Response, g, request
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge

from app.core.jsontext import dumps_js

logger = logging.getLogger(__name__)

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    # estilos inline são usados pelo app; scripts só do próprio servidor;
    # a fonte Inter vem do Google Fonts (folha de estilo + arquivos da fonte)
    "Content-Security-Policy": (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; "
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    ),
}

API_PREFIX = "/api/"
AUTH_PREFIX = "/api/auth/"
WRITE_METHODS = {"POST", "PUT", "DELETE"}
NOT_FOUND_MESSAGE = "Rota não encontrada"


def json_response(payload, status: int = 200) -> Response:
    """JSON response encoded like JavaScript's JSON.stringify (UTF-8, no escaping)."""
    return Response(dumps_js(payload), status=status, mimetype="application/json")


def json_error(status: int, message: str) -> Response:
    return json_response({"error": message}, status)


def _before_request():
    # Sem CORS: o app é servido pelo mesmo endereço da API
    if request.method == "OPTIONS":
        return Response(status=204)

    path = request.path
    if not path.startswith(API_PREFIX) or path.startswith(AUTH_PREFIX):
        return None

    from app.core.auth import SESSION_REQUIRED_MESSAGE, require_session

    # Toda API (exceto login) exige sessão válida
    require_session()
    if not g.user:
        return json_error(401, SESSION_REQUIRED_MESSAGE)

    # Escritas só com JSON: formulários de outros sites não conseguem enviar (proteção CSRF)
    if request.method in WRITE_METHODS and not (request.headers.get("Content-Type") or "").startswith("application/json"):
        return json_error(415, "Envie o conteúdo como application/json")
    return None


def _after_request(response: Response) -> Response:
    for name, value in SECURITY_HEADERS.items():
        response.headers[name] = value
    return response


def _handle_http_error(error: HTTPException):
    if isinstance(error, RequestEntityTooLarge):
        return json_error(413, "Conteúdo muito grande")
    # método não aceito responde como rota inexistente
    if error.code in (404, 405):
        return json_error(404, NOT_FOUND_MESSAGE)
    return json_error(error.code or 500, error.description or "Erro")


def _handle_unexpected_error(error: Exception):
    logger.exception("[server] erro na API %s %s", request.method, request.path)
    return json_error(500, "Erro interno do servidor")


def init_http(app: Flask) -> None:
    app.before_request(_before_request)
    app.after_request(_after_request)
    app.register_error_handler(HTTPException, _handle_http_error)
    app.register_error_handler(Exception, _handle_unexpected_error)

    @app.get("/healthz")
    def healthz():
        # verificação de saúde para monitoramento (sem dados, sem login)
        return json_response({"status": "ok"})
