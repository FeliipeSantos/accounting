"""Text helpers shared by collectors and classifier (same rules as the Node version).

Output is always plain text.
"""

import re
import unicodedata
from datetime import UTC, date, datetime, timedelta

NAMED_ENTITIES = {
    "amp": "&",
    "lt": "<",
    "gt": ">",
    "quot": '"',
    "apos": "'",
    # espaço comum, como na versão Node
    "nbsp": " ",
    "ordm": "º",
    "ordf": "ª",
    "sect": "§",
    "ndash": "–",
    "mdash": "—",
    "lsquo": "‘",
    "rsquo": "’",
    "ldquo": "“",
    "rdquo": "”",
    "hellip": "…",
    "deg": "°",
}
ACCENT_MARKS = {"acute": "́", "grave": "̀", "circ": "̂", "tilde": "̃", "uml": "̈", "cedil": "̧"}

_DECIMAL_ENTITY = re.compile(r"&#(\d+);")
_HEX_ENTITY = re.compile(r"&#x([0-9a-f]+);", re.IGNORECASE)
_NAMED_ENTITY = re.compile(r"&([a-z]+);", re.IGNORECASE)
_ACCENT_ENTITY = re.compile(r"^([a-z])(acute|grave|circ|tilde|uml|cedil)$", re.IGNORECASE)

_SCRIPT_BLOCKS = re.compile(r"<(script|style|noscript)[\s\S]*?</\1>", re.IGNORECASE)
_CDATA = re.compile(r"<!\[CDATA\[([\s\S]*?)\]\]>")
_BR = re.compile(r"<br\s*/?>", re.IGNORECASE)
_BLOCK_END = re.compile(r"</(p|div|li|h\d)>", re.IGNORECASE)
_TAG = re.compile(r"<[^>]+>")

_CONTROL = re.compile(r"[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]")
_SPACES = re.compile(r"[ \t\r\f\v]+")
_NEWLINE = re.compile(r"\s*\n\s*")
_MANY_NEWLINES = re.compile(r"\n{3,}")
_COMBINING = re.compile(r"[̀-ͯ]")
_ORDINALS = re.compile(r"[º°ª]")
_WHITESPACE = re.compile(r"\s+")

MONTHS = {
    "janeiro": 1,
    "fevereiro": 2,
    "marco": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}
_NUMERIC_DATE = re.compile(r"(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})")
_WRITTEN_DATE = re.compile(r"(\d{1,2})\s*(?:o\s*)?de\s+([a-z]+)\s+de\s+(\d{4})")


def _safe_code_point(number: int) -> str:
    # surrogates isolados não são texto válido em UTF-8
    if 0 < number <= 0x10FFFF and not 0xD800 <= number <= 0xDFFF:
        return chr(number)
    return ""


def _named(match: re.Match) -> str:
    name = match.group(1)
    lower = name.lower()
    if lower in NAMED_ENTITIES:
        return NAMED_ENTITIES[lower]
    # letras acentuadas: &aacute; &ccedil; &atilde; ...
    accent = _ACCENT_ENTITY.match(name)
    if accent:
        return unicodedata.normalize("NFC", accent.group(1) + ACCENT_MARKS[accent.group(2).lower()])
    return match.group(0)


def decode_entities(text) -> str:
    text = _DECIMAL_ENTITY.sub(lambda m: _safe_code_point(int(m.group(1))), str(text))
    text = _HEX_ENTITY.sub(lambda m: _safe_code_point(int(m.group(1), 16)), text)
    return _NAMED_ENTITY.sub(_named, text)


def clean_text(text, max_length: float = 2000) -> str:
    """Collapses whitespace, strips control characters and caps the length."""
    cleaned = _CONTROL.sub("", str(text or ""))
    cleaned = _SPACES.sub(" ", cleaned)
    cleaned = _NEWLINE.sub("\n", cleaned)
    cleaned = _MANY_NEWLINES.sub("\n\n", cleaned).strip()
    if len(cleaned) > max_length:
        return cleaned[: int(max_length) - 1].rstrip() + "…"
    return cleaned


def html_to_text(html, max_length: float = 2000) -> str:
    """Converts an HTML fragment into clean plain text (scripts/styles dropped).

    Pass float("inf") as max_length to parse whole pages.
    """
    text = _SCRIPT_BLOCKS.sub(" ", str(html))
    text = _CDATA.sub(r"\1", text)
    text = _BR.sub("\n", text)
    text = _BLOCK_END.sub("\n", text)
    text = _TAG.sub(" ", text)
    return clean_text(decode_entities(text), max_length)


def normalize_for_match(text) -> str:
    """Lowercase, accent-free text used for keyword matching."""
    text = unicodedata.normalize("NFD", str(text or ""))
    text = _COMBINING.sub("", text).lower()
    text = _ORDINALS.sub(" ", text)
    return _WHITESPACE.sub(" ", text)


def _to_iso_date(year: str | int, month: str | int, day: str | int) -> str | None:
    y = int(year)
    if y < 100:
        y += 2000
    try:
        return date(y, int(month), int(day)).isoformat()
    except ValueError:
        return None


def parse_br_date(text) -> str | None:
    """Parses "dd/mm/yyyy", "dd.mm.yy" or "dd de <mês> de yyyy" into yyyy-mm-dd."""
    if not text:
        return None
    numeric = _NUMERIC_DATE.search(str(text))
    if numeric:
        return _to_iso_date(numeric.group(3), numeric.group(2), numeric.group(1))
    written = _WRITTEN_DATE.search(normalize_for_match(text))
    if written and written.group(2) in MONTHS:
        return _to_iso_date(written.group(3), MONTHS[written.group(2)], written.group(1))
    return None


def local_iso_date(moment: datetime | None = None) -> str:
    """Local calendar date (yyyy-mm-dd) of a moment, avoiding UTC day shifts."""
    moment = moment or datetime.now().astimezone()
    if moment.tzinfo is not None:
        moment = moment.astimezone()
    return moment.date().isoformat()


def add_days(iso_date: str, days: int) -> str:
    return (date.fromisoformat(iso_date) + timedelta(days=days)).isoformat()


def parse_iso_datetime(text: str) -> datetime:
    """Parses an ISO timestamp written by JavaScript (2026-11-06T09:00:00.000Z)."""
    moment = datetime.fromisoformat(text.replace("Z", "+00:00"))
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)
