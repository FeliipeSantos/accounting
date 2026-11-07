"""Portal do Simples Nacional — news listing page (no feed available)."""

import re
from urllib.parse import urljoin

from app.modules.intelligence.collectors import CollectContext
from app.modules.intelligence.text import clean_text, html_to_text, parse_br_date

BASE_URL = "https://www8.receita.fazenda.gov.br/SimplesNacional/Noticias/"
LIST_URL = f"{BASE_URL}TodasNoticias.aspx"

_LINK = re.compile(r'<a href="(NoticiaCompleta\.aspx\?id=([\w-]+))"[^>]*>([\s\S]*?)</a>', re.ASCII)
_PARAGRAPH = re.compile(r"<p>([\s\S]*?)</p>")
_LEADING_DATE = re.compile(r"^\d{2}/\d{2}/\d{4}\s*-\s*")


def parse_list(html: str) -> list[dict]:
    start = html.find('id="listaNoticias"')
    if start < 0:
        raise ValueError("Estrutura da página de notícias do Simples Nacional mudou (lista não encontrada)")
    items = []
    for block in html[start:].split("<h4>")[1:]:
        link = _LINK.search(block)
        if not link:
            continue
        # data e resumo ficam no parágrafo "<span>dd/mm/aaaa</span> - <span>resumo</span>"
        paragraph = _PARAGRAPH.search(block)
        paragraph_text = html_to_text(paragraph.group(1)) if paragraph else ""
        items.append(
            {
                "externalId": link.group(2),
                "title": clean_text(html_to_text(link.group(3)), 500),
                "url": urljoin(BASE_URL, link.group(1)),
                "publishedAt": parse_br_date(paragraph_text),
                "excerpt": clean_text(_LEADING_DATE.sub("", paragraph_text, count=1)),
                "actType": "Notícia",
                "organ": "Comitê Gestor do Simples Nacional",
            }
        )
    return items


def collect(ctx: CollectContext) -> list[dict]:
    items = parse_list(ctx.fetch_text(LIST_URL))
    return [item for item in items if not item["publishedAt"] or item["publishedAt"] >= ctx.since]
