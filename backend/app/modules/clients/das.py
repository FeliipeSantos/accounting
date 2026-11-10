"""Geração de DAS (assisted): monthly control of the DAS of the MEI clients.

The guide itself is issued by the user on the PGMEI site (it has a captcha, so it is never
automated); here each client gets, per competência, the state pendente -> gerada -> paga.
"""

import base64
import binascii
import hashlib
import re
from datetime import date
from typing import Any

from sqlalchemy import delete, func, or_, select

from app.core.database import utc_now_iso
from app.extensions import db
from app.modules.clients.das_pdf import DasPdfError, read_das_pdf
from app.modules.clients.models import Client, DasFile, DasGuide
from app.modules.reforma.recurring import due_date

STATUSES = {"pendente", "gerada", "paga"}
_PERIOD = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")
# mesma regra do Calendário: dia 20 do mês seguinte, adiado para o dia útil seguinte
DUE_RULE = ("day", 20, "after")


class DasError(ValueError):
    """Invalid request; the message is shown on the screen."""


def parse_period(value: Any) -> tuple[int, int]:
    match = _PERIOD.match(value) if isinstance(value, str) else None
    if not match:
        raise DasError("Competência inválida (use AAAA-MM)")
    return int(match[1]), int(match[2])


def period_due_date(year: int, month: int) -> tuple[date, str | None]:
    """Due date of the DAS of one competência (the 20th of the next month, or the next business day)."""
    next_year, next_month = (year + 1, 1) if month == 12 else (year, month + 1)
    return due_date(DUE_RULE, next_year, next_month)


def list_guides(period: str) -> dict[str, Any]:
    """Active MEI clients and any client that already has a guide in the period (history is kept
    even if the client later left MEI or became inactive), in alphabetical order."""
    year, month = parse_period(period)
    due, note = period_due_date(year, month)
    has_pdf = select(DasFile.client_id).where(DasFile.client_id == Client.id, DasFile.period == period).exists()
    rows = db.session.execute(
        select(Client, DasGuide, has_pdf)
        .outerjoin(DasGuide, (DasGuide.client_id == Client.id) & (DasGuide.period == period))
        .where(or_(DasGuide.client_id.is_not(None), (Client.regime == "mei") & (Client.status == "ativo")))
        .order_by(func.lower(Client.name), Client.id)
    ).all()
    items = [
        {
            "clientId": client.id,
            "name": client.name,
            "tradeName": client.trade_name,
            "document": client.document,
            "regime": client.regime,
            "clientStatus": client.status,
            **_guide_json(guide, pdf),
        }
        for client, guide, pdf in rows
    ]
    return {"period": period, "dueDate": due.isoformat(), "dueNote": note, "items": items}


def _guide_json(guide: DasGuide | None, has_pdf: bool) -> dict[str, Any]:
    """Guide fields shared by the listing and the updates (no guide means pending)."""
    if guide is None:
        return {
            "status": "pendente",
            "generatedAt": None,
            "paidAt": None,
            "barcodeLine": None,
            "amount": None,
            "dueDate": None,
            "documentNumber": None,
            "hasPdf": False,
        }
    return {
        "status": guide.status,
        "generatedAt": guide.generated_at,
        "paidAt": guide.paid_at,
        "barcodeLine": guide.barcode_line,
        "amount": None if guide.amount_cents is None else guide.amount_cents / 100,
        "dueDate": guide.due_date,
        "documentNumber": guide.document_number,
        "hasPdf": has_pdf,
    }


def set_status(client_id: int, period: str, status: Any, user: str | None) -> dict[str, Any] | None:
    """Updates the guide of one client in one period; None when the client does not exist."""
    parse_period(period)
    if status not in STATUSES:
        raise DasError("Situação inválida")
    if db.session.get(Client, client_id) is None:
        return None

    if status == "pendente":
        # o PDF guardado vai junto (chave estrangeira com ON DELETE CASCADE)
        db.session.execute(delete(DasGuide).where(DasGuide.client_id == client_id, DasGuide.period == period))
        db.session.commit()
        return {"clientId": client_id, "period": period, **_guide_json(None, False)}

    now = utc_now_iso()
    guide = db.session.get(DasGuide, (client_id, period))
    if guide is None:
        guide = DasGuide(client_id=client_id, period=period, generated_at=now)
        db.session.add(guide)
    guide.status = status
    guide.paid_at = (guide.paid_at or now) if status == "paga" else None
    guide.updated_at = now
    guide.updated_by = user
    db.session.commit()
    has_pdf = db.session.get(DasFile, (client_id, period)) is not None
    return {"clientId": client_id, "period": period, **_guide_json(guide, has_pdf)}


def attach_pdf(client_id: int, period: str, body: Any, user: str | None) -> dict[str, Any] | None:
    """Keeps the PDF of the guide issued on the PGMEI, after reading and checking it, and marks the
    guide as generated (a paid guide stays paid). None when the client does not exist."""
    parse_period(period)
    client = db.session.get(Client, client_id)
    if client is None:
        return None
    if not isinstance(body, dict) or not isinstance(body.get("content"), str):
        raise DasError("Envie o PDF do DAS")
    try:
        data = base64.b64decode(body["content"], validate=True)
    except (binascii.Error, ValueError) as err:
        raise DasError("Arquivo inválido") from err
    try:
        info = read_das_pdf(data, client.document, period)
    except DasPdfError as err:
        raise DasError(str(err)) from err

    now = utc_now_iso()
    guide = db.session.get(DasGuide, (client_id, period))
    if guide is None:
        guide = DasGuide(client_id=client_id, period=period, status="gerada", generated_at=now)
        db.session.add(guide)
    guide.barcode_line = info.barcode_line
    guide.amount_cents = info.amount_cents
    guide.due_date = info.due_date
    guide.document_number = info.document_number
    guide.updated_at = now
    guide.updated_by = user
    db.session.flush()

    stored = db.session.get(DasFile, (client_id, period))
    if stored is None:
        stored = DasFile(client_id=client_id, period=period)
        db.session.add(stored)
    stored.file_name = f"DAS-{client.document}-{period}.pdf"
    stored.content = data
    stored.sha256 = hashlib.sha256(data).hexdigest()
    stored.uploaded_at = now
    db.session.commit()
    return {"clientId": client_id, "period": period, **_guide_json(guide, True)}


def get_pdf(client_id: int, period: str) -> DasFile | None:
    parse_period(period)
    return db.session.get(DasFile, (client_id, period))
