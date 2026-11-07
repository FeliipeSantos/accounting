"""CONFAZ — Convênios ICMS. The yearly listing gives number and summary; the
publication date comes from each convênio page ("Publicado no DOU de dd.mm.aa")."""

import re

from app.modules.intelligence.collectors import CollectContext
from app.modules.intelligence.text import clean_text, decode_entities, html_to_text, parse_br_date

BASE_URL = "https://www.confaz.fazenda.gov.br/legislacao/convenios"
# Limita páginas de detalhe por execução (só convênios ainda não coletados)
MAX_DETAILS_PER_RUN = 15

_PUBLISHED = re.compile(r"Publicado no DOU de\s*([\d./]+)", re.IGNORECASE)
_HEADING = re.compile(r"CONV[ÊE]NIO ICMS N[º°o]?\s*\d+\s*,?\s*DE\s+([^\n.]+?\d{4})", re.IGNORECASE)


def parse_year_list(html: str, year: str) -> list[dict]:
    pattern = re.compile(rf'<a href="({re.escape(BASE_URL)}/{year}/(CV(\d+)_\d+))" title="([^"]*)"[^>]*>\s*<span>([^<]*)</span>')
    items = [
        {
            "externalId": m.group(2),
            "number": int(m.group(3)),
            "url": m.group(1),
            "title": clean_text(decode_entities(m.group(5)), 500),
            "excerpt": clean_text(decode_entities(m.group(4))),
        }
        for m in pattern.finditer(html)
    ]
    if not items and "navTree" not in html:
        raise ValueError("Estrutura da página de convênios do CONFAZ mudou")
    return items


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


def collect(ctx: CollectContext) -> list[dict]:
    years = list(dict.fromkeys([ctx.since[:4], ctx.today[:4]]))
    listed = []
    for year in years:
        listed.extend(parse_year_list(ctx.fetch_text(f"{BASE_URL}/{year}"), year))

    # A numeração é sequencial: percorre do mais novo para o mais antigo e para no
    # primeiro já coletado, para não avançar sobre convênios antigos a cada execução.
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
            continue
        items.append(
            {
                "externalId": item["externalId"],
                "title": detail["title"] or item["title"],
                "url": item["url"],
                "publishedAt": detail["publishedAt"],
                "excerpt": item["excerpt"],
                "actType": "Convênio ICMS",
                "organ": "CONFAZ",
            }
        )
    return items
