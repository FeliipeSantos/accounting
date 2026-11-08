"""Portal da Conformidade Fácil (SVRS) — news: NT deployments in test and production.

No API or feed (checked 2026-11-07); each news item is in the listing with its full text.
The parser is shared by the Publicações and Calendário modules.
"""

import re

from app.modules.intelligence.collectors import CollectContext
from app.modules.intelligence.text import clean_text, decode_entities, html_to_text, parse_br_date

BASE_URL = "https://dfe-portal.svrs.rs.gov.br"
LIST_URL = f"{BASE_URL}/CFF/Noticias"

_ARTICLE = re.compile(r'<article class="conteudo-lista__item[^"]*">([\s\S]*?)</article>')
_CATEGORY = re.compile(r'class="label[^"]*"[^>]*>([^<]*)</a>')
_DATE = re.compile(r'<time[^>]*datetime="(\d{2}/\d{2}/\d{4})"')
_TITLE = re.compile(r'<h2 class="conteudo-lista__item__titulo">\s*<a id="#?(\d+)"[^>]*>([\s\S]*?)</a>')


def parse_list(html: str) -> list[dict]:
    articles = _ARTICLE.findall(html)
    if not articles and "conteudo-lista" not in html:
        raise ValueError("Estrutura da página de notícias da Conformidade Fácil mudou (lista não encontrada)")
    items = []
    for article in articles:
        title = _TITLE.search(article)
        if not title:
            continue
        date = _DATE.search(article)
        category = _CATEGORY.search(article)
        body = clean_text(html_to_text(article[title.end() :]), 8000)
        items.append(
            {
                "externalId": title.group(1),
                "title": clean_text(html_to_text(title.group(2)), 400),
                "url": f"{BASE_URL}/Cff/Noticias/{title.group(1)}",
                "kind": "aviso",
                "publishedAt": parse_br_date(date.group(1)) if date else None,
                "summary": clean_text(f"{clean_text(decode_entities(category.group(1)), 120) + ' — ' if category else ''}{body}", 600),
                "contentText": body,
            }
        )
    return items


def collect(ctx: CollectContext) -> list[dict]:
    """Publicações: the news published in the period."""
    return [
        {
            "externalId": item["externalId"],
            "title": item["title"],
            "url": item["url"],
            "publishedAt": item["publishedAt"],
            "excerpt": item["summary"],
            "actType": "Aviso",
            "organ": "Conformidade Fácil (SVRS)",
        }
        for item in parse_list(ctx.fetch_text(LIST_URL))
        if item["publishedAt"] and item["publishedAt"] >= ctx.since
    ]
