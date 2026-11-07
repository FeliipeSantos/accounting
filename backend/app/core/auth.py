"""Login, logout and sessions (/api/auth), with a per-IP limit of failed attempts.

Sessions live in core_sessions (only the SHA-256 of the token is stored), so
logins survive restarts. The failed attempt limit is a short-lived in-memory throttle.
"""

import hashlib
import json
import math
import secrets
import threading
from dataclasses import dataclass

from flask import Blueprint, current_app, g, request
from sqlalchemy import delete, update

from app.core.database import now_ms
from app.core.http import json_error, json_response
from app.core.models import Session
from app.core.users import get_password_hash, hash_password, verify_password
from app.extensions import db

COOKIE_NAME = "sid"
MAX_FAILED_ATTEMPTS = 5
FAILED_WINDOW_MS = 15 * 60 * 1000
# Renova a expiração no banco no máximo uma vez por minuto por sessão
RENEW_AFTER_MS = 60 * 1000
MAX_LOGIN_BODY_BYTES = 4 * 1024
SESSION_REQUIRED_MESSAGE = "Sessão expirada ou inexistente"

# Hash usado para gastar o mesmo tempo quando o usuário não existe
_DUMMY_HASH = hash_password(secrets.token_hex(16))

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@dataclass
class _Failures:
    count: int
    first_at: int


class LoginThrottle:
    """Failed login attempts per client IP within a time window (thread-safe)."""

    def __init__(self) -> None:
        self._entries: dict[str, _Failures] = {}
        self._lock = threading.Lock()

    def blocked_for(self, ip: str, now: int) -> int:
        """Seconds until the IP may try again, or 0 when not blocked."""
        with self._lock:
            entry = self._entries.get(ip)
            if entry is None:
                return 0
            if now - entry.first_at > FAILED_WINDOW_MS:
                del self._entries[ip]
                return 0
            if entry.count < MAX_FAILED_ATTEMPTS:
                return 0
            return math.ceil((entry.first_at + FAILED_WINDOW_MS - now) / 1000)

    def register_failure(self, ip: str, now: int) -> None:
        with self._lock:
            entry = self._entries.get(ip)
            if entry is None or now - entry.first_at > FAILED_WINDOW_MS:
                self._entries[ip] = _Failures(1, now)
            else:
                entry.count += 1

    def clear(self, ip: str) -> None:
        with self._lock:
            self._entries.pop(ip, None)


def _settings():
    return current_app.config["SETTINGS"]


def _ttl_ms() -> int:
    return int(_settings().session_ttl_hours * 60 * 60 * 1000)


def _cookie(value: str, max_age_seconds: int) -> str:
    secure = "; Secure" if _settings().cookie_secure else ""
    return f"{COOKIE_NAME}={value}; HttpOnly; SameSite=Strict; Path=/; Max-Age={max_age_seconds}{secure}"


def _client_ip() -> str:
    # atrás do Nginx, o IP real vem no X-Forwarded-For (só se TRUST_PROXY=true)
    forwarded = request.headers.get("X-Forwarded-For")
    if _settings().trust_proxy and forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def get_session_user() -> str | None:
    """User of the valid session in the request cookie (renewing its expiry), or None."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    token_hash = _token_hash(token)
    session = db.session.get(Session, token_hash)
    if session is None:
        return None
    now = now_ms()
    if session.expires_at <= now:
        db.session.execute(delete(Session).where(Session.token_hash == token_hash))
        db.session.commit()
        return None
    expires_at = now + _ttl_ms()
    if expires_at - session.expires_at >= RENEW_AFTER_MS:
        db.session.execute(update(Session).where(Session.token_hash == token_hash).values(expires_at=expires_at))
        db.session.commit()
    return session.username


def require_session() -> None:
    """Puts the session user in g.user (None when there is no valid session)."""
    g.user = get_session_user()


@bp.get("/session")
def session_route():
    user = get_session_user()
    if user:
        return json_response({"user": user})
    return json_error(401, SESSION_REQUIRED_MESSAGE)


@bp.post("/login")
def login_route():
    request.max_content_length = MAX_LOGIN_BODY_BYTES
    try:
        credentials = json.loads(request.get_data(cache=False) or b"")
    except ValueError:
        return json_error(400, "Requisição inválida")
    if not isinstance(credentials, dict):
        credentials = {}

    throttle: LoginThrottle = current_app.extensions["login_throttle"]
    ip = _client_ip()
    now = now_ms()
    wait = throttle.blocked_for(ip, now)
    if wait:
        return json_error(429, f"Muitas tentativas. Tente novamente em {math.ceil(wait / 60)} min.")

    username = credentials.get("username")
    password = credentials.get("password")
    name = username.strip() if isinstance(username, str) else ""
    stored = get_password_hash(name) if name else None
    ok = verify_password(password if isinstance(password, str) else "", stored or _DUMMY_HASH) and bool(stored)
    if not ok:
        throttle.register_failure(ip, now)
        return json_error(401, "Usuário ou senha incorretos.")

    throttle.clear(ip)
    # limpeza oportunista das sessões vencidas
    db.session.execute(delete(Session).where(Session.expires_at <= now))
    token = secrets.token_urlsafe(32)
    db.session.add(Session(token_hash=_token_hash(token), username=name, created_at=now, expires_at=now + _ttl_ms()))
    db.session.commit()
    response = json_response({"user": name})
    response.headers.add("Set-Cookie", _cookie(token, _ttl_ms() // 1000))
    return response


@bp.post("/logout")
def logout_route():
    token = request.cookies.get(COOKIE_NAME)
    if token:
        db.session.execute(delete(Session).where(Session.token_hash == _token_hash(token)))
        db.session.commit()
    response = json_response({"success": True})
    response.headers.add("Set-Cookie", _cookie("", 0))
    return response
