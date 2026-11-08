"""Official files (PDF) of document versions: download, store on disk and extract the text.

Files are kept next to the database (REFORMA_FILES_DIR, default "<db folder>/reforma-files"),
named by their SHA-256, so the same file is never stored twice. Only official hosts are
accepted, with a size cap, a timeout and one retry.
"""

import hashlib
import io
import logging
import os
import time
from pathlib import Path

import httpx
from flask import current_app

from app.modules.intelligence import http_client
from app.modules.intelligence.text import clean_text

logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 40 * 1024 * 1024
TIMEOUT_SECONDS = 60
MAX_TEXT_LENGTH = 1_500_000
# arquivos baixados só de documentos publicados a partir desta data (o período da Reforma)
FILES_SINCE = "2025-01-01"


def files_dir() -> Path:
    configured = os.environ.get("REFORMA_FILES_DIR")
    return Path(configured) if configured else current_app.config["SETTINGS"].db_path.parent / "reforma-files"


def fetch_bytes(url: str) -> tuple[bytes, str]:
    """Bytes and content type of an official file; one retry on transient failures."""
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            if not http_client.is_official_url(url):
                raise http_client.CollectorHttpError(f"URL fora dos domínios oficiais: {url}")
            with httpx.Client(follow_redirects=True, timeout=TIMEOUT_SECONDS) as client:
                with client.stream("GET", url, headers={"User-Agent": http_client.USER_AGENT}) as response:
                    if not http_client.is_official_url(str(response.url)):
                        raise http_client.CollectorHttpError(f"Redirecionado para domínio não oficial: {response.url}")
                    if response.status_code >= 400:
                        raise http_client.CollectorHttpError(f"HTTP {response.status_code}", retryable=response.status_code >= 500)
                    chunks, total = [], 0
                    for chunk in response.iter_bytes():
                        total += len(chunk)
                        if total > MAX_FILE_BYTES:
                            raise http_client.CollectorHttpError(f"Arquivo acima de {MAX_FILE_BYTES // 1024 // 1024} MB")
                        chunks.append(chunk)
                    return b"".join(chunks), response.headers.get("content-type", "")
        except http_client.CollectorHttpError as err:
            last_error = err
            if not err.retryable:
                break
        except (httpx.TimeoutException, httpx.TransportError) as err:
            last_error = http_client.CollectorHttpError(f"Falha de conexão ({type(err).__name__})", retryable=True)
        if attempt == 0:
            time.sleep(2)
    raise last_error or http_client.CollectorHttpError("Falha ao baixar o arquivo")


def pdf_text(data: bytes) -> str:
    """Text of a PDF (page by page); empty when it has no text layer."""
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(data))
    except (PdfReadError, ValueError, OSError) as err:
        # arquivo guardado mesmo assim: o texto fica para a análise ler direto do PDF
        logger.warning("[reforma] PDF sem texto legível: %s", err)
        return ""
    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:  # noqa: BLE001
            # uma página ilegível não impede as demais
            pages.append("")
    return clean_text("\n\n".join(pages), MAX_TEXT_LENGTH)


def store(document_id: str, data: bytes, content_type: str) -> tuple[str, str, str | None]:
    """Saves the file; returns (relative path, sha256, extracted text or None)."""
    sha = hashlib.sha256(data).hexdigest()
    is_pdf = data[:5] == b"%PDF-" or "pdf" in content_type.lower()
    relative = f"{document_id}/{sha}{'.pdf' if is_pdf else '.bin'}"
    target = files_dir() / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(data)
    text = pdf_text(data) if is_pdf else None
    return relative, sha, (text or None)
