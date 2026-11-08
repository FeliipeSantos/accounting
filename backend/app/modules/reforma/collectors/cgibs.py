"""Comitê Gestor do IBS for the Calendário: Resoluções (with the official PDF), Comunicados
Oficiais and Notícias. The parsers live in the Publicações module (intelligence/collectors/cgibs.py),
which also lists these items; here the resolutions keep their versions and PDFs.
"""

from app.modules.intelligence.collectors.cgibs import COMUNICADOS, NOTICIAS, RESOLUCOES_URL, list_items, parse_list_page, parse_resolucoes
from app.modules.reforma.collectors import SyncContext

__all__ = ["collect_comunicados", "collect_noticias", "collect_resolucoes", "parse_list_page", "parse_resolucoes"]


def collect_resolucoes(ctx: SyncContext) -> list[dict]:
    return parse_resolucoes(ctx.fetch_text(RESOLUCOES_URL))


def collect_comunicados(ctx: SyncContext) -> list[dict]:
    return [{**item, "kind": "comunicado"} for item in list_items(ctx.fetch_text, COMUNICADOS, lambda key: key in ctx.known)]


def collect_noticias(ctx: SyncContext) -> list[dict]:
    return [{**item, "kind": "noticia"} for item in list_items(ctx.fetch_text, NOTICIAS, lambda key: key in ctx.known)]
