"""eSocial — news listing page (Plone collection, no feed available)."""

import re

from app.modules.intelligence.collectors import CollectContext
from app.modules.intelligence.collectors.govbr_news import add_published_times
from app.modules.intelligence.text import clean_text, decode_entities, html_to_text, parse_br_date

LIST_URL = "https://www.gov.br/esocial/pt-br/noticias"

_ARTICLE = re.compile(r'<article class="tileItem[\s\S]*?</article>')
_LINK = re.compile(r'<a class="summary url" href="([^"]+)"[^>]*>([\s\S]*?)</a>')
_DESCRIPTION = re.compile(r'<span class="description">([\s\S]*?)</span>')
_BYLINE = re.compile(r'<span class="documentByLine">([\s\S]*)\Z')
_TECHNICAL_NOTE = re.compile(r"^nota t[ée]cnica", re.IGNORECASE)


def parse_list(html: str) -> list[dict]:
    blocks = _ARTICLE.findall(html)
    if not blocks:
        raise ValueError("Estrutura da página de notícias do eSocial mudou (itens não encontrados)")
    items = []
    for block in blocks:
        link = _LINK.search(block)
        if not link:
            continue
        url = decode_entities(link.group(1))
        description = _DESCRIPTION.search(block)
        byline = _BYLINE.search(block)
        title = clean_text(html_to_text(link.group(2)), 500)
        items.append(
            {
                "externalId": url,
                "title": title,
                "url": url,
                "publishedAt": parse_br_date(html_to_text(byline.group(1)) if byline else ""),
                "excerpt": clean_text(html_to_text(description.group(1))) if description else "",
                # notas técnicas e comunicados são identificados pelo título
                "actType": "Nota Técnica" if _TECHNICAL_NOTE.search(title) else "Notícia",
                "organ": "eSocial",
            }
        )
    return items


def collect(ctx: CollectContext) -> list[dict]:
    items = [item for item in parse_list(ctx.fetch_text(LIST_URL)) if not item["publishedAt"] or item["publishedAt"] >= ctx.since]
    # o horário só aparece na página de cada notícia
    return add_published_times(items, ctx)
