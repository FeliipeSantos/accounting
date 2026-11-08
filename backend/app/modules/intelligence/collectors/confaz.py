"""CONFAZ — Convênios ICMS and Protocolos ICMS (mostly substituição tributária).

Both have the same yearly listing (number and summary) on the official site; the
publication date comes from each act's page ("Publicado no DOU de dd.mm.aa"). Ajustes
SINIEF require login on the site and come from the DOU.
"""

import re

from app.modules.intelligence.collectors import CollectContext
from app.modules.intelligence.text import clean_text, decode_entities, html_to_text, parse_br_date

SITE = "https://www.confaz.fazenda.gov.br/legislacao"
BASE_URL = f"{SITE}/convenios"
# tipo de ato: pasta do site, prefixo do identificador e nome exibido
ACTS = [
    {"folder": "convenios", "prefix": "CV", "actType": "Convênio ICMS"},
    {"folder": "protocolos", "prefix": "pt", "actType": "Protocolo ICMS"},
]
# Limita páginas de detalhe por execução e por tipo de ato (só os ainda não coletados)
MAX_DETAILS_PER_RUN = 15

_PUBLISHED = re.compile(r"Publicado no DOU de\s*([\d./]+)", re.IGNORECASE)
_HEADING = re.compile(r"(?:CONV[ÊE]NIO|PROTOCOLO) ICMS N[º°o]?\s*\d+\s*,?\s*DE\s+([^\n.]+?\d{4})", re.IGNORECASE)


def parse_year_list(html: str, year: str, folder: str = "convenios", prefix: str = "CV") -> list[dict]:
    base = f"{SITE}/{folder}"
    pattern = re.compile(rf'<a href="({re.escape(base)}/{year}/({prefix}(\d+)_\d+))" title="([^"]*)"[^>]*>\s*<span>([^<]*)</span>')
    items: dict[str, dict] = {}
    for m in pattern.finditer(html):
        # a lista do CONFAZ repete alguns itens; vale o primeiro
        items.setdefault(
            m.group(2),
            {
                "externalId": m.group(2),
                "number": int(m.group(3)),
                "url": m.group(1),
                "title": clean_text(decode_entities(m.group(5)), 500),
                "excerpt": clean_text(decode_entities(m.group(4))),
            },
        )
    if not items and "navTree" not in html:
        raise ValueError(f"Estrutura da página de {folder} do CONFAZ mudou")
    return list(items.values())


def parse_detail(html: str) -> dict:
    # lê só o bloco de conteúdo e sem limite de tamanho (o cabeçalho do site é longo)
    start = html.find("parent-fieldname-text")
    text = html_to_text(html[start:] if start >= 0 else html, float("inf"))
    published = _PUBLISHED.search(text)
    heading = _HEADING.search(text)
    return {
        "publishedAt": parse_br_date(published.group(1) if published else None) or parse_br_date(heading.group(1) if heading else None),
        "title": clean_text(heading.group(0), 500) if heading else None,
    }


def _collect_acts(ctx: CollectContext, act: dict) -> list[dict]:
    years = list(dict.fromkeys([ctx.since[:4], ctx.today[:4]]))
    listed = []
    for year in years:
        listed.extend(parse_year_list(ctx.fetch_text(f"{SITE}/{act['folder']}/{year}"), year, act["folder"], act["prefix"]))

    # A numeração é sequencial: percorre do mais novo para o mais antigo e para no
    # primeiro já coletado, para não avançar sobre atos antigos a cada execução.
    newest_first = sorted(listed, key=lambda item: (item["externalId"][-2:], item["number"]), reverse=True)
    pending = []
    for item in newest_first:
        if ctx.is_known(item["externalId"]) or len(pending) >= MAX_DETAILS_PER_RUN:
            break
        pending.append(item)

    items = []
    for item in pending:
        # sem a linha de publicação na página, a data fica em branco (não é deduzida)
        detail = parse_detail(ctx.fetch_text(item["url"]))
        if detail["publishedAt"] and detail["publishedAt"] < ctx.since:
            # do mais novo para o mais antigo: os seguintes também são de antes do período
            break
        items.append(
            {
                "externalId": item["externalId"],
                "title": detail["title"] or item["title"],
                "url": item["url"],
                "publishedAt": detail["publishedAt"],
                "excerpt": item["excerpt"],
                "actType": act["actType"],
                "organ": "CONFAZ",
            }
        )
    return items


def collect(ctx: CollectContext) -> list[dict]:
    return [item for act in ACTS for item in _collect_acts(ctx, act)]
