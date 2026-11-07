"""Core tables: users and login sessions (prefix core_)."""

from sqlalchemy import ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class User(db.Model):
    """User account; the password is stored as scrypt$<salt>$<hash>."""

    __tablename__ = "core_users"

    username: Mapped[str] = mapped_column(Text, primary_key=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)


class Session(db.Model):
    """Login session; only the SHA-256 of the token is stored. Times in milliseconds."""

    __tablename__ = "core_sessions"
    __table_args__ = (Index("core_sessions_expires_at", "expires_at"),)

    token_hash: Mapped[str] = mapped_column(Text, primary_key=True)
    username: Mapped[str] = mapped_column(Text, ForeignKey("core_users.username", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    created_at: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[int] = mapped_column(Integer, nullable=False)
