"""When each user last opened the notification center (/api/notifications).

The items themselves come from each module (the header asks them); here only the moment
they were last seen is kept, so the bell counts what is new since then.

    GET /seen -> { seenAt }  (null when never opened)
    PUT /seen -> { seenAt }  (now)
"""

from flask import Blueprint, g

from app.core.database import utc_now_iso
from app.core.http import json_response
from app.core.models import NotificationState
from app.extensions import db

bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


@bp.get("/seen")
def seen():
    state = db.session.get(NotificationState, g.user)
    return json_response({"seenAt": state.seen_at if state else None})


@bp.put("/seen")
def mark_seen():
    now = utc_now_iso()
    state = db.session.get(NotificationState, g.user)
    if state:
        state.seen_at = now
    else:
        db.session.add(NotificationState(username=g.user, seen_at=now))
    db.session.commit()
    return json_response({"seenAt": now})
