"""Tipos de serviço: the list of kinds of work the office charges for, managed on the screen.

The list starts with the usual services of an accounting office (DEFAULT_TYPES, created by
the migration) and can be extended, renamed and reordered. A type in use by a receipt is
deactivated instead of deleted, so old receipts keep their service.
"""

from typing import Any

from sqlalchemy import func, select

from app.core.database import utc_now_iso
from app.extensions import db
from app.modules.clients.models import Receipt, ServiceType

# (code, name): code marks the types the screens rely on; the names can be changed
DEFAULT_TYPES = [
    ("honorario_mensal", "Honorário mensal"),
    ("guias", "Geração de guias"),
    ("nota_fiscal", "Emissão de nota fiscal"),
    ("irpf", "Imposto de renda (IRPF)"),
    ("dasn_simei", "Declaração anual do MEI (DASN-SIMEI)"),
    ("abertura", "Abertura de empresa"),
    ("alteracao", "Alteração contratual"),
    ("baixa", "Baixa de empresa"),
    ("regularizacao", "Regularização / parcelamento"),
    ("folha", "Folha de pagamento"),
    ("consultoria", "Consultoria"),
    ("outro", "Outro serviço"),
]
MAX_NAME = 80


class ServiceTypeError(ValueError):
    """Invalid type; the message is shown on the screen."""


class ServiceTypeInUseError(Exception):
    """The type is used by receipts and cannot be deleted."""


def _to_json(service_type: ServiceType, uses: int) -> dict[str, Any]:
    return {
        "id": service_type.id,
        "name": service_type.name,
        "code": service_type.code,
        "active": bool(service_type.active),
        "position": service_type.position,
        "uses": uses,
    }


def list_types() -> list[dict[str, Any]]:
    """Every type (active and not) in display order, with how many receipts use it."""
    uses = select(func.count(Receipt.id)).where(Receipt.service_type_id == ServiceType.id).scalar_subquery()
    rows = db.session.execute(select(ServiceType, uses).order_by(ServiceType.position, ServiceType.id)).all()
    return [_to_json(service_type, count) for service_type, count in rows]


def _name(value: Any, ignore_id: int | None = None) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ServiceTypeError("Informe o nome do tipo de serviço")
    name = " ".join(value.split())
    if len(name) > MAX_NAME:
        raise ServiceTypeError(f"Nome: até {MAX_NAME} caracteres")
    # nomes iguais sem diferenciar maiúsculas (inclusive acentuadas)
    for other_id, other in db.session.execute(select(ServiceType.id, ServiceType.name)).all():
        if other_id != ignore_id and other.casefold() == name.casefold():
            raise ServiceTypeError("Já existe um tipo de serviço com este nome")
    return name


def create_type(body: Any) -> dict[str, Any]:
    name = _name(body.get("name") if isinstance(body, dict) else None)
    now = utc_now_iso()
    last = db.session.scalar(select(func.coalesce(func.max(ServiceType.position), -1)))
    service_type = ServiceType(name=name, active=1, position=last + 1, created_at=now, updated_at=now)
    db.session.add(service_type)
    db.session.commit()
    return _to_json(service_type, 0)


def update_type(type_id: int, body: Any) -> dict[str, Any] | None:
    """Renames and/or (de)activates a type; None when it does not exist."""
    service_type = db.session.get(ServiceType, type_id)
    if service_type is None:
        return None
    if not isinstance(body, dict):
        raise ServiceTypeError("Tipo de serviço inválido")
    if "name" in body:
        service_type.name = _name(body["name"], ignore_id=type_id)
    if "active" in body:
        if not isinstance(body["active"], bool):
            raise ServiceTypeError("Situação inválida")
        service_type.active = int(body["active"])
    service_type.updated_at = utc_now_iso()
    db.session.commit()
    uses = db.session.scalar(select(func.count(Receipt.id)).where(Receipt.service_type_id == type_id))
    return _to_json(service_type, uses)


def delete_type(type_id: int) -> bool:
    """Removes an unused type; ServiceTypeInUseError when receipts use it."""
    service_type = db.session.get(ServiceType, type_id)
    if service_type is None:
        return False
    if db.session.scalar(select(func.count(Receipt.id)).where(Receipt.service_type_id == type_id)):
        raise ServiceTypeInUseError
    db.session.delete(service_type)
    db.session.commit()
    return True


def seed_defaults() -> None:
    """Creates the default types on an empty table (tests; real databases get them from the migration)."""
    if db.session.scalar(select(func.count(ServiceType.id))):
        return
    now = utc_now_iso()
    for position, (code, name) in enumerate(DEFAULT_TYPES):
        db.session.add(ServiceType(name=name, code=code, active=1, position=position, created_at=now, updated_at=now))
    db.session.commit()
