"""Shared Flask extensions."""

from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Tabela de controle da versão anterior (Node), presente nos bancos criados por ela:
# fica fora do Alembic.
LEGACY_MIGRATIONS_TABLE = "schema_migrations"


def include_object(obj, name, type_, reflected, compare_to):
    """Keeps tables the models do not own out of Alembic's autogenerate."""
    return not (type_ == "table" and name == LEGACY_MIGRATIONS_TABLE)


migrate = Migrate(render_as_batch=True, compare_type=True, include_object=include_object)
