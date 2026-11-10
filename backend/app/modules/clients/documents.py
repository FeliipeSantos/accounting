"""CPF and CNPJ: normalization and check digits.

The CNPJ follows the alphanumeric format in force since July 2026 (12 letters or digits
plus 2 numeric check digits); numeric CNPJs are a special case of it. Each character is
worth its ASCII code minus 48, so digits keep their usual value.
"""

import re

_CPF = re.compile(r"^\d{11}$")
_CNPJ = re.compile(r"^[0-9A-Z]{12}\d{2}$")
_CNPJ_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]


def normalize(value: str) -> str:
    """Keeps only letters and digits, in upper case (drops dots, slashes and dashes)."""
    return re.sub(r"[^0-9A-Za-z]", "", value).upper()


def _check_digit(values: list[int], weights: list[int]) -> int:
    rest = sum(v * w for v, w in zip(values, weights, strict=True)) % 11
    return 0 if rest < 2 else 11 - rest


def is_valid_cpf(cpf: str) -> bool:
    if not _CPF.match(cpf) or len(set(cpf)) == 1:
        return False
    digits = [int(c) for c in cpf]
    first = _check_digit(digits[:9], list(range(10, 1, -1)))
    second = _check_digit(digits[:10], list(range(11, 1, -1)))
    return digits[9:] == [first, second]


def is_valid_cnpj(cnpj: str) -> bool:
    if not _CNPJ.match(cnpj) or len(set(cnpj)) == 1:
        return False
    values = [ord(c) - 48 for c in cnpj]
    first = _check_digit(values[:12], _CNPJ_WEIGHTS[1:])
    second = _check_digit(values[:13], _CNPJ_WEIGHTS)
    return values[12:] == [first, second]


def document_kind(document: str) -> str | None:
    """'pf' for a valid CPF, 'pj' for a valid CNPJ, None otherwise."""
    if is_valid_cpf(document):
        return "pf"
    if is_valid_cnpj(document):
        return "pj"
    return None
