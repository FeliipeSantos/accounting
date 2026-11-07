"""Settings read from environment variables (see .env.example)."""

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
EXPECTED_TIMEZONE = "America/Sao_Paulo"


@dataclass(frozen=True)
class Settings:
    """Runtime settings of the application."""

    db_path: Path
    production: bool
    host: str | None
    port: int
    session_ttl_hours: float
    cookie_secure: bool
    trust_proxy: bool
    timezone: str | None
    backup_dir: Path | None
    backup_keep: int

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> "Settings":
        env = os.environ if env is None else env
        # APP_ENV; NODE_ENV continua aceito para .env criados na época do servidor Node
        production = (env.get("APP_ENV") or env.get("NODE_ENV")) == "production"
        cookie_flag = env.get("COOKIE_SECURE")
        db_path = Path(env.get("DB_PATH") or PROJECT_ROOT / "data" / "app.db")
        backup_dir = env.get("BACKUP_DIR")
        return cls(
            db_path=db_path if db_path.is_absolute() else (PROJECT_ROOT / db_path),
            production=production,
            host=env.get("HOST") or None,
            port=int(env.get("PORT", "8080")),
            session_ttl_hours=_positive_float(env.get("SESSION_TTL_HOURS"), 8),
            cookie_secure=cookie_flag == "true" or (production and cookie_flag != "false"),
            trust_proxy=env.get("TRUST_PROXY") == "true",
            timezone=env.get("TZ") or None,
            backup_dir=Path(backup_dir) if backup_dir else None,
            backup_keep=max(int(_positive_float(env.get("BACKUP_KEEP"), 7)), 1),
        )


def _positive_float(value: str | None, default: float) -> float:
    try:
        number = float(value) if value else 0
    except ValueError:
        number = 0
    return number if number > 0 else default
