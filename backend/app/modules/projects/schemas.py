"""Validation of a project document.

The document is free-form (activities, sub-activities, kanban...); only the fields
below have rules. Unknown fields are kept untouched.
"""

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError, field_validator

ID_PATTERN = r"^[A-Za-z0-9_-]{1,100}$"
MAX_NAME_LENGTH = 300

INVALID_PROJECT = "Projeto inválido"
# Mensagens em ordem de prioridade (o primeiro erro vence)
FIELD_MESSAGES = {
    "id": "Identificador do projeto inválido",
    "name": f"O projeto precisa de um nome (até {MAX_NAME_LENGTH} caracteres)",
    "activities": "Atividades do projeto inválidas",
}


class ProjectDocument(BaseModel):
    """Rules of a project document; extra fields are allowed and not checked."""

    model_config = ConfigDict(extra="allow", strict=True)

    id: Annotated[str, StringConstraints(pattern=ID_PATTERN)]
    name: str
    # ausente é válido; presente (mesmo null) precisa ser uma lista
    activities: list[Any] = Field(default=None)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        if not value.strip() or len(value) > MAX_NAME_LENGTH:
            raise ValueError("invalid name")
        return value


def validate_project(document: Any) -> str | None:
    """Returns the error message for an invalid project, or None when it is valid."""
    if not isinstance(document, dict):
        return INVALID_PROJECT
    try:
        ProjectDocument.model_validate(document)
    except ValidationError as err:
        failed = {str(error["loc"][0]) for error in err.errors() if error["loc"]}
        for field, message in FIELD_MESSAGES.items():
            if field in failed:
                return message
        return INVALID_PROJECT
    return None
