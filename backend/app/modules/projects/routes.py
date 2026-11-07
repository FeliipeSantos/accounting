"""HTTP routes of the Portal de Projetos, mounted at /api/projects.

    GET    /api/projects       -> all projects, in display order
    PUT    /api/projects/<id>  -> creates or updates ONE project
    DELETE /api/projects/<id>  -> removes one project

Saving one project at a time means two people editing different projects
never overwrite each other. The session and JSON content type are checked
before these routes (app.core.http).
"""

import json

from flask import Blueprint, Response, g, request
from werkzeug.exceptions import RequestEntityTooLarge

from app.core.http import json_error, json_response
from app.modules.projects import repository
from app.modules.projects.schemas import validate_project

MAX_BODY_BYTES = 2 * 1024 * 1024

bp = Blueprint("projects", __name__, url_prefix="/api/projects")


def _reject_constant(name: str):
    # NaN e Infinity não são JSON válido (o navegador nunca os envia)
    raise ValueError(f"invalid constant {name}")


@bp.get("")
def list_projects():
    return Response(repository.list_documents_json(), mimetype="application/json")


@bp.put("/<project_id>")
def save_project(project_id: str):
    request.max_content_length = MAX_BODY_BYTES
    try:
        document = json.loads(request.get_data(cache=False) or b"", parse_constant=_reject_constant)
    except ValueError:
        return json_error(400, "JSON inválido")

    if isinstance(document, dict) and "id" not in document:
        document["id"] = project_id
    error = validate_project(document)
    if error:
        return json_error(400, error)
    if document["id"] != project_id:
        return json_error(400, "O identificador do projeto não confere com o endereço")

    result = repository.save_project(document, g.user)
    return json_response({"success": True, "id": project_id, "result": result}, 201 if result == "created" else 200)


@bp.delete("/<project_id>")
def delete_project(project_id: str):
    if not repository.delete_project(project_id):
        return json_error(404, "Projeto não encontrado")
    return json_response({"success": True, "id": project_id})


@bp.errorhandler(RequestEntityTooLarge)
def _too_large(_error):
    return json_error(413, "Projeto muito grande")
