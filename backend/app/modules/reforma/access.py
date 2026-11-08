"""Who may use the module: personal tool, restricted to the users in REFORMA_USERS.

REFORMA_USERS=felipe            one user (comma-separated for more)
(unset) in development          every user (only the local admin exists)
(unset) in production           nobody, with a warning in the log
"""

import logging
import os

from flask import current_app

logger = logging.getLogger(__name__)
_warned = False


def allowed_users(env: dict[str, str] | None = None) -> set[str] | None:
    """Usernames allowed, or None when the variable is unset (decided by the environment)."""
    raw = (env if env is not None else os.environ).get("REFORMA_USERS")
    if raw is None or not raw.strip():
        return None
    return {name.strip() for name in raw.split(",") if name.strip()}


def can_access(user: str | None) -> bool:
    global _warned
    if not user:
        return False
    users = allowed_users()
    if users is not None:
        return user in users
    production = current_app.config["SETTINGS"].production
    if production and not _warned:
        _warned = True
        logger.warning("[reforma] REFORMA_USERS não definido: o módulo Calendário fica inacessível em produção.")
    return not production
