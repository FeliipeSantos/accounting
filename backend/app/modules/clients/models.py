"""Gestão Contábil tables (prefix clients_)."""

from sqlalchemy import ForeignKey, ForeignKeyConstraint, Index, Integer, LargeBinary, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class Client(db.Model):
    """One client of the accounting office. `document` is the CPF or CNPJ without punctuation."""

    __tablename__ = "clients_clients"
    __table_args__ = (Index("clients_clients_name", "name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    trade_name: Mapped[str | None] = mapped_column(Text)
    regime: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(Text)
    state_registration: Mapped[str | None] = mapped_column(Text)
    municipal_registration: Mapped[str | None] = mapped_column(Text)
    contact_name: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    # honorário mensal em centavos (sem arredondamento de ponto flutuante)
    monthly_fee_cents: Mapped[int | None] = mapped_column(Integer)
    start_date: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(Text, ForeignKey("core_users.username", ondelete="SET NULL", onupdate="CASCADE"))


class DasGuide(db.Model):
    """Monthly DAS of a MEI client, issued by hand on the PGMEI site: generated and, later, paid.
    No row means the guide of that month is still pending."""

    __tablename__ = "clients_das_guides"

    client_id: Mapped[int] = mapped_column(Integer, ForeignKey("clients_clients.id", ondelete="CASCADE"), primary_key=True)
    # competência (AAAA-MM): o DAS desse mês vence no dia 20 do mês seguinte
    period: Mapped[str] = mapped_column(Text, primary_key=True)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    generated_at: Mapped[str] = mapped_column(Text, nullable=False)
    paid_at: Mapped[str | None] = mapped_column(Text)
    # lidos do PDF da guia, quando ele é enviado
    barcode_line: Mapped[str | None] = mapped_column(Text)
    amount_cents: Mapped[int | None] = mapped_column(Integer)
    due_date: Mapped[str | None] = mapped_column(Text)
    document_number: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(Text, ForeignKey("core_users.username", ondelete="SET NULL", onupdate="CASCADE"))


class ServiceType(db.Model):
    """Kind of work charged to a client (Honorário mensal, Geração de guias, Imposto de renda...).

    The office manages the list. A type already used by a receipt cannot be deleted
    (ON DELETE RESTRICT), only deactivated: it leaves the choices but keeps the history.
    `code` marks the built-in types the screens rely on (e.g. the monthly fee fills the amount).
    """

    __tablename__ = "clients_service_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    code: Mapped[str | None] = mapped_column(Text, unique=True)
    # 1 = aparece na escolha; 0 = desativado (some da escolha, continua no histórico)
    active: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)


class Receipt(db.Model):
    """One entry of a client's account: what was charged for a service and what was received.

    The client's balance is the sum of received minus charged over all entries: positive is
    credit (paid more than charged), negative is still to receive. A client with entries cannot
    be deleted (ON DELETE RESTRICT), so the financial history is never lost.
    """

    __tablename__ = "clients_receipts"
    __table_args__ = (Index("clients_receipts_client", "client_id", "received_on"), Index("clients_receipts_received_on", "received_on"))

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(Integer, ForeignKey("clients_clients.id", ondelete="RESTRICT"), nullable=False)
    received_on: Mapped[str] = mapped_column(Text, nullable=False)
    service_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("clients_service_types.id", ondelete="RESTRICT"), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # competência (AAAA-MM) do serviço, quando faz sentido (ex.: honorário mensal)
    period: Mapped[str | None] = mapped_column(Text)
    charged_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    received_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    method: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(Text, ForeignKey("core_users.username", ondelete="SET NULL", onupdate="CASCADE"))


class DasFile(db.Model):
    """PDF of a DAS guide. Kept in the database (about 100 KB each) so the daily backup and the
    server copy carry it; it goes away with its guide."""

    __tablename__ = "clients_das_files"
    __table_args__ = (
        ForeignKeyConstraint(["client_id", "period"], ["clients_das_guides.client_id", "clients_das_guides.period"], ondelete="CASCADE"),
    )

    client_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period: Mapped[str] = mapped_column(Text, primary_key=True)
    file_name: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    sha256: Mapped[str] = mapped_column(Text, nullable=False)
    uploaded_at: Mapped[str] = mapped_column(Text, nullable=False)
