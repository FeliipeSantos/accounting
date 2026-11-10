"""HTTP routes of the Gestão Contábil clients, mounted at /api/clients.

    GET    /api/clients       -> all clients, in alphabetical order
    POST   /api/clients       -> creates one client
    PUT    /api/clients/<id>  -> updates one client
    DELETE /api/clients/<id>  -> removes one client (and its DAS control); 409 when it has receipts

    GET    /api/clients/service-types        -> kinds of work, in display order, with their use count
    POST   /api/clients/service-types        -> { name }: adds one
    PUT    /api/clients/service-types/<id>   -> { name?, active? }: renames or (de)activates
    DELETE /api/clients/service-types/<id>   -> removes an unused one; 409 when receipts use it

    GET    /api/clients/receipts?from=&to=&clientId= -> entries (newest first) and every client's balance
    POST   /api/clients/receipts            -> creates one entry
    PUT    /api/clients/receipts/<id>       -> updates one entry
    DELETE /api/clients/receipts/<id>       -> removes one entry

    GET    /api/clients/das?period=AAAA-MM          -> DAS of the MEI clients in one competência
    PUT    /api/clients/das/<client_id>/<AAAA-MM>   -> { status: pendente | gerada | paga }
    POST   /api/clients/das/<client_id>/<AAAA-MM>/pdf -> { content: PDF in base64 }: reads and keeps it
    GET    /api/clients/das/<client_id>/<AAAA-MM>/pdf -> the kept PDF

The session and JSON content type are checked before these routes (app.core.http).
"""

from flask import Blueprint, Response, g, request
from werkzeug.exceptions import RequestEntityTooLarge

from app.core.http import json_error, json_response
from app.modules.clients import das, receipts, repository, service_types
from app.modules.clients.schemas import ClientError, parse_client

NOT_FOUND = "Cliente não encontrado"
RECEIPT_NOT_FOUND = "Lançamento não encontrado"
SERVICE_TYPE_NOT_FOUND = "Tipo de serviço não encontrado"
# PDF de até 1 MB, que em base64 fica com cerca de 1,4 MB
MAX_PDF_BODY_BYTES = 1_500_000
DUPLICATE = "Já existe um cliente com este CPF/CNPJ"

bp = Blueprint("clients", __name__, url_prefix="/api/clients")


def _values():
    return parse_client(request.get_json(silent=True))


@bp.get("")
def list_clients():
    return json_response(repository.list_clients())


@bp.post("")
def create_client():
    try:
        client = repository.create_client(_values(), g.user)
    except ClientError as err:
        return json_error(400, str(err))
    except repository.DuplicateDocumentError:
        return json_error(409, DUPLICATE)
    return json_response(client, 201)


@bp.put("/<int:client_id>")
def update_client(client_id: int):
    try:
        client = repository.update_client(client_id, _values(), g.user)
    except ClientError as err:
        return json_error(400, str(err))
    except repository.DuplicateDocumentError:
        return json_error(409, DUPLICATE)
    if client is None:
        return json_error(404, NOT_FOUND)
    return json_response(client)


@bp.get("/das")
def list_das():
    try:
        return json_response(das.list_guides(request.args.get("period", "")))
    except das.DasError as err:
        return json_error(400, str(err))


@bp.put("/das/<int:client_id>/<period>")
def set_das_status(client_id: int, period: str):
    body = request.get_json(silent=True)
    try:
        guide = das.set_status(client_id, period, body.get("status") if isinstance(body, dict) else None, g.user)
    except das.DasError as err:
        return json_error(400, str(err))
    if guide is None:
        return json_error(404, NOT_FOUND)
    return json_response(guide)


@bp.post("/das/<int:client_id>/<period>/pdf")
def upload_das_pdf(client_id: int, period: str):
    # o PDF vai em base64 dentro do JSON: as escritas só aceitam JSON (proteção CSRF)
    request.max_content_length = MAX_PDF_BODY_BYTES
    try:
        guide = das.attach_pdf(client_id, period, request.get_json(silent=True), g.user)
    except das.DasError as err:
        return json_error(400, str(err))
    if guide is None:
        return json_error(404, NOT_FOUND)
    return json_response(guide)


@bp.get("/das/<int:client_id>/<period>/pdf")
def download_das_pdf(client_id: int, period: str):
    try:
        stored = das.get_pdf(client_id, period)
    except das.DasError as err:
        return json_error(400, str(err))
    if stored is None:
        return json_error(404, "PDF do DAS não encontrado")
    response = Response(stored.content, mimetype="application/pdf")
    response.headers["Content-Disposition"] = f'attachment; filename="{stored.file_name}"'
    response.headers["Cache-Control"] = "private, no-store"
    return response


@bp.errorhandler(RequestEntityTooLarge)
def _too_large(_error):
    return json_error(413, "Arquivo muito grande: o PDF do DAS tem menos de 1 MB")


@bp.delete("/<int:client_id>")
def delete_client(client_id: int):
    try:
        deleted = repository.delete_client(client_id)
    except repository.ClientInUseError:
        return json_error(409, "Este cliente tem recebimentos lançados. Para manter o histórico, marque-o como Inativo.")
    if not deleted:
        return json_error(404, NOT_FOUND)
    return json_response({"success": True, "id": client_id})


@bp.get("/service-types")
def list_service_types():
    return json_response(service_types.list_types())


@bp.post("/service-types")
def create_service_type():
    try:
        return json_response(service_types.create_type(request.get_json(silent=True)), 201)
    except service_types.ServiceTypeError as err:
        return json_error(400, str(err))


@bp.put("/service-types/<int:type_id>")
def update_service_type(type_id: int):
    try:
        service_type = service_types.update_type(type_id, request.get_json(silent=True))
    except service_types.ServiceTypeError as err:
        return json_error(400, str(err))
    if service_type is None:
        return json_error(404, SERVICE_TYPE_NOT_FOUND)
    return json_response(service_type)


@bp.delete("/service-types/<int:type_id>")
def delete_service_type(type_id: int):
    try:
        deleted = service_types.delete_type(type_id)
    except service_types.ServiceTypeInUseError:
        return json_error(409, "Este tipo já foi usado em recebimentos. Desative-o para tirá-lo da lista sem perder o histórico.")
    if not deleted:
        return json_error(404, SERVICE_TYPE_NOT_FOUND)
    return json_response({"success": True, "id": type_id})


@bp.get("/receipts")
def list_receipts():
    raw_client = request.args.get("clientId")
    try:
        client_id = int(raw_client) if raw_client else None
        return json_response(receipts.list_receipts(request.args.get("from"), request.args.get("to"), client_id))
    except ValueError as err:
        message = str(err) if isinstance(err, receipts.ReceiptError) else "Cliente inválido"
        return json_error(400, message)


@bp.post("/receipts")
def create_receipt():
    try:
        return json_response(receipts.create_receipt(request.get_json(silent=True), g.user), 201)
    except receipts.ReceiptError as err:
        return json_error(400, str(err))


@bp.put("/receipts/<int:receipt_id>")
def update_receipt(receipt_id: int):
    try:
        receipt = receipts.update_receipt(receipt_id, request.get_json(silent=True), g.user)
    except receipts.ReceiptError as err:
        return json_error(400, str(err))
    if receipt is None:
        return json_error(404, RECEIPT_NOT_FOUND)
    return json_response(receipt)


@bp.delete("/receipts/<int:receipt_id>")
def delete_receipt(receipt_id: int):
    if not receipts.delete_receipt(receipt_id):
        return json_error(404, RECEIPT_NOT_FOUND)
    return json_response({"success": True, "id": receipt_id})
