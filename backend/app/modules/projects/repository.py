"""Data access of the Portal de Projetos (table projects_projects).

Each project is stored as one JSON document, in the same shape the screen uses,
encoded like JavaScript's JSON.stringify so both servers read and write the same text.
"""

from typing import Any, Literal

from sqlalchemy import delete, insert, literal, select, update
from sqlalchemy.exc import IntegrityError

from app.core.database import utc_now_iso
from app.core.jsontext import dumps_js
from app.extensions import db
from app.modules.projects.models import Project


def encode_document(document: dict[str, Any]) -> str:
    """JSON text equal to JavaScript's JSON.stringify for the same document."""
    return dumps_js(document)


def list_documents_json() -> str:
    """All projects in display order, as a JSON array of the stored documents."""
    rows = db.session.scalars(select(Project.data).order_by(Project.position, Project.created_at))
    return f"[{','.join(rows)}]"


def save_project(document: dict[str, Any], user: str | None) -> Literal["created", "updated"]:
    """Creates or updates one project; new projects go to the end of the list."""
    now = utc_now_iso()
    data = encode_document(document)
    project_id = document["id"]

    def update_existing() -> bool:
        result = db.session.execute(
            update(Project).where(Project.id == project_id).values(name=document["name"], data=data, updated_at=now, updated_by=user)
        )
        return bool(result.rowcount)

    if update_existing():
        db.session.commit()
        return "updated"

    # posição calculada no próprio INSERT: dois projetos novos ao mesmo tempo não disputam o valor
    next_position = select(db.func.coalesce(db.func.max(Project.position), -1) + 1).scalar_subquery()
    try:
        db.session.execute(
            insert(Project).from_select(
                ["id", "name", "data", "position", "created_at", "updated_at", "updated_by"],
                select(
                    literal(project_id), literal(document["name"]), literal(data), next_position, literal(now), literal(now), literal(user)
                ),
            )
        )
        db.session.commit()
        return "created"
    except IntegrityError:
        # outra pessoa criou o mesmo projeto no mesmo instante: vira atualização
        db.session.rollback()
        update_existing()
        db.session.commit()
        return "updated"


def delete_project(project_id: str) -> bool:
    """Whether a project was removed."""
    result = db.session.execute(delete(Project).where(Project.id == project_id))
    db.session.commit()
    return bool(result.rowcount)
