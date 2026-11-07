"""Shared parsers for gov.br portals (Plone): news listings ("ul.noticias" layout),
used by Receita Federal and Ministério da Fazenda, and the publication time shown
on each article page, also used by eSocial."""

import re
from collections.abc import Callable

from app.modules.intelligence.collectors import CollectContext
from app.modules.intelligence.text import clean_text, decode_entities, html_to_text, parse_br_date

# Páginas de notícia abertas por execução para ler o horário (só itens novos)
MAX_ARTICLE_PAGES_PER_RUN = 20

_LINK = re.compile(r'\s*<a href="([^"]+)"[^>]*>([\s\S]*?)</a>')
_DESCRIPTION = re.compile(r'<span class="descricao">([\s\S]*?)</span>\s*(?:<div|</div>)')
_DATE = re.compile(r'<span class="data">\s*([\d/]+)\s*</span>')
_LEADING_DATE = re.compile(r"^\d{2}/\d{2}/\d{4}\s*-\s*")
_ARTICLE_PUBLISHED = re.compile(r'class="documentPublished"[\s\S]{0,400}?(\d{2}/\d{2}/\d{4})\s*(\d{1,2})h(\d{2})')


def parse_news_list(html: str, organ: str) -> list[dict]:
    """Each "h2.titulo" headline with its date and description."""
    start = html.find('class="noticias')
    if start < 0:
        raise ValueError(f"Estrutura da página de notícias ({organ}) mudou (lista não encontrada)")
    items = []
    for block in html[start:].split('<h2 class="titulo">')[1:]:
        link = _LINK.match(block)
        if not link:
            continue
        url = decode_entities(link.group(1))
        description = _DESCRIPTION.search(block)
        description_text = html_to_text(description.group(1)) if description else ""
        date = _DATE.search(block)
        items.append(
            {
                "externalId": url,
                "title": clean_text(html_to_text(link.group(2)), 500),
                "url": url,
                "publishedAt": parse_br_date(date.group(1) if date else None),
                # remove a data repetida no início da descrição ("05/11/2026 - ...")
                "excerpt": clean_text(_LEADING_DATE.sub("", description_text, count=1)),
                "actType": "Notícia",
                "organ": organ,
            }
        )
    return items


def parse_article_published(html: str) -> tuple[str | None, str | None]:
    """Date and time of "Publicado em dd/mm/aaaa HHhMM" on a gov.br article page."""
    match = _ARTICLE_PUBLISHED.search(str(html))
    if not match:
        return None, None
    return parse_br_date(match.group(1)), f"{match.group(2).zfill(2)}:{match.group(3)}"


def add_published_times(items: list[dict], ctx: CollectContext) -> list[dict]:
    """Adds the publication time to new items by opening their article pages.

    A page that fails or has no time leaves the item without time (never guessed).
    """
    pending = [item for item in items if not (ctx.is_known and ctx.is_known(item["externalId"]))][:MAX_ARTICLE_PAGES_PER_RUN]
    for item in pending:
        try:
            date, time = parse_article_published(ctx.fetch_text(item["url"]))
        except Exception:  # noqa: BLE001
            # falha ao abrir a página da notícia não invalida a coleta da fonte
            continue
        # só usa o horário se a data da página bater com a da listagem
        if time and (not item["publishedAt"] or date == item["publishedAt"]):
            item["publishedTime"] = time
    return items


def news_collector(list_url: str, organ: str) -> Callable[[CollectContext], list[dict]]:
    """Collector for a gov.br news listing URL."""

    def collect(ctx: CollectContext) -> list[dict]:
        listed = parse_news_list(ctx.fetch_text(list_url), organ)
        items = [item for item in listed if not item["publishedAt"] or item["publishedAt"] >= ctx.since]
        return add_published_times(items, ctx)

    return collect


# Receita Federal: o feed RSS oficial foi descartado (em 2026-11-06 a notícia mais nova
# dele era de julho, enquanto a página tinha notícias de novembro)
receita = news_collector("https://www.gov.br/receitafederal/pt-br/assuntos/noticias", "Receita Federal")
# Ministério da Fazenda: sem feed disponível
fazenda = news_collector("https://www.gov.br/fazenda/pt-br/assuntos/noticias", "Ministério da Fazenda")
