"""Daily automatic synchronization, with the same rules as the Publicações
collection (shared code): catches up a run missed while the server was off and retries a
fully failed run a few times on the same day.

    REFORMA_RUN_TIME=07:00   daily time (default: after the Publicações collection, 06:00)
    REFORMA_SCHEDULER=off    disables the automatic run (the manual one stays available)
"""

import os
import re
from datetime import datetime

from app.modules.intelligence import scheduler as shared

DEFAULT_RUN_TIME = "07:00"
_TIME = re.compile(r"([01]\d|2[0-3]):[0-5]\d")


def run_time() -> str:
    value = (os.environ.get("REFORMA_RUN_TIME") or "").strip()
    return value if _TIME.fullmatch(value) else DEFAULT_RUN_TIME


def is_enabled() -> bool:
    return os.environ.get("REFORMA_SCHEDULER") != "off"


def _data(data: dict) -> dict:
    return {"settings": {"runTime": run_time()}, "runs": data["runs"]}


def is_due(data: dict, now: datetime) -> bool:
    return shared.is_due(_data(data), now)


def next_run_at(data: dict, now: datetime | None = None) -> str | None:
    return shared.compute_next_run_at(_data(data), now) if is_enabled() else None
