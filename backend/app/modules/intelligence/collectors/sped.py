"""SPED — highlights on the official home page (HTTP only; HTTPS times out)."""

import re

from app.modules.intelligence.collectors import CollectContext
from app.modules.intelligence.text import clean_text, html_to_text, parse_br_date

BASE_URL = "http://sped.rfb.gov.br"

_SECTION = re.compile(r'<section class="destaque">[\s\S]*?</section>')
_LINK = re.compile(r'<h2>\s*<a href="(/item/show/(\d+))"[^>]*>([\s\S]*?)</a>')
_PARAGRAPH = re.compile(r'<p(?: class="([^"]*)")?>([\s\S]*?)</p>')
_CONTINUE = re.compile(r"\s*Continue lendo\s*\.?\s*$", re.IGNORECASE)


def parse_home(html: str) -> list[dict]:
    sections = _SECTION.findall(html)
    if not sections:
        raise ValueError("Estrutura da página do SPED mudou (destaques não encontrados)")
    items = []
    for block in sections:
        link = _LINK.search(block)
        if not link:
            continue
        paragraphs = list(_PARAGRAPH.finditer(block))
        date = next((p for p in paragraphs if p.group(1) == "data"), None)
        summary = next((p for p in paragraphs if not p.group(1)), None)
        items.append(
            {
                "externalId": link.group(2),
                "title": clean_text(html_to_text(link.group(3)), 500),
                "url": f"{BASE_URL}{link.group(1)}",
                "publishedAt": parse_br_date(html_to_text(date.group(2)) if date else None),
                "excerpt": clean_text(_CONTINUE.sub("", html_to_text(summary.group(2)), count=1)) if summary else "",
                "actType": "Destaque",
                "organ": "SPED — Receita Federal",
            }
        )
    return items


def collect(ctx: CollectContext) -> list[dict]:
    items = parse_home(ctx.fetch_text(f"{BASE_URL}/"))
    return [item for item in items if not item["publishedAt"] or item["publishedAt"] >= ctx.since]
