"""Câmara dos Deputados — bills (PL, PLP, PEC) via the open data API v2."""

import re
from urllib.parse import urlencode

from app.modules.intelligence.collectors import CollectContext, encode_uri_component
from app.modules.intelligence.text import add_days, clean_text

API_URL = "https://dadosabertos.camara.leg.br/api/v2/proposicoes"
TYPES = ["PL", "PLP", "PEC"]
TYPE_NAMES = {"PL": "Projeto de Lei", "PLP": "Projeto de Lei Complementar", "PEC": "Proposta de Emenda à Constituição"}
MAX_DAYS_BACK = 7
PAGE_SIZE = 100
MAX_PAGES = 10
# A API da Câmara costuma levar ~9 s por página
TIMEOUT_MS = 45000

_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}")
_TIME = re.compile(r"T(\d{2}:\d{2})")


def parse_page(data) -> list[dict]:
    if not isinstance(data, dict) or not isinstance(data.get("dados"), list):
        raise ValueError("Resposta da API da Câmara em formato inesperado")
    items = []
    for p in data["dados"]:
        # dataApresentacao vem como "2026-11-05T16:19"
        presented = str(p.get("dataApresentacao") or "")
        date = _DATE.search(presented)
        time = _TIME.search(presented)
        items.append(
            {
                "externalId": str(p["id"]),
                "title": f"{p.get('siglaTipo')} {p.get('numero')}/{p.get('ano')}",
                "url": f"https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao={encode_uri_component(p['id'])}",
                "publishedAt": date.group(0) if date else None,
                "publishedTime": time.group(1) if time else None,
                "excerpt": clean_text(p.get("ementa") or ""),
                "actType": TYPE_NAMES.get(p.get("siglaTipo")) or p.get("siglaTipo"),
                "organ": "Câmara dos Deputados",
            }
        )
    return items


def collect(ctx: CollectContext) -> list[dict]:
    oldest = add_days(ctx.today, -MAX_DAYS_BACK)
    start = ctx.since if ctx.since > oldest else oldest
    items = []
    for page in range(1, MAX_PAGES + 1):
        params = urlencode(
            {
                "siglaTipo": ",".join(TYPES),
                "dataApresentacaoInicio": start,
                "dataApresentacaoFim": ctx.today,
                "ordem": "DESC",
                "ordenarPor": "id",
                "itens": str(PAGE_SIZE),
                "pagina": str(page),
            }
        )
        batch = parse_page(ctx.fetch_json(f"{API_URL}?{params}", timeout_ms=TIMEOUT_MS))
        items.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
    return items
