"""Restricted HTTP client for collectors: official hosts only, timeout, size cap
and one retry on timeouts, connection errors and 5xx responses."""

import json
import time
from typing import Any
from urllib.parse import urlsplit

import httpx

USER_AGENT = "opencontabil-monitor/1.0 (+Inteligencia Contabil; coleta diaria de fontes oficiais)"
DEFAULT_TIMEOUT_MS = 20000
MAX_BYTES = 5 * 1024 * 1024
RETRY_DELAY_SECONDS = 2
DEFAULT_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"

# Domínios oficiais permitidos (Executivo e Legislativo federal)
OFFICIAL_DOMAINS = ("gov.br", "leg.br")


class CollectorHttpError(Exception):
    """Request to an official source failed; `retryable` marks transient failures."""

    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


def is_official_url(url: str) -> bool:
    """True when the URL is http(s) on an official government domain."""
    try:
        parts = urlsplit(str(url))
        host = (parts.hostname or "").lower()
    except ValueError:
        return False
    if parts.scheme not in ("http", "https") or not host:
        return False
    return any(host == d or host.endswith(f".{d}") for d in OFFICIAL_DOMAINS)


def _fetch_once(url: str, timeout_ms: int, accept: str) -> str:
    if not is_official_url(url):
        raise CollectorHttpError(f"URL fora dos domínios oficiais: {url}")
    headers = {"User-Agent": USER_AGENT, "Accept": accept}
    try:
        with httpx.Client(follow_redirects=True, timeout=timeout_ms / 1000) as client:
            with client.stream("GET", url, headers=headers) as response:
                # o redirecionamento não pode levar para fora dos domínios oficiais
                final_url = str(response.url)
                if not is_official_url(final_url):
                    raise CollectorHttpError(f"Redirecionado para domínio não oficial: {final_url}")
                if response.status_code >= 400:
                    raise CollectorHttpError(f"HTTP {response.status_code}", retryable=response.status_code >= 500)
                chunks = []
                total = 0
                for chunk in response.iter_bytes():
                    total += len(chunk)
                    if total > MAX_BYTES:
                        raise CollectorHttpError(f"Resposta acima do limite de {MAX_BYTES // 1024 // 1024} MB")
                    chunks.append(chunk)
                return b"".join(chunks).decode("utf-8", errors="replace")
    except httpx.TimeoutException as err:
        raise CollectorHttpError("Falha de conexão (tempo limite esgotado)", retryable=True) from err
    except httpx.TransportError as err:
        raise CollectorHttpError(f"Falha de conexão ({type(err).__name__})", retryable=True) from err


def fetch_text(url: str, timeout_ms: int | None = None, accept: str | None = None) -> str:
    """Fetches a text resource from an official host, retrying once on transient failures."""
    try:
        return _fetch_once(url, timeout_ms or DEFAULT_TIMEOUT_MS, accept or DEFAULT_ACCEPT)
    except CollectorHttpError as err:
        if not err.retryable:
            raise
        time.sleep(RETRY_DELAY_SECONDS)
        return _fetch_once(url, timeout_ms or DEFAULT_TIMEOUT_MS, accept or DEFAULT_ACCEPT)


def fetch_json(url: str, timeout_ms: int | None = None) -> Any:
    """Fetches and parses a JSON resource from an official host."""
    text = fetch_text(url, timeout_ms=timeout_ms, accept="application/json")
    try:
        return json.loads(text)
    except ValueError as err:
        raise CollectorHttpError("Resposta JSON inválida") from err
