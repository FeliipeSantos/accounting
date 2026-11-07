"""Portal de Projetos tables (prefix projects_)."""

from sqlalchemy import ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class Project(db.Model):
    """One project stored as a JSON document, in the shape the screen uses."""

    __tablename__ = "projects_projects"
    __table_args__ = (Index("projects_projects_position", "position"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(Text, ForeignKey("core_users.username", ondelete="SET NULL", onupdate="CASCADE"))
