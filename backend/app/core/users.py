"""User accounts in the database (table core_users).

Password hashes use the same format and scrypt parameters as the previous version
(Node), so passwords created before keep working: scrypt$<salt base64url>$<hash base64url>.
"""

import base64
import hashlib
import hmac
import logging
import os
import re

from sqlalchemy import delete, func, select

from app.core.database import utc_now_iso
from app.core.models import Session, User
from app.extensions import db

logger = logging.getLogger(__name__)

# Parâmetros da versão anterior (padrão do crypto.scryptSync do Node)
SCRYPT_N = 16384
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_KEYLEN = 64
SALT_BYTES = 16
USER_PATTERN = re.compile(r"^[\w.@-]{1,64}$", re.ASCII)
MIN_PASSWORD_LENGTH = 10

NO_USERS_MESSAGE = "Nenhum usuário no banco. Crie o primeiro com: flask user add <usuario>"
DEV_ADMIN_MESSAGE = (
    "O usuário de desenvolvimento admin/admin existe neste banco. "
    "Crie seu usuário (flask user add <usuario>) e remova-o: flask user remove admin"
)


class UserError(ValueError):
    """Invalid user operation; the message is shown to the person running the command."""


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _scrypt(password: str, salt: bytes, length: int) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=length, maxmem=64 * 1024 * 1024)


def hash_password(password: str) -> str:
    """Hashes a password as scrypt$<salt>$<hash> (base64url, no padding)."""
    salt = os.urandom(SALT_BYTES)
    return f"scrypt${_b64url_encode(salt)}${_b64url_encode(_scrypt(str(password), salt, SCRYPT_KEYLEN))}"


def verify_password(password: str, stored: str | None) -> bool:
    """Constant-time check of a password against a stored hash."""
    parts = str(stored or "").split("$")
    if len(parts) != 3 or parts[0] != "scrypt":
        return False
    try:
        salt = _b64url_decode(parts[1])
        expected = _b64url_decode(parts[2])
    except ValueError:
        return False
    if not expected:
        return False
    return hmac.compare_digest(_scrypt(str(password), salt, len(expected)), expected)


def _assert_valid_username(username: str) -> None:
    if not isinstance(username, str) or not USER_PATTERN.match(username):
        raise UserError('Usuário inválido: use até 64 caracteres entre letras, números, ".", "_", "-" e "@".')


def _assert_strong_password(password: str) -> None:
    if not isinstance(password, str) or len(password) < MIN_PASSWORD_LENGTH:
        raise UserError(f"Senha muito curta: use pelo menos {MIN_PASSWORD_LENGTH} caracteres.")


def count_users() -> int:
    return db.session.scalar(select(func.count()).select_from(User))


def list_users() -> list[User]:
    return list(db.session.scalars(select(User).order_by(User.username)))


def get_password_hash(username: str) -> str | None:
    """Stored password hash, or None when the user does not exist."""
    return db.session.scalar(select(User.password_hash).where(User.username == username))


def create_user(username: str, password: str, *, allow_weak_password: bool = False) -> None:
    """Creates a user (weak passwords only for the development admin)."""
    _assert_valid_username(username)
    if not allow_weak_password:
        _assert_strong_password(password)
    if get_password_hash(username):
        raise UserError(f'O usuário "{username}" já existe.')
    now = utc_now_iso()
    db.session.add(User(username=username, password_hash=hash_password(password), created_at=now, updated_at=now))
    db.session.commit()


def set_password(username: str, password: str) -> None:
    """Changes the password and ends every open session of the user."""
    _assert_strong_password(password)
    user = db.session.get(User, username)
    if user is None:
        raise UserError(f'O usuário "{username}" não existe.')
    user.password_hash = hash_password(password)
    user.updated_at = utc_now_iso()
    db.session.execute(delete(Session).where(Session.username == username))
    db.session.commit()


def remove_user(username: str) -> None:
    """Removes the user; sessions and favorites go with it (ON DELETE CASCADE)."""
    result = db.session.execute(delete(User).where(User.username == username))
    if not result.rowcount:
        db.session.rollback()
        raise UserError(f'O usuário "{username}" não existe.')
    db.session.commit()


def ensure_users(production: bool) -> str:
    """Guarantees at least one user.

    Development gets admin/admin; production refuses to start without users or
    with the development admin/admin still in the database.
    Returns what was done ("existing" or "dev-admin").
    """
    if count_users():
        # banco copiado do desenvolvimento: o admin/admin local não pode ir para produção
        if production and verify_password("admin", get_password_hash("admin")):
            raise UserError(DEV_ADMIN_MESSAGE)
        return "existing"
    if production:
        raise UserError(NO_USERS_MESSAGE)
    create_user("admin", "admin", allow_weak_password=True)
    logger.warning("[auth] banco sem usuários: criado admin/admin apenas para desenvolvimento local.")
    return "dev-admin"
