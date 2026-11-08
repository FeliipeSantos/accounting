"""Collectors of the Calendário module.

Each collector receives a SyncContext and returns items (dicts):

    externalId    stable key of the document in its source (required)
    title, url    required; url must be on an official domain
    kind          one of catalog.KINDS
    publishedAt   yyyy-mm-dd or None
    summary       short description given by the source
    versionLabel  version given by the source (e.g. "v1.53"), when it has one
    fileUrl       official file (PDF) of this version, when there is one
    contentText   full text already in the listing (part of the version: a change is a new version)
    fullText      full text known now but not part of the version identity (e.g. read by another module)
    sourceStatus  status given by the source (e.g. "vigente")
"""

from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass
class SyncContext:
    fetch_text: Callable[[str], str]
    fetch_json: Callable[[str], object]
    today: str
    # documentos já conhecidos desta fonte (para parar a paginação cedo)
    known: set[str] = field(default_factory=set)
    # última coleta bem-sucedida desta fonte (ISO), para ler só o que é novo
    last_success_at: str | None = None


def registry() -> dict[str, Callable[[SyncContext], list[dict]]]:
    from app.modules.reforma.collectors import cff, cgibs, cited, intel, nfe, pages, receita

    return {
        "intel": intel.collect,
        "nfe-nt": nfe.collect_notas_tecnicas,
        "nfe-avisos": nfe.collect_avisos,
        "cgibs-resolucoes": cgibs.collect_resolucoes,
        "cgibs-comunicados": cgibs.collect_comunicados,
        "cgibs-noticias": cgibs.collect_noticias,
        "cff-noticias": cff.collect,
        "receita-rt": receita.collect,
        "receita-noticias": receita.collect_news,
        "paginas": pages.collect,
        "atos-citados": cited.collect,
    }
