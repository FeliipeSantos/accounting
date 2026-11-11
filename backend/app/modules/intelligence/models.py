"""Publicações tables (prefix intel_)."""

from sqlalchemy import ForeignKey, Index, Integer, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class Setting(db.Model):
    """Module settings as key/JSON value: runTime, enabledSources, knownSources, enabledSubjects."""

    __tablename__ = "intel_settings"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)


class SourceStatus(db.Model):
    """Last success and last error of each official source."""

    __tablename__ = "intel_source_status"

    source_id: Mapped[str] = mapped_column(Text, primary_key=True)
    last_success_at: Mapped[str | None] = mapped_column(Text)
    last_error: Mapped[str | None] = mapped_column(Text)
    last_error_at: Mapped[str | None] = mapped_column(Text)


class Run(db.Model):
    """One collection run; `sources` holds the per-source results as JSON."""

    __tablename__ = "intel_runs"
    __table_args__ = (Index("intel_runs_started_at", "started_at"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    trigger: Mapped[str] = mapped_column(Text, nullable=False)
    requested_by: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[str] = mapped_column(Text, nullable=False)
    finished_at: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    new_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    duplicate_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    error: Mapped[str | None] = mapped_column(Text)
    sources: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'[]'"))


class Publication(db.Model):
    """Publication collected from an official source and classified by the rules."""

    __tablename__ = "intel_publications"
    __table_args__ = (
        UniqueConstraint("source_id", "external_id"),
        Index("intel_publications_published", "published_at", "published_time"),
        Index("intel_publications_relevance", "relevance"),
        Index("intel_publications_run", "run_id"),
        Index("intel_publications_hash", "hash"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    source_id: Mapped[str] = mapped_column(Text, nullable=False)
    external_id: Mapped[str] = mapped_column(Text, nullable=False)
    hash: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    published_at: Mapped[str | None] = mapped_column(Text)
    published_time: Mapped[str | None] = mapped_column(Text)
    excerpt: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    act_type: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    organ: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    subjects: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'[]'"))
    relevance: Mapped[str] = mapped_column(Text, nullable=False)
    norm_type: Mapped[str | None] = mapped_column(Text)
    effective_date: Mapped[str | None] = mapped_column(Text)
    classification_reason: Mapped[str | None] = mapped_column(Text)
    collected_at: Mapped[str] = mapped_column(Text, nullable=False)
    # execução que guardou a publicação (sem FK: execuções antigas são podadas)
    run_id: Mapped[str | None] = mapped_column(Text)
    # título + trecho + órgão sem acentos e em minúsculas, para a busca
    search_text: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))


class PublicationSubject(db.Model):
    """Subjects of a publication, in their own table to filter and count by category."""

    __tablename__ = "intel_publication_subjects"
    __table_args__ = (Index("intel_publication_subjects_subject", "subject_id"),)

    publication_id: Mapped[str] = mapped_column(Text, ForeignKey("intel_publications.id", ondelete="CASCADE"), primary_key=True)
    subject_id: Mapped[str] = mapped_column(Text, primary_key=True)


class Favorite(db.Model):
    """Publication saved by a user."""

    __tablename__ = "intel_favorites"

    username: Mapped[str] = mapped_column(Text, ForeignKey("core_users.username", ondelete="CASCADE", onupdate="CASCADE"), primary_key=True)
    publication_id: Mapped[str] = mapped_column(Text, ForeignKey("intel_publications.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)


class PublicationText(db.Model):
    """Full official text of a publication, fetched after collection (DOU page of the act).

    status: "ok" (text stored), "unavailable" (the source has no full text the module
    can read) or "error" (fetch failed; retried by `flask intel fulltext`).
    """

    __tablename__ = "intel_publication_texts"

    publication_id: Mapped[str] = mapped_column(Text, ForeignKey("intel_publications.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    full_text: Mapped[str | None] = mapped_column(Text)
    text_url: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    fetched_at: Mapped[str] = mapped_column(Text, nullable=False)


class AiSummary(db.Model):
    """Resumo IA of a publication, generated on request with the subscription in use (Claude or
    ChatGPT) and kept for the next openings. status: "pending", "ok" or "error"."""

    __tablename__ = "intel_ai_summaries"

    publication_id: Mapped[str] = mapped_column(Text, ForeignKey("intel_publications.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    source_hash: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_version: Mapped[str] = mapped_column(Text, nullable=False)
    partial: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    requested_by: Mapped[str | None] = mapped_column(Text, ForeignKey("core_users.username", ondelete="SET NULL", onupdate="CASCADE"))
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)
