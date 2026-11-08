"""Portal da Conformidade Fácil (SVRS) for the Calendário. The parser lives in the Publicações
module (intelligence/collectors/cff.py), which also lists these news items."""

from app.modules.intelligence.collectors.cff import LIST_URL, parse_list
from app.modules.reforma.collectors import SyncContext

__all__ = ["collect", "parse_list"]


def collect(ctx: SyncContext) -> list[dict]:
    return parse_list(ctx.fetch_text(LIST_URL))
