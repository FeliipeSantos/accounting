"""Portal da NF-e — Notas Técnicas and Avisos for the Calendário (versions and official PDFs).

The parsers live in the Publicações module (intelligence/collectors/nfe.py), which also lists
these items; here each NT is one document whose versions are kept, with its PDF.
"""

from app.modules.intelligence.collectors.nfe import NT_LIST_URL, avisos_url, parse_avisos, parse_notas_tecnicas
from app.modules.reforma.collectors import SyncContext


def collect_notas_tecnicas(ctx: SyncContext) -> list[dict]:
    return parse_notas_tecnicas(ctx.fetch_text(NT_LIST_URL))


def collect_avisos(ctx: SyncContext) -> list[dict]:
    return parse_avisos(ctx.fetch_text(avisos_url()))
