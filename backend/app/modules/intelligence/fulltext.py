"""Full official text of collected publications, read after each collection so the
screen can show the act's key points without opening the source.

    dou         the act's own DOU page
    legislacao  the same act located in the DOU of its signature day (or the next days)
    confaz      the convênio or protocolo page on the CONFAZ site
    others      news, bills and portals: no full text ("unavailable")

Failures never affect the collection run: they are stored with status "error" and
retried by `flask intel fulltext`.
"""

import logging
import re
import time
from collections.abc import Callable

from app.core.database import utc_now_iso
from app.extensions import db
from app.modules.intelligence import http_client, repository
from app.modules.intelligence.collectors import encode_uri_component
from app.modules.intelligence.collectors.dou import parse_dou_page
from app.modules.intelligence.text import add_days, clean_text, decode_entities, html_to_text, normalize_for_match

logger = logging.getLogger(__name__)

SUPPORTED_SOURCES = {"dou", "legislacao", "confaz"}
MAX_TEXT_LENGTH = 400_000
# dias após a assinatura em que a lei costuma sair no DOU
DOU_SEARCH_DAYS = 3
DOU_SECTIONS = ["do1", "do1e"]
# pausa entre requisições às fontes (o site do DOU responde 502 a rajadas)
PAUSE_SECONDS = 1.5
# por coleta: as novas e as que ainda não têm texto (falhas anteriores), mais recentes primeiro
MAX_TEXTS_PER_RUN = 40

_DOU_BODY = re.compile(r'<div class="texto-dou">([\s\S]*?)</div>\s*</div>')
_ACT_KEY = re.compile(r"^([a-z][a-z -]*?)\s+n\s*\.?\s*(\d[\d.]*)")


class FullTextUnavailable(Exception):
    """The source has no full text the module can read."""


def dou_page_text(html: str) -> str:
    match = _DOU_BODY.search(html)
    if not match:
        raise ValueError("Texto do ato não encontrado na página do DOU")
    return html_to_text(match.group(1), MAX_TEXT_LENGTH)


def confaz_page_text(html: str) -> str:
    start = html.find("parent-fieldname-text")
    if start < 0:
        raise ValueError("Texto do convênio não encontrado na página do CONFAZ")
    return html_to_text(html[start:], MAX_TEXT_LENGTH)


def act_key(title: str) -> tuple[str, str] | None:
    """("lei complementar", "238") from "Lei Complementar nº 238 de 21/10/2026" or "LEI COMPLEMENTAR Nº 238, DE ..."."""
    match = _ACT_KEY.match(normalize_for_match(decode_entities(title)).strip())
    if not match:
        return None
    return match.group(1).strip(), match.group(2).replace(".", "").lstrip("0")


class _DouIndex:
    """Acts listed in the DOU per day and section, read once per run."""

    def __init__(self, fetch_text: Callable[[str], str]):
        self.fetch_text = fetch_text
        self.pages: dict[tuple[str, str], list[dict]] = {}

    def acts(self, day: str, section: str) -> list[dict]:
        key = (day, section)
        if key not in self.pages:
            y, m, d = day.split("-")
            self.pages[key] = parse_dou_page(self.fetch_text(f"https://www.in.gov.br/leiturajornal?data={d}-{m}-{y}&secao={section}"))
        return self.pages[key]

    def find(self, title: str, signed_at: str | None) -> str | None:
        key = act_key(title)
        if not key or not signed_at:
            return None
        for offset in range(DOU_SEARCH_DAYS + 1):
            day = add_days(signed_at, offset)
            for section in DOU_SECTIONS:
                for act in self.acts(day, section):
                    if act.get("urlTitle") and act_key(act.get("title") or act.get("titulo") or "") == key:
                        return f"https://www.in.gov.br/web/dou/-/{encode_uri_component(act['urlTitle'])}"
        return None


def fetch_full_text(pub: dict, fetch_text: Callable[[str], str], dou_index: _DouIndex) -> tuple[str, str]:
    """(text, url) of a publication; raises FullTextUnavailable or the fetch error."""
    source = pub["sourceId"]
    if source == "dou":
        return dou_page_text(fetch_text(pub["url"])), pub["url"]
    if source == "confaz":
        return confaz_page_text(fetch_text(pub["url"])), pub["url"]
    if source == "legislacao":
        url = dou_index.find(pub["title"], pub.get("publishedAt"))
        if url is None:
            raise ValueError("Ato ainda não localizado no DOU")
        return dou_page_text(fetch_text(url)), url
    raise FullTextUnavailable("Fonte sem texto completo do ato")


def fetch_and_store(publications: list[dict], fetch_text: Callable[[str], str] | None = None) -> dict:
    """Fetches and stores the full text of the given publications (inside an app context).

    Returns counts {"ok", "unavailable", "error"}.
    """
    if fetch_text is None:
        fetch_text = _paced(http_client.fetch_text)
    # o índice do DOU é compartilhado: as leis do mesmo dia leem a mesma página uma vez só
    dou_index = _DouIndex(fetch_text)

    counts = {"ok": 0, "unavailable": 0, "error": 0}
    for pub in publications:
        try:
            text, url = fetch_full_text(pub, fetch_text, dou_index)
            if not text.strip():
                raise ValueError("Texto vazio")
            status, error = "ok", None
        except FullTextUnavailable as err:
            status, text, url, error = "unavailable", None, None, str(err)
        except Exception as err:  # noqa: BLE001
            status, text, url, error = "error", None, None, clean_text(str(err), 300) or "Erro desconhecido"
            logger.warning("[intelligence] texto completo de %s indisponível: %s", pub["id"], error)
        repository.save_publication_text(pub["id"], status, text, url, error, utc_now_iso())
        # grava cada uma: uma busca longa (comando de preenchimento) não perde o que já leu
        db.session.commit()
        counts[status] += 1
    return counts


def _paced(fetch_text: Callable[[str], str]) -> Callable[[str], str]:
    """One request at a time with a pause between them: the DOU site fails under bursts."""
    last = [0.0]

    def fetch(url: str) -> str:
        wait = last[0] + PAUSE_SECONDS - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        try:
            return fetch_text(url)
        finally:
            last[0] = time.monotonic()

    return fetch


def has_full_text(source_id: str) -> bool:
    """Whether the module reads the full text of this source's publications."""
    return source_id in SUPPORTED_SOURCES
