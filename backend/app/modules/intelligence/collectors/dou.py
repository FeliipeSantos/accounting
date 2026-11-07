"""Diário Oficial da União — Seção 1 (and extra edition), via the JSON embedded in
the official "leitura do jornal" page."""

import json
import re

from app.modules.intelligence.collectors import CollectContext, encode_uri_component
from app.modules.intelligence.text import add_days, clean_text, decode_entities, parse_br_date

MAX_DAYS_BACK = 7
SECTIONS = ["do1", "do1e"]

# Órgãos de interesse contábil/fiscal/trabalhista (primeiro nível da hierarquia)
ORGANS = [
    "Ministério da Fazenda",
    "Presidência da República",
    "Atos do Poder Legislativo",
    "Atos do Poder Executivo",
    "Congresso Nacional",
    "Ministério do Trabalho e Emprego",
    "Ministério da Previdência Social",
]

# Tipos sem conteúdo normativo (pautas de julgamento, atas)
IGNORED_TYPES = {"Pauta", "Ata", "Extrato da Ata"}

_PARAMS = re.compile(r'<script id="params" type="application/json">([\s\S]*?)</script>')


def parse_dou_page(html: str) -> list[dict]:
    """Acts listed on the page; raises if the page layout changed."""
    match = _PARAMS.search(html)
    if not match:
        raise ValueError('Estrutura da página do DOU mudou (bloco "params" não encontrado)')
    params = json.loads(match.group(1))
    if not isinstance(params.get("jsonArray"), list):
        raise ValueError("Estrutura da página do DOU mudou (jsonArray ausente)")
    return params["jsonArray"]


def _to_item(act: dict) -> dict:
    return {
        "externalId": act["urlTitle"],
        "title": clean_text(decode_entities(act.get("title") or act.get("titulo") or ""), 500),
        "url": f"https://www.in.gov.br/web/dou/-/{encode_uri_component(act['urlTitle'])}",
        "publishedAt": parse_br_date(act.get("pubDate")),
        "excerpt": clean_text(decode_entities(act.get("content") or "")),
        "actType": act.get("artType") or "",
        "organ": act.get("hierarchyStr") or "",
    }


def _is_of_interest(act: dict) -> bool:
    if not act.get("urlTitle") or act.get("artType") in IGNORED_TYPES:
        return False
    organ = act.get("hierarchyStr") or ""
    return any(organ == o or organ.startswith(f"{o}/") for o in ORGANS)


def collect(ctx: CollectContext) -> list[dict]:
    oldest = add_days(ctx.today, -MAX_DAYS_BACK)
    day = ctx.since if ctx.since > oldest else oldest
    items = []
    while day <= ctx.today:
        y, m, d = day.split("-")
        for section in SECTIONS:
            html = ctx.fetch_text(f"https://www.in.gov.br/leiturajornal?data={d}-{m}-{y}&secao={section}")
            items.extend(_to_item(act) for act in parse_dou_page(html) if _is_of_interest(act))
        day = add_days(day, 1)
    return items
