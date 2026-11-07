"""SQLite connection settings and time helpers shared by every module."""

from datetime import UTC, datetime
from time import time

from sqlalchemy import event
from sqlalchemy.engine import Engine


@event.listens_for(Engine, "connect")
def _sqlite_pragmas(dbapi_connection, _record):
    """Same PRAGMAs as the Node server: WAL, foreign keys and a busy timeout."""
    if dbapi_connection.__class__.__module__.startswith("sqlite3"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode = WAL")
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.execute("PRAGMA busy_timeout = 5000")
        cursor.execute("PRAGMA synchronous = NORMAL")
        cursor.close()


def now_ms() -> int:
    """Current time in milliseconds since the epoch (format of core_sessions)."""
    return int(time() * 1000)


def utc_now_iso() -> str:
    """Current UTC time as JavaScript's toISOString(): 2026-11-06T19:23:21.123Z."""
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
