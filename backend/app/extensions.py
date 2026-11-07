"""Shared Flask extensions."""

from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Tabela de controle das migrations do servidor Node: fica fora do Alembic
# enquanto as duas versões convivem (etapas 1 a 5 da migração).
NODE_MIGRATIONS_TABLE = "schema_migrations"


def include_object(obj, name, type_, reflected, compare_to):
    """Keeps tables the models do not own out of Alembic's autogenerate."""
    return not (type_ == "table" and name == NODE_MIGRATIONS_TABLE)


migrate = Migrate(render_as_batch=True, compare_type=True, include_object=include_object)
