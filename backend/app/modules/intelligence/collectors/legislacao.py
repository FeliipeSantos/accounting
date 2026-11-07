"""Legislação Federal — Senado Federal open data API (laws, complementary laws,
decrees, provisional measures and constitutional amendments)."""

from app.modules.intelligence.collectors import CollectContext, encode_uri_component
from app.modules.intelligence.text import clean_text, parse_br_date

API_URL = "https://legis.senado.leg.br/dadosabertos/legislacao/lista"
TYPES = ["EMC", "LCP", "LEI", "MPV", "DEC"]


def _js_text(value) -> str:
    """Value as JavaScript prints it in a template string (None -> "undefined")."""
    return "undefined" if value is None else str(value)


def parse_list(data) -> list[dict]:
    lista = data.get("ListaDocumento") if isinstance(data, dict) else None
    documentos = lista.get("documentos") if isinstance(lista, dict) else None
    docs = documentos.get("documento") if isinstance(documentos, dict) else None
    if docs is None:
        if lista:
            return []  # ano sem normas desse tipo
        raise ValueError("Resposta da API do Senado em formato inesperado")
    return [
        {
            "externalId": str(doc["id"]),
            "title": clean_text(doc.get("normaNome") or f"{_js_text(doc.get('descricao'))} nº {_js_text(doc.get('numero'))}", 500),
            "url": f"https://legis.senado.leg.br/norma/{encode_uri_component(doc['id'])}",
            # a API informa a data de assinatura; a publicação no DOU costuma ser no mesmo dia ou no seguinte
            "publishedAt": parse_br_date(doc.get("dataassinatura")),
            "excerpt": clean_text(doc.get("ementa") or ""),
            "actType": doc.get("descricao") or doc.get("tipo") or "",
            "organ": "Presidência da República / Congresso Nacional",
        }
        for doc in (docs if isinstance(docs, list) else [docs])
    ]


def collect(ctx: CollectContext) -> list[dict]:
    years = list(dict.fromkeys([ctx.since[:4], ctx.today[:4]]))
    items = []
    for year in years:
        for kind in TYPES:
            items.extend(parse_list(ctx.fetch_json(f"{API_URL}?tipo={kind}&ano={year}")))
    return [item for item in items if item["publishedAt"] and item["publishedAt"] >= ctx.since]
