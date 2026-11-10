"""Validation of a client sent by the screen (camelCase fields)."""

import re
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from app.modules.clients.documents import document_kind, normalize

REGIMES = {"simples", "mei", "presumido", "real", "imune_isenta", "pessoa_fisica"}
STATUSES = {"ativo", "inativo"}
STATES = set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split())

# campo da tela -> (coluna, rótulo, limite de caracteres); a tela usa os mesmos limites
TEXT_FIELDS = {
    "name": ("name", "Razão social / nome", 200),
    "tradeName": ("trade_name", "Nome fantasia", 200),
    "city": ("city", "Município", 100),
    "stateRegistration": ("state_registration", "Inscrição estadual", 30),
    "municipalRegistration": ("municipal_registration", "Inscrição municipal", 30),
    "contactName": ("contact_name", "Responsável", 120),
    "email": ("email", "E-mail", 200),
    "phone": ("phone", "Telefone", 30),
    "notes": ("notes", "Observações", 2000),
}
MAX_FEE = Decimal("100000000")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class ClientError(ValueError):
    """Invalid client; the message is shown on the screen."""


def _text(value: Any, label: str, limit: int) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ClientError(f"{label} inválido")
    value = value.strip()
    if len(value) > limit:
        raise ClientError(f"{label}: até {limit} caracteres")
    return value or None


def _fee_cents(value: Any) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool) or not isinstance(value, int | float | str):
        raise ClientError("Honorário mensal inválido")
    try:
        amount = Decimal(str(value))
    except InvalidOperation as err:
        raise ClientError("Honorário mensal inválido") from err
    if not amount.is_finite() or amount < 0 or amount >= MAX_FEE or amount != amount.quantize(Decimal("0.01")):
        raise ClientError("Honorário mensal inválido")
    return int(amount * 100)


def _start_date(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str) or not _ISO_DATE.match(value):
        raise ClientError("Data de início inválida")
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as err:
        raise ClientError("Data de início inválida") from err


def parse_client(data: Any) -> dict[str, Any]:
    """Column values of a client, or ClientError with the first problem found."""
    if not isinstance(data, dict):
        raise ClientError("Cliente inválido")

    raw_document = data.get("document")
    document = normalize(raw_document) if isinstance(raw_document, str) else ""
    kind = document_kind(document)
    if not kind:
        raise ClientError("CPF ou CNPJ inválido")

    values: dict[str, Any] = {"document": document}
    for field, (column, label, limit) in TEXT_FIELDS.items():
        values[column] = _text(data.get(field), label, limit)
    if not values["name"]:
        raise ClientError("Informe a razão social ou o nome do cliente")
    if values["email"] and not _EMAIL.match(values["email"]):
        raise ClientError("E-mail inválido")

    regime = data.get("regime")
    if regime not in REGIMES:
        raise ClientError("Regime tributário inválido")
    if kind == "pf" and regime != "pessoa_fisica":
        raise ClientError("Cliente com CPF usa o regime Pessoa Física")
    if kind == "pj" and regime == "pessoa_fisica":
        raise ClientError("Cliente com CNPJ não pode usar o regime Pessoa Física")

    status = data.get("status", "ativo")
    if status not in STATUSES:
        raise ClientError("Situação inválida")

    state = data.get("state") or None
    if state is not None and state not in STATES:
        raise ClientError("UF inválida")

    values.update(
        regime=regime,
        status=status,
        state=state,
        monthly_fee_cents=_fee_cents(data.get("monthlyFee")),
        start_date=_start_date(data.get("startDate")),
    )
    return values
