"""JSON text in the same format as JavaScript's JSON.stringify, so the Node and
Flask servers write identical text to the shared database."""

import json
from typing import Any


def dumps_js(value: Any) -> str:
    """Compact JSON, UTF-8 characters kept, NaN/Infinity refused."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
