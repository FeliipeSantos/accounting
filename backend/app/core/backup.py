"""Database backups: consistent copies taken with the system running (VACUUM INTO),
keeping only the most recent ones. Same file names as the Node server."""

import re
import sqlite3
from datetime import datetime
from pathlib import Path

FILE_PATTERN = re.compile(r"^app-(\d{4}-\d{2}-\d{2})_\d{6}\.db$")


def backup_dir(db_path: Path, configured: Path | None = None) -> Path:
    """Configured folder, or "backups" next to the database."""
    return configured or db_path.parent / "backups"


def list_backups(directory: Path) -> list[str]:
    """Backup file names, oldest first."""
    if not directory.exists():
        return []
    return sorted(f.name for f in directory.iterdir() if FILE_PATTERN.match(f.name))


def create_backup(db_path: Path, directory: Path, keep: int, now: datetime | None = None) -> Path:
    """Writes a consistent copy of the database and removes the oldest beyond `keep`."""
    directory.mkdir(parents=True, exist_ok=True)
    now = now or datetime.now()
    target = directory / f"app-{now:%Y-%m-%d_%H%M%S}.db"
    # conexão própria em autocommit: VACUUM não roda dentro de transação
    connection = sqlite3.connect(db_path, isolation_level=None)
    try:
        connection.execute("VACUUM INTO ?", (str(target),))
    finally:
        connection.close()
    files = list_backups(directory)
    for name in files[: max(len(files) - keep, 0)]:
        (directory / name).unlink()
    return target
