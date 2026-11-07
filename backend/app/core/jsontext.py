"""JSON text in the same format as JavaScript's JSON.stringify, the format of the
text already stored in the database and sent by the browser."""

import json
from typing import Any


def dumps_js(value: Any) -> str:
    """Compact JSON, UTF-8 characters kept, NaN/Infinity refused."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
