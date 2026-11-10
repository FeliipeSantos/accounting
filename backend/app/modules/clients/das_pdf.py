"""Reading of a DAS PDF issued on the PGMEI: payment line, amount, due date and checks.

The DAS is a "documento de arrecadação" (FEBRABAN layout for collections): the barcode has
44 digits starting with 8, and the payment line ("linha digitável") shows it as 4 blocks of
11 digits, each followed by a check digit (module 10 when the 3rd digit is 6 or 7, module 11
when it is 8 or 9). With value indicator 6 or 8 the amount in cents is in digits 5 to 15.

Only the text layer of the PDF is read (the PGMEI prints the payment line as text); nothing
is sent anywhere.
"""

import io
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.modules.clients.documents import normalize

MAX_PDF_BYTES = 1024 * 1024

_MONTHS = {
    "janeiro": 1,
    "fevereiro": 2,
    "marco": 3,
    "março": 3,
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
# linha digitável: 4 blocos de 11 dígitos + DV, com espaços, pontos ou hífens no meio
_LINE = re.compile(
    r"(?<!\d)(8\d{10})[\s.\-]*(\d)[\s.\-]+(\d{11})[\s.\-]*(\d)[\s.\-]+(\d{11})[\s.\-]*(\d)[\s.\-]+(\d{11})[\s.\-]*(\d)(?!\d)"
)
_DOCUMENT_NUMBER = re.compile(r"(?<!\d)(\d{2}\.\d{2}\.\d{5}\.\d{7}-\d)(?!\d)")
_DATE = re.compile(r"(?<!\d)(\d{2})/(\d{2})/(\d{4})(?!\d)")
_MONEY = re.compile(r"(?<![\d,.])(\d{1,3}(?:\.\d{3})*,\d{2})(?![\d,])")
_CNPJ = re.compile(r"(?<![0-9A-Za-z])([0-9A-Za-z]{2}\.[0-9A-Za-z]{3}\.[0-9A-Za-z]{3}/[0-9A-Za-z]{4}-\d{2})(?!\d)")
_PERIOD_NAMED = re.compile(r"\b(" + "|".join(_MONTHS) + r")\s*/\s*(\d{4})\b", re.IGNORECASE)
_PERIOD_NUMERIC = re.compile(r"(?<![\d/])(0[1-9]|1[0-2])/(\d{4})(?![\d/])")


class DasPdfError(ValueError):
    """The file is not a readable DAS of this client and competência; the message is shown on the screen."""


@dataclass
class DasPdfData:
    barcode_line: str | None
    amount_cents: int | None
    due_date: str | None
    document_number: str | None


def _mod10(digits: str) -> int:
    total = 0
    for i, digit in enumerate(reversed(digits)):
        product = int(digit) * (2 if i % 2 == 0 else 1)
        total += product // 10 + product % 10
    return (10 - total % 10) % 10


def _mod11(digits: str) -> int:
    total = sum(int(digit) * (2 + i % 8) for i, digit in enumerate(reversed(digits)))
    rest = total % 11
    return 0 if rest in (0, 1) else 11 - rest


def valid_line(blocks: list[str], checks: list[str]) -> bool:
    """Whether the 4 blocks of a collection payment line match their check digits."""
    indicator = blocks[0][2]
    if indicator in "67":
        check = _mod10
    elif indicator in "89":
        check = _mod11
    else:
        return False
    return all(check(block) == int(digit) for block, digit in zip(blocks, checks, strict=True))


def amount_from_line(line: str) -> int | None:
    """Amount in cents carried by the payment line (value indicator 6 or 8), else None."""
    barcode = "".join(line[i * 12 : i * 12 + 11] for i in range(4))
    return int(barcode[4:15]) if barcode[2] in "68" else None


def pdf_text(data: bytes) -> str:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(data))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except (PdfReadError, ValueError, OSError, KeyError, TypeError) as err:
        raise DasPdfError("Não foi possível ler este PDF. Envie o arquivo do DAS baixado do PGMEI.") from err


def _periods(text: str) -> set[str]:
    found = {f"{year}-{_MONTHS[name.lower()]:02d}" for name, year in _PERIOD_NAMED.findall(text)}
    found |= {f"{year}-{month}" for month, year in _PERIOD_NUMERIC.findall(text)}
    return found


def _label_value(text: str, label: str, pattern: re.Pattern) -> re.Match | None:
    """First match of `pattern` after `label` (the PDF text keeps the label before its value)."""
    position = text.lower().find(label)
    return pattern.search(text, position) if position >= 0 else None


def read_das_pdf(data: bytes, document: str, period: str) -> DasPdfData:
    """Data of a DAS PDF, after checking that it belongs to this CNPJ and competência (AAAA-MM)."""
    if len(data) > MAX_PDF_BYTES:
        raise DasPdfError("Arquivo muito grande: o PDF do DAS tem menos de 1 MB")
    if not data.startswith(b"%PDF-"):
        raise DasPdfError("O arquivo não é um PDF")

    text = pdf_text(data)
    cnpjs = {normalize(value) for value in _CNPJ.findall(text)}
    if not cnpjs:
        raise DasPdfError("Não encontrei o CNPJ neste PDF. Envie o arquivo do DAS baixado do PGMEI.")
    if document not in cnpjs:
        raise DasPdfError("Este DAS é de outro CNPJ")

    periods = _periods(text)
    # um DAS de vários meses (consolidado) também serve, desde que inclua esta competência
    if periods and period not in periods:
        raise DasPdfError("Este DAS é de outra competência")

    barcode_line = None
    for match in _LINE.finditer(text):
        blocks, checks = list(match.groups()[0::2]), list(match.groups()[1::2])
        if valid_line(blocks, checks):
            barcode_line = "".join(f"{b}{c}" for b, c in zip(blocks, checks, strict=True))
            break

    amount_cents = amount_from_line(barcode_line) if barcode_line else None
    if amount_cents is None:
        money = _label_value(text, "valor total do documento", _MONEY)
        if money:
            amount_cents = int(Decimal(money[1].replace(".", "").replace(",", ".")) * 100)

    due = _label_value(text, "pagar este documento até", _DATE) or _label_value(text, "vencimento", _DATE)
    due_date = None
    if due:
        try:
            due_date = date(int(due[3]), int(due[2]), int(due[1])).isoformat()
        except ValueError:
            due_date = None

    number = _DOCUMENT_NUMBER.search(text)
    return DasPdfData(barcode_line, amount_cents, due_date, number[1] if number else None)
