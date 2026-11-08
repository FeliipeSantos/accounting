"""Receita Federal: the "Reforma Tributária" section (official RSS feed, RDF/RSS 1.0) and
the general news of the Receita, where many Reforma announcements are published instead
(e.g. "NFS-e Nacional será obrigatória para ME e EPP a partir de 1º de novembro de 2026").

The news listing (/assuntos/noticias) is a gov.br (Plone) page with 30 items per page
(?b_start:int=30...). Daily runs read its first pages; the first run reads every month
since 2025 from the monthly folders (/noticias/2026/agosto). Only news about the Reforma
(IBS, CBS, documentos fiscais, Simples Nacional...) are kept.
"""

import re
from datetime import date

from app.modules.intelligence.collectors.govbr_news import parse_news_list
from app.modules.intelligence.text import clean_text, decode_entities, html_to_text, normalize_for_match
from app.modules.reforma.collectors import SyncContext

FEED_URL = "https://www.gov.br/receitafederal/pt-br/assuntos/reforma-tributaria/RSS"

_ITEM = re.compile(r"<item\b[\s\S]*?</item>")
_FIELD = {
    "title": re.compile(r"<title>([\s\S]*?)</title>"),
    "link": re.compile(r"<link>([\s\S]*?)</link>"),
    "description": re.compile(r"<description>([\s\S]*?)</description>"),
    "date": re.compile(r"<dc:date>(\d{4}-\d{2}-\d{2})"),
}


def parse_feed(xml: str) -> list[dict]:
    if "<rdf:RDF" not in xml and "<rss" not in xml:
        raise ValueError("Feed RSS da Reforma Tributária (Receita Federal) em formato inesperado")
    items = []
    for block in _ITEM.findall(xml):
        found = {name: pattern.search(block) for name, pattern in _FIELD.items()}
        if not found["title"] or not found["link"]:
            continue
        link = decode_entities(found["link"].group(1).strip())
        items.append(
            {
                "externalId": link,
                "title": clean_text(decode_entities(found["title"].group(1)), 400),
                "url": link,
                # itens da seção são serviços e orientações, não normas
                "kind": "comunicado",
                "publishedAt": found["date"].group(1) if found["date"] else None,
                "summary": clean_text(html_to_text(decode_entities(found["description"].group(1))), 1000) if found["description"] else "",
            }
        )
    return items


def collect(ctx: SyncContext) -> list[dict]:
    return parse_feed(ctx.fetch_text(FEED_URL))


NEWS_URL = "https://www.gov.br/receitafederal/pt-br/assuntos/noticias"
NEWS_PAGE_SIZE = 30
# coleta diária: as primeiras páginas bastam (cerca de um mês de notícias)
MAX_RECENT_PAGES = 3
# primeira coleta: cada mês desde o início da Reforma, até esgotar as páginas do mês
FIRST_MONTH = (2025, 1)
MAX_PAGES_PER_MONTH = 6
_MONTHS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]

# assuntos da Reforma no título ou no resumo (texto sem acentos, minúsculo)
_REFORMA = re.compile(
    r"reforma tributaria|\b(?:ibs|cbs)\b|imposto seletivo|\bnfs-?e\b|\bnfc?-?e\b|\bct-?e\b|\bdf-?e\b|documentos? fisca|split payment|"
    r"cgibs|comite gestor|regime regular|regimes? especific|simples nacional|nanoempreendedor|\bmei\b|ato conjunto|"
    r"lei complementar (?:n\s*)?214|\blc 214|cashback|conformidade facil|\bdere\b|cadastro imobiliario|\bcib\b"
)


def is_reforma_news(item: dict) -> bool:
    return bool(_REFORMA.search(normalize_for_match(f"{item.get('title', '')} {item.get('excerpt', '')}")))


def _months(today: str) -> list[str]:
    year, month = FIRST_MONTH
    end = date.fromisoformat(today)
    found = []
    while (year, month) <= (end.year, end.month):
        found.append(f"{year}/{_MONTHS[month - 1]}")
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return found


def _paged(ctx: SyncContext, url: str, max_pages: int, stop_when_known: bool) -> list[dict]:
    items = []
    for page in range(max_pages):
        listed = parse_news_list(ctx.fetch_text(f"{url}?b_start:int={page * NEWS_PAGE_SIZE}" if page else url), "Receita Federal")
        items.extend(listed)
        if len(listed) < NEWS_PAGE_SIZE or (stop_when_known and all(item["externalId"] in ctx.known for item in listed)):
            break
    return items


def collect_news(ctx: SyncContext) -> list[dict]:
    if ctx.known:
        listed = _paged(ctx, NEWS_URL, MAX_RECENT_PAGES, stop_when_known=True)
    else:
        listed = [
            item for month in _months(ctx.today) for item in _paged(ctx, f"{NEWS_URL}/{month}", MAX_PAGES_PER_MONTH, stop_when_known=False)
        ]
    seen: set[str] = set()
    items = []
    for item in listed:
        if item["externalId"] in seen or not is_reforma_news(item):
            continue
        seen.add(item["externalId"])
        items.append(
            {
                "externalId": item["externalId"],
                "title": item["title"],
                "url": item["url"],
                "kind": "noticia",
                "publishedAt": item["publishedAt"],
                "summary": item["excerpt"],
            }
        )
    return items
