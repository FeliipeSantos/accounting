"""Calendário tables (prefix reforma_): documents, their versions and the sync log.

A document is one official item (a Nota Técnica, a resolution, a protocol, a news item, a
monitored page). Each change of its content (new version label, new file, new text) is a new
version; earlier versions are never overwritten, so the history is kept.
"""

from sqlalchemy import ForeignKey, Index, Integer, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class Document(db.Model):
    """One official item, identified by its source and the source's own key."""

    __tablename__ = "reforma_documents"
    __table_args__ = (
        UniqueConstraint("source_id", "external_id"),
        Index("reforma_documents_published", "published_at"),
        Index("reforma_documents_updated", "updated_at"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    source_id: Mapped[str] = mapped_column(Text, nullable=False)
    external_id: Mapped[str] = mapped_column(Text, nullable=False)
    # nota-tecnica, resolucao, comunicado, noticia, aviso, protocolo, norma, proposta, pagina
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    published_at: Mapped[str | None] = mapped_column(Text)
    # situação informada pela própria fonte (ex.: "vigente" / "não vigente" nas NTs da NF-e)
    source_status: Mapped[str | None] = mapped_column(Text)
    current_version_id: Mapped[str | None] = mapped_column(Text)
    version_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    first_seen_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)
    last_checked_at: Mapped[str] = mapped_column(Text, nullable=False)
    # título + resumo sem acentos e em minúsculas, para a busca
    search_text: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))


class DocumentVersion(db.Model):
    """One version of a document's content; analysis (next stage) runs per version."""

    __tablename__ = "reforma_document_versions"
    __table_args__ = (
        UniqueConstraint("document_id", "content_hash"),
        Index("reforma_versions_document", "document_id", "detected_at"),
        Index("reforma_versions_analysis", "analysis_status"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    document_id: Mapped[str] = mapped_column(Text, ForeignKey("reforma_documents.id", ondelete="CASCADE"), nullable=False)
    # rótulo da própria fonte (ex.: "v1.53"); nulo quando a fonte não versiona
    version_label: Mapped[str | None] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    published_at: Mapped[str | None] = mapped_column(Text)
    # texto completo: da página, do PDF ou do texto já lido pelo módulo Publicações
    full_text: Mapped[str | None] = mapped_column(Text)
    file_url: Mapped[str | None] = mapped_column(Text)
    # arquivo oficial baixado (PDF): caminho relativo à pasta de arquivos e seu SHA-256
    file_path: Mapped[str | None] = mapped_column(Text)
    file_sha256: Mapped[str | None] = mapped_column(Text)
    # none (sem arquivo), pending, ok, error, skipped (fora da janela de download)
    file_status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'none'"))
    file_error: Mapped[str | None] = mapped_column(Text)
    # pending (aguarda a análise da próxima etapa), done, error, skipped
    analysis_status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'pending'"))
    # pending (datas ainda não extraídas por regras), done
    events_status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'pending'"))
    detected_at: Mapped[str] = mapped_column(Text, nullable=False)
    run_id: Mapped[str | None] = mapped_column(Text)


class SyncRun(db.Model):
    """One synchronization of the monitored sources."""

    __tablename__ = "reforma_sync_runs"
    __table_args__ = (Index("reforma_sync_runs_started", "started_at"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    trigger: Mapped[str] = mapped_column(Text, nullable=False)
    requested_by: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[str] = mapped_column(Text, nullable=False)
    finished_at: Mapped[str | None] = mapped_column(Text)
    # running, success, partial, failed
    status: Mapped[str] = mapped_column(Text, nullable=False)
    new_documents: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    new_versions: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    files_downloaded: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    error: Mapped[str | None] = mapped_column(Text)


class SyncSource(db.Model):
    """Result of one source in one synchronization (the per-source log)."""

    __tablename__ = "reforma_sync_sources"
    __table_args__ = (Index("reforma_sync_sources_source", "source_id", "checked_at"),)

    run_id: Mapped[str] = mapped_column(Text, ForeignKey("reforma_sync_runs.id", ondelete="CASCADE"), primary_key=True)
    source_id: Mapped[str] = mapped_column(Text, primary_key=True)
    checked_at: Mapped[str] = mapped_column(Text, nullable=False)
    # success, error
    status: Mapped[str] = mapped_column(Text, nullable=False)
    fetched: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    new_documents: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    new_versions: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    error: Mapped[str | None] = mapped_column(Text)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))


class Event(db.Model):
    """One date of the calendar, taken from a document version, always with its literal quote.

    origin: "regra" (extracted by rules), "ia" (next stage) or "manual". A new version of the
    document regenerates its events; those that no longer appear become "substituido" (kept,
    with history), never deleted.
    """

    __tablename__ = "reforma_events"
    __table_args__ = (
        Index("reforma_events_date", "event_date"),
        Index("reforma_events_document", "document_id"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    document_id: Mapped[str] = mapped_column(Text, ForeignKey("reforma_documents.id", ondelete="CASCADE"), nullable=False)
    version_id: Mapped[str | None] = mapped_column(Text)
    # documento + tipo + data: a mesma data do mesmo tipo é o mesmo evento entre versões
    event_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    # publicacao, vigencia, producao, homologacao, prazo, opcao, obrigatoriedade
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    event_date: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    # trecho literal do documento que sustenta a data
    quote: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    # confirmada (texto oficial) ou previsao (notícia, "previsto")
    date_status: Mapped[str] = mapped_column(Text, nullable=False)
    # nota sobre a data (ex.: ano deduzido da data do aviso)
    date_note: Mapped[str | None] = mapped_column(Text)
    legal_status: Mapped[str] = mapped_column(Text, nullable=False)
    # critico, alto, medio, informativo
    importance: Mapped[str] = mapped_column(Text, nullable=False)
    origin: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'regra'"))
    # ativo, substituido
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'ativo'"))
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)


class EventHistory(db.Model):
    """Every change of an event (created, updated, superseded), with what it was before."""

    __tablename__ = "reforma_event_history"
    __table_args__ = (Index("reforma_event_history_event", "event_id", "changed_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(Text, ForeignKey("reforma_events.id", ondelete="CASCADE"), nullable=False)
    changed_at: Mapped[str] = mapped_column(Text, nullable=False)
    # criado, atualizado, substituido
    change: Mapped[str] = mapped_column(Text, nullable=False)
    version_id: Mapped[str | None] = mapped_column(Text)
    # estado anterior do evento (JSON), quando havia
    before: Mapped[str | None] = mapped_column(Text)
