"""The logged-in user's own account (/api/profile): name, avatar, login name and password.

    GET  /            -> profile
    PUT  /            { name, avatar } -> profile
    GET  /avatar      -> the uploaded photo (image/png, image/jpeg or image/webp)
    POST /password    { currentPassword, newPassword } -> { user }
    POST /username    { currentPassword, newUsername } -> { user }   (newUsername: e-mail)

profile = { user, name, avatar, createdAt }, where avatar is null (the screen
shows the initials), { kind: "preset", seed } (illustration drawn by the screen from the seed)
or { kind: "image", url } (photo uploaded by the user).

The login name and the password ask for the current password. Wrong passwords count in the
same per-IP limit as the login (a stolen open session cannot be used to guess the password).
Changing the password ends the user's other sessions and keeps this one; renaming keeps
every session, favorite and record (they follow the new name).
"""

import base64
import binascii
import math
import re

from flask import Blueprint, Response, current_app, g, request

from app.core.auth import COOKIE_NAME, LoginThrottle, _client_ip, _token_hash
from app.core.database import now_ms, utc_now_iso
from app.core.http import json_error, json_response
from app.core.models import User
from app.core.users import UserError, assert_valid_email, get_password_hash, rename_user, set_password, verify_password
from app.extensions import db

MAX_BODY_BYTES = 4 * 1024
# a tela reduz a foto para 256 px antes de enviar; o limite cobre a foto em base64 com folga
MAX_PROFILE_BODY_BYTES = 1024 * 1024
MAX_IMAGE_BYTES = 512 * 1024
MAX_NAME_LENGTH = 80
WRONG_PASSWORD_MESSAGE = "Senha atual incorreta."
SEED_PATTERN = re.compile(r"^[\w-]{1,64}$", re.ASCII)
DATA_URL = re.compile(r"^data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$")
# assinatura de cada formato aceito: o conteúdo precisa ser mesmo a imagem declarada
SIGNATURES = {
    "image/png": lambda raw: raw.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/jpeg": lambda raw: raw.startswith(b"\xff\xd8\xff"),
    "image/webp": lambda raw: raw[:4] == b"RIFF" and raw[8:12] == b"WEBP",
}

bp = Blueprint("profile", __name__, url_prefix="/api/profile")


class ProfileError(ValueError):
    """Invalid profile data; the message is shown on the screen."""


def _body(limit: int = MAX_BODY_BYTES) -> dict:
    request.max_content_length = limit
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _text(data: dict, key: str) -> str:
    value = data.get(key)
    return value if isinstance(value, str) else ""


def _check_current_password(password: str):
    """None when the password is right; otherwise the error response (wrong or too many tries).
    Never 401: that status means "session expired" to the screen."""
    throttle: LoginThrottle = current_app.extensions["login_throttle"]
    ip = _client_ip()
    now = now_ms()
    wait = throttle.blocked_for(ip, now)
    if wait:
        return json_error(429, f"Muitas tentativas. Tente novamente em {math.ceil(wait / 60)} min.")
    if not verify_password(password, get_password_hash(g.user)):
        throttle.register_failure(ip, now)
        return json_error(400, WRONG_PASSWORD_MESSAGE)
    throttle.clear(ip)
    return None


def _avatar_json(user: User):
    if user.avatar and user.avatar.startswith("preset:"):
        return {"kind": "preset", "seed": user.avatar.removeprefix("preset:")}
    if user.avatar == "image":
        # a data de alteração no endereço faz o navegador buscar a foto nova depois de uma troca
        return {"kind": "image", "url": f"/api/profile/avatar?v={user.updated_at}"}
    return None


def _profile_json(user: User):
    return {
        "user": user.username,
        "name": user.display_name,
        "avatar": _avatar_json(user),
        "createdAt": user.created_at,
    }


def _decode_image(data_url: str) -> tuple[bytes, str]:
    match = DATA_URL.match(data_url)
    if not match:
        raise ProfileError("Envie uma imagem JPG, PNG ou WebP.")
    mime = match.group(1)
    try:
        raw = base64.b64decode(re.sub(r"\s", "", match.group(2)), validate=True)
    except (binascii.Error, ValueError) as err:
        raise ProfileError("Imagem inválida.") from err
    if len(raw) > MAX_IMAGE_BYTES:
        raise ProfileError("Imagem grande demais.")
    if not SIGNATURES[mime](raw):
        raise ProfileError("O arquivo não é uma imagem JPG, PNG ou WebP.")
    return raw, mime


def _apply_avatar(user: User, avatar) -> None:
    if avatar is None:
        user.avatar = None
        user.avatar_image = None
        user.avatar_mime = None
        return
    kind = avatar.get("kind") if isinstance(avatar, dict) else None
    if kind == "preset":
        seed = avatar.get("seed")
        if not isinstance(seed, str) or not SEED_PATTERN.match(seed):
            raise ProfileError("Avatar inválido.")
        user.avatar = f"preset:{seed}"
        user.avatar_image = None
        user.avatar_mime = None
    elif kind == "image":
        # mantém a foto já enviada
        if user.avatar != "image":
            raise ProfileError("Nenhuma foto enviada para manter.")
    elif kind == "upload":
        raw, mime = _decode_image(_text(avatar, "dataUrl"))
        user.avatar = "image"
        user.avatar_image = raw
        user.avatar_mime = mime
    else:
        raise ProfileError("Avatar inválido.")


@bp.get("")
def profile():
    return json_response(_profile_json(db.session.get(User, g.user)))


@bp.put("")
def update_profile():
    data = _body(MAX_PROFILE_BODY_BYTES)
    user = db.session.get(User, g.user)
    name = data.get("name")
    if name is not None and not isinstance(name, str):
        return json_error(400, "Nome inválido.")
    name = (name or "").strip()
    if len(name) > MAX_NAME_LENGTH:
        return json_error(400, f"Nome muito longo: use até {MAX_NAME_LENGTH} caracteres.")
    try:
        _apply_avatar(user, data.get("avatar"))
    except ProfileError as err:
        db.session.rollback()
        return json_error(400, str(err))
    user.display_name = name or None
    user.updated_at = utc_now_iso()
    db.session.commit()
    return json_response(_profile_json(user))


@bp.get("/avatar")
def avatar_image():
    user = db.session.get(User, g.user)
    if user.avatar != "image" or not user.avatar_image:
        return json_error(404, "Sem foto de perfil.")
    response = Response(user.avatar_image, mimetype=user.avatar_mime)
    # o endereço muda a cada troca (?v=...), então a foto pode ficar no cache do navegador
    response.headers["Cache-Control"] = "private, max-age=31536000, immutable"
    return response


@bp.post("/password")
def change_password():
    data = _body()
    refused = _check_current_password(_text(data, "currentPassword"))
    if refused:
        return refused
    token = request.cookies.get(COOKIE_NAME)
    try:
        set_password(g.user, _text(data, "newPassword"), keep_session=_token_hash(token) if token else None)
    except UserError as err:
        return json_error(400, str(err))
    return json_response({"user": g.user})


@bp.post("/username")
def change_username():
    data = _body()
    refused = _check_current_password(_text(data, "currentPassword"))
    if refused:
        return refused
    # o login é sempre o e-mail, guardado em minúsculas
    new_username = _text(data, "newUsername").strip().lower()
    try:
        assert_valid_email(new_username)
        rename_user(g.user, new_username)
    except UserError as err:
        return json_error(400, str(err))
    return json_response({"user": new_username})
