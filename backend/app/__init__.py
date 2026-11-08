"""Project Accounting backend (Flask)."""

import logging

from dotenv import load_dotenv
from flask import Flask
from sqlalchemy import inspect

from app.config import EXPECTED_TIMEZONE, PROJECT_ROOT, Settings

# O .env fica na raiz do projeto
load_dotenv(PROJECT_ROOT / ".env", override=False)

logger = logging.getLogger(__name__)


class StartupError(RuntimeError):
    """The server must not start; the message tells the operator what to do."""


def create_app(settings: Settings | None = None) -> Flask:
    """Builds the application. It does not touch the database schema or the users."""
    from app.core import auth, cli, database, notifications  # noqa: F401  (database registra os PRAGMAs)
    from app.core.http import init_http
    from app.extensions import db, migrate
    from app.modules import register_modules

    settings = settings or Settings.from_env()
    app = Flask(__name__)
    app.config.update(
        SETTINGS=settings,
        SQLALCHEMY_DATABASE_URI=f"sqlite:///{settings.db_path.as_posix()}",
    )
    app.extensions["login_throttle"] = auth.LoginThrottle()

    db.init_app(app)
    migrate.init_app(app, db, directory=str(PROJECT_ROOT / "backend" / "migrations"))
    init_http(app)
    app.register_blueprint(auth.bp)
    app.register_blueprint(notifications.bp)
    register_modules(app)
    cli.register_commands(app)
    return app


def check_startup(app: Flask) -> None:
    """Checks done before serving requests: schema present and a valid user.

    Raises StartupError with the action the operator must take.
    """
    from app.core.users import UserError, ensure_users
    from app.extensions import db

    settings: Settings = app.config["SETTINGS"]
    with app.app_context():
        if "core_users" not in inspect(db.engine).get_table_names():
            # as migrations do Alembic são aplicadas manualmente pela equipe
            raise StartupError(f"O banco {settings.db_path} não tem as tabelas do sistema. Aplique as migrations com: flask db upgrade")
        try:
            ensure_users(settings.production)
        except UserError as err:
            raise StartupError(str(err)) from err

    if settings.timezone != EXPECTED_TIMEZONE:
        logger.warning("[server] TZ não é %s; a coleta diária e o backup usarão o fuso do sistema.", EXPECTED_TIMEZONE)
    if settings.production and not settings.host:
        logger.warning("[server] produção sem HOST definido: use HOST=127.0.0.1 atrás do Nginx.")
