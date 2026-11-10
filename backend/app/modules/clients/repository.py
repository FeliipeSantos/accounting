"""Data access of the Gestão Contábil clients (table clients_clients)."""

from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app.core.database import utc_now_iso
from app.extensions import db
from app.modules.clients.models import Client


class DuplicateDocumentError(Exception):
    """Another client already has this CPF/CNPJ."""


class ClientInUseError(Exception):
    """The client has receipts; deleting it would lose the financial history."""


def to_json(client: Client) -> dict[str, Any]:
    fee = client.monthly_fee_cents
    return {
        "id": client.id,
        "document": client.document,
        "kind": "pf" if len(client.document) == 11 else "pj",
        "name": client.name,
        "tradeName": client.trade_name,
        "regime": client.regime,
        "status": client.status,
        "state": client.state,
        "city": client.city,
        "stateRegistration": client.state_registration,
        "municipalRegistration": client.municipal_registration,
        "contactName": client.contact_name,
        "email": client.email,
        "phone": client.phone,
        "monthlyFee": None if fee is None else fee / 100,
        "startDate": client.start_date,
        "notes": client.notes,
        "createdAt": client.created_at,
        "updatedAt": client.updated_at,
    }


def list_clients() -> list[dict[str, Any]]:
    """All clients in alphabetical order."""
    rows = db.session.scalars(select(Client).order_by(func.lower(Client.name), Client.id))
    return [to_json(row) for row in rows]


def _commit_or_duplicate() -> None:
    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise DuplicateDocumentError from err


def create_client(values: dict[str, Any], user: str | None) -> dict[str, Any]:
    now = utc_now_iso()
    client = Client(**values, created_at=now, updated_at=now, updated_by=user)
    db.session.add(client)
    _commit_or_duplicate()
    return to_json(client)


def update_client(client_id: int, values: dict[str, Any], user: str | None) -> dict[str, Any] | None:
    """The updated client, or None when it does not exist."""
    client = db.session.get(Client, client_id)
    if client is None:
        return None
    for column, value in values.items():
        setattr(client, column, value)
    client.updated_at = utc_now_iso()
    client.updated_by = user
    _commit_or_duplicate()
    return to_json(client)


def delete_client(client_id: int) -> bool:
    """Whether a client was removed; ClientInUseError when it has receipts (ON DELETE RESTRICT)."""
    try:
        result = db.session.execute(delete(Client).where(Client.id == client_id))
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ClientInUseError from err
    return bool(result.rowcount)
