"""Comitê Gestor do IBS (cgibs.gov.br): Resoluções, Comunicados Oficiais and Notícias.

No API or feed was found (checked 2026-11-07). The resolutions page lists each one with its
official PDF, summary and publication date. Comunicados and Notícias are loaded by the page
from a JSON service of the site itself (/_service/conteudo/pagedlistfilho), the same request
a browser makes, read here page by page.

The parsers are shared: the Publicações module lists what is new; the Calendário module
reads the same pages to keep the versions and the official PDFs of the resolutions.
"""

import json
import re
from collections.abc import Callable
from urllib.parse import urljoin

from app.modules.intelligence.collectors import CollectContext
from app.modules.intelligence.text import clean_text, decode_entities, html_to_text, parse_br_date

BASE_URL = "https://www.cgibs.gov.br"
RESOLUCOES_URL = f"{BASE_URL}/resolucoes"
_LIST_FIELDS = "fields%5B%5D=Titulo&fields%5B%5D=TituloCurto&fields%5B%5D=Texto&form%5Bordem%5D=RECENTES"
COMUNICADOS = {"id": "149&conteudopai=149", "template": "pagina.listapagina.cards.fullheader"}
NOTICIAS = {"id": "104", "template": "pagina.listanoticias.cards"}
PAGE_SIZE = 9
MAX_PAGES = 10

# cada resolução é um painel; o título vem em <h3>, <h4> ou <p> conforme a resolução
_PANEL_START = 'class="panel panel-default"'
_PANEL_TITLE = re.compile(r'class="panel-title"[^>]*>([\s\S]*?)</(?:h\d|p|div)>')
_PDF = re.compile(r'<a href="(/upload/arquivos/[^"]+\.pdf)"[^>]*>([\s\S]*?)</a>', re.IGNORECASE)
_STRONG = re.compile(r"<strong>([\s\S]*?)</strong>")
_SITE_DATE = re.compile(r"disponibilizad[ao] no site do CGIBS em\s*(\d{2}/\d{2}/\d{4})", re.IGNORECASE)
_RES_NUMBER = re.compile(r"RESOLU[ÇC][ÃA]O\s+CGIBS\s+N[º°o]?\s*(\d+)", re.IGNORECASE)

_CARD = re.compile(r'<div class="artigo__listapaginas__item">([\s\S]*?)(?=<div class="artigo__listapaginas__item">|$)')
_CARD_LINK = re.compile(r'<h3 class="artigo__listapaginas__item__titulo">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)</a>')
_CARD_TIME = re.compile(r'<time[^>]*datetime="(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})')
_CARD_DESCRIPTION = re.compile(r'<p class="artigo__listapaginas__item__descricao">([\s\S]*?)</p>')


def parse_resolucoes(html: str) -> list[dict]:
    start = html.find('class="artigo__texto"')
    if start < 0:
        raise ValueError("Estrutura da página de Resoluções do CGIBS mudou (conteúdo não encontrado)")
    items: dict[str, dict] = {}
    for block in html[start:].split(_PANEL_START)[1:]:
        heading = _PANEL_TITLE.search(block)
        body = block[heading.end() :] if heading else block
        pdf = _PDF.search(body)
        if not pdf:
            continue
        # sem título no painel, vale o texto do link do PDF
        title = clean_text(html_to_text(heading.group(1) if heading else pdf.group(2)), 300)
        number = _RES_NUMBER.search(title) or _RES_NUMBER.search(html_to_text(pdf.group(2)))
        if not number:
            continue
        key = f"Resolução CGIBS {int(number.group(1))}"
        if key in items:
            # a página repete algumas resoluções (versão anterior abaixo da atual): vale a primeira
            continue
        summary = _STRONG.search(body[pdf.end() :])
        site_date = _SITE_DATE.search(html_to_text(body))
        url = urljoin(BASE_URL, pdf.group(1))
        items[key] = {
            "externalId": key,
            "title": title,
            "url": url,
            "kind": "resolucao",
            # data em que o CGIBS publicou no site; sem ela, a data de assinatura do título
            "publishedAt": parse_br_date(site_date.group(1)) if site_date else parse_br_date(title),
            "summary": clean_text(html_to_text(summary.group(1)), 1000) if summary else "",
            "fileUrl": url,
        }
    return list(items.values())


def parse_list_page(data) -> tuple[list[dict], int]:
    """Items of one page of the JSON list service and the total number of pages."""
    if isinstance(data, str):
        data = json.loads(data)
    if not isinstance(data, dict) or "body" not in data:
        raise ValueError("Resposta do serviço de listas do CGIBS em formato inesperado")
    items = []
    for card in _CARD.finditer(data["body"] or ""):
        link = _CARD_LINK.search(card.group(1))
        if not link:
            continue
        when = _CARD_TIME.search(card.group(1))
        description = _CARD_DESCRIPTION.search(card.group(1))
        path = link.group(1)
        items.append(
            {
                "externalId": path.strip("/"),
                "title": clean_text(decode_entities(html_to_text(link.group(2))), 400),
                "url": urljoin(BASE_URL, path),
                "publishedAt": when.group(1) if when else None,
                "summary": clean_text(html_to_text(description.group(1)), 1000) if description else "",
            }
        )
    return items, int(data.get("pagecount") or 1)


def list_items(fetch_text: Callable[[str], str], spec: dict, is_known: Callable[[str], bool]) -> list[dict]:
    """Comunicados or Notícias, newest first, page by page until a page is all known."""
    items: list[dict] = []
    page, pages = 1, 1
    while page <= min(pages, MAX_PAGES):
        url = (
            f"{BASE_URL}/_service/conteudo/pagedlistfilho?id={spec['id']}&templatename={spec['template']}"
            f"&currentPage={page}&pageSize={PAGE_SIZE}&{_LIST_FIELDS}"
        )
        found, pages = parse_list_page(fetch_text(url))
        items.extend(found)
        # página inteira já conhecida: o resto também é
        if found and all(is_known(item["externalId"]) for item in found):
            break
        page += 1
    return items


def collect(ctx: CollectContext) -> list[dict]:
    """Publicações: resolutions, communications and news of the CGIBS published in the period."""
    found = [
        *((res, "Resolução") for res in parse_resolucoes(ctx.fetch_text(RESOLUCOES_URL))),
        *((item, "Comunicado") for item in list_items(ctx.fetch_text, COMUNICADOS, ctx.is_known)),
        *((item, "Notícia") for item in list_items(ctx.fetch_text, NOTICIAS, ctx.is_known)),
    ]
    return [
        {
            "externalId": item["externalId"],
            "title": item["title"],
            "url": item["url"],
            "publishedAt": item["publishedAt"],
            "excerpt": item["summary"],
            "actType": act_type,
            "organ": "Comitê Gestor do IBS",
        }
        for item, act_type in found
        if item["publishedAt"] and item["publishedAt"] >= ctx.since
    ]
