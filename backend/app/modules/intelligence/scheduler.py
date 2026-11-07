"""Daily automatic monitoring rules.

In production a systemd timer calls `flask intel scheduled` every few minutes; the
decision below is derived from the run history, so a run missed while the server was
off is caught up, and a fully failed run is retried a few times on the same day.
"""

import os
from datetime import UTC, datetime, timedelta

from app.modules.intelligence.text import parse_iso_datetime

# Execução agendada que falhou por completo (ex.: sem internet) é repetida algumas vezes no dia
MAX_FAILED_ATTEMPTS_PER_DAY = 3
RETRY_AFTER_FAILURE = timedelta(hours=1)


def _local(moment: datetime) -> datetime:
    """The moment in the process local time zone (naive values are taken as local)."""
    return moment.astimezone()


def slot_for(moment: datetime, run_time: str) -> datetime:
    """Today's slot (local time) for the configured "HH:MM"."""
    hours, minutes = (int(part) for part in run_time.split(":"))
    return _local(moment).replace(hour=hours, minute=minutes, second=0, microsecond=0)


def _todays_scheduled(data: dict, slot: datetime) -> list[dict]:
    return [r for r in data["runs"] if r["trigger"] == "scheduled" and parse_iso_datetime(r["startedAt"]) >= slot]


def _end_of(run: dict) -> datetime:
    return parse_iso_datetime(run.get("finishedAt") or run["startedAt"])


def is_due(data: dict, now: datetime) -> bool:
    """Whether a scheduled run is due now, based on today's scheduled runs."""
    now = _local(now)
    slot = slot_for(now, data["settings"]["runTime"])
    if now < slot:
        return False
    todays = _todays_scheduled(data, slot)
    if any(r["status"] in ("success", "partial", "running") for r in todays):
        return False
    failed = [r for r in todays if r["status"] == "failed"]
    if len(failed) >= MAX_FAILED_ATTEMPTS_PER_DAY:
        return False
    return not failed or now - _end_of(failed[-1]) >= RETRY_AFTER_FAILURE


def _iso(moment: datetime) -> str:
    return moment.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def compute_next_run_at(data: dict, now: datetime | None = None) -> str:
    """Next moment a scheduled run will happen (now, when one is due), as ISO UTC."""
    now = _local(now or datetime.now().astimezone())
    if is_due(data, now):
        return _iso(now)
    today = slot_for(now, data["settings"]["runTime"])
    todays = _todays_scheduled(data, today)
    failed = [r for r in todays if r["status"] == "failed"]
    done_today = now >= today and (any(r["status"] != "failed" for r in todays) or len(failed) >= MAX_FAILED_ATTEMPTS_PER_DAY)
    if now < today:
        return _iso(today)
    if not done_today and failed:
        return _iso(_end_of(failed[-1]) + RETRY_AFTER_FAILURE)
    return _iso(today + timedelta(days=1))


def is_scheduler_enabled() -> bool:
    return os.environ.get("INTEL_SCHEDULER") != "off"
