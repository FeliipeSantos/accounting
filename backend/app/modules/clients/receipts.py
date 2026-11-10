"""Recebimentos: what each client was charged for each service and what was received.

Every entry has a charged and a received amount. The client's balance is received minus
charged over all entries: a payment above the amount charged stays as credit, and a later
charge with a smaller payment uses that credit up. Amounts are kept in cents.
"""

import re
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import func, select

from app.core.database import utc_now_iso
from app.extensions import db
from app.modules.clients.models import Client, Receipt, ServiceType

METHODS = {"pix", "transferencia", "boleto", "dinheiro", "cartao", "outro"}
MAX_AMOUNT = Decimal("100000000")
LIMITS = {"description": ("Descrição", 200), "notes": ("Observações", 1000)}
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_PERIOD = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


class ReceiptError(ValueError):
    """Invalid entry; the message is shown on the screen."""


def _cents(value: Any, label: str) -> int:
    if value is None or value == "":
        return 0
    if isinstance(value, bool) or not isinstance(value, int | float | str):
        raise ReceiptError(f"{label} inválido")
    try:
        amount = Decimal(str(value))
    except InvalidOperation as err:
        raise ReceiptError(f"{label} inválido") from err
    if not amount.is_finite() or amount < 0 or amount >= MAX_AMOUNT or amount != amount.quantize(Decimal("0.01")):
        raise ReceiptError(f"{label} inválido")
    return int(amount * 100)


def _date(value: Any, label: str) -> str:
    if not isinstance(value, str) or not _ISO_DATE.match(value):
        raise ReceiptError(f"{label} inválida")
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as err:
        raise ReceiptError(f"{label} inválida") from err


def _text(data: dict, field: str) -> str | None:
    label, limit = LIMITS[field]
    value = data.get(field)
    if value is None:
        return None
    if not isinstance(value, str):
        raise ReceiptError(f"{label} inválida")
    value = value.strip()
    if len(value) > limit:
        raise ReceiptError(f"{label}: até {limit} caracteres")
    return value or None


def parse_receipt(data: Any, current_type_id: int | None = None) -> dict[str, Any]:
    """Column values of an entry, or ReceiptError with the first problem found.

    `current_type_id` is the type the entry already has (when editing): it stays valid even
    if it was deactivated since, so old entries can still be corrected."""
    if not isinstance(data, dict):
        raise ReceiptError("Lançamento inválido")
    client_id = data.get("clientId")
    if not isinstance(client_id, int) or isinstance(client_id, bool) or db.session.get(Client, client_id) is None:
        raise ReceiptError("Escolha o cliente")
    type_id = data.get("serviceTypeId")
    service_type = db.session.get(ServiceType, type_id) if isinstance(type_id, int) and not isinstance(type_id, bool) else None
    if service_type is None or (not service_type.active and type_id != current_type_id):
        raise ReceiptError("Escolha o tipo de serviço")
    description = _text(data, "description")
    if service_type.code == "outro" and not description:
        raise ReceiptError("Descreva o serviço")
    period = data.get("period") or None
    if period is not None and (not isinstance(period, str) or not _PERIOD.match(period)):
        raise ReceiptError("Competência inválida")
    method = data.get("method") or None
    if method is not None and method not in METHODS:
        raise ReceiptError("Forma de pagamento inválida")
    charged = _cents(data.get("charged"), "Valor cobrado")
    received = _cents(data.get("received"), "Valor recebido")
    if charged == 0 and received == 0:
        raise ReceiptError("Informe o valor cobrado ou o valor recebido")
    return {
        "client_id": client_id,
        "received_on": _date(data.get("receivedOn"), "Data"),
        "service_type_id": service_type.id,
        "description": description,
        "period": period,
        "charged_cents": charged,
        "received_cents": received,
        "method": method,
        "notes": _text(data, "notes"),
    }


def _to_json(receipt: Receipt, client_name: str, service_type: ServiceType) -> dict[str, Any]:
    return {
        "id": receipt.id,
        "clientId": receipt.client_id,
        "clientName": client_name,
        "receivedOn": receipt.received_on,
        "serviceTypeId": receipt.service_type_id,
        "serviceName": service_type.name,
        "serviceCode": service_type.code,
        "description": receipt.description,
        "period": receipt.period,
        "charged": receipt.charged_cents / 100,
        "received": receipt.received_cents / 100,
        "difference": (receipt.received_cents - receipt.charged_cents) / 100,
        "method": receipt.method,
        "notes": receipt.notes,
        "createdAt": receipt.created_at,
        "updatedAt": receipt.updated_at,
    }


def balances() -> list[dict[str, Any]]:
    """Balance of every client with entries (received minus charged, all time), by name."""
    rows = db.session.execute(
        select(
            Client.id,
            Client.name,
            func.sum(Receipt.charged_cents),
            func.sum(Receipt.received_cents),
        )
        .join(Receipt, Receipt.client_id == Client.id)
        .group_by(Client.id, Client.name)
        .order_by(func.lower(Client.name))
    ).all()
    return [
        {"clientId": cid, "name": name, "charged": charged / 100, "received": received / 100, "balance": (received - charged) / 100}
        for cid, name, charged, received in rows
    ]


def list_receipts(date_from: str | None, date_to: str | None, client_id: int | None) -> dict[str, Any]:
    """Entries in the period (newest first) and every client's balance."""
    query = (
        select(Receipt, Client.name, ServiceType)
        .join(Client, Client.id == Receipt.client_id)
        .join(ServiceType, ServiceType.id == Receipt.service_type_id)
    )
    if date_from:
        query = query.where(Receipt.received_on >= _date(date_from, "Data inicial"))
    if date_to:
        query = query.where(Receipt.received_on <= _date(date_to, "Data final"))
    if client_id is not None:
        query = query.where(Receipt.client_id == client_id)
    rows = db.session.execute(query.order_by(Receipt.received_on.desc(), Receipt.id.desc())).all()
    return {"items": [_to_json(receipt, name, service_type) for receipt, name, service_type in rows], "balances": balances()}


def _saved_json(receipt: Receipt) -> dict[str, Any]:
    return _to_json(receipt, db.session.get(Client, receipt.client_id).name, db.session.get(ServiceType, receipt.service_type_id))


def create_receipt(body: Any, user: str | None) -> dict[str, Any]:
    values = parse_receipt(body)
    now = utc_now_iso()
    receipt = Receipt(**values, created_at=now, updated_at=now, updated_by=user)
    db.session.add(receipt)
    db.session.commit()
    return _saved_json(receipt)


def update_receipt(receipt_id: int, body: Any, user: str | None) -> dict[str, Any] | None:
    """The updated entry, or None when it does not exist."""
    receipt = db.session.get(Receipt, receipt_id)
    if receipt is None:
        return None
    values = parse_receipt(body, current_type_id=receipt.service_type_id)
    for column, value in values.items():
        setattr(receipt, column, value)
    receipt.updated_at = utc_now_iso()
    receipt.updated_by = user
    db.session.commit()
    return _saved_json(receipt)


def delete_receipt(receipt_id: int) -> bool:
    receipt = db.session.get(Receipt, receipt_id)
    if receipt is None:
        return False
    db.session.delete(receipt)
    db.session.commit()
    return True
