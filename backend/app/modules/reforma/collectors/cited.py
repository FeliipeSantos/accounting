"""Official acts cited by the monitored documents, read from the DOU.

A news item may reproduce an official schedule ("as datas foram estabelecidas pelo Ato
Conjunto RFB/CGIBS nº 4, de 30 de julho de 2026"). The act itself is the source to rely on:
this collector finds every such citation (with the act's date), looks the act up in the DOU
of that day and the next ones, and stores its official text, tables kept as rows.

Lookups that find nothing are remembered for a week (a small JSON file next to the
downloaded files), so the DOU is not searched again every day.
"""

import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import text

from app.extensions import db
from app.modules.intelligence.collectors.dou import parse_dou_page
from app.modules.intelligence.text import add_days, clean_text, decode_entities, html_to_text, normalize_for_match, parse_br_date
from app.modules.reforma.collectors import SyncContext
from app.modules.reforma.collectors.pages import _TABLE, _table_as_lines

# atos publicados no DOU que os comunicados da Reforma costumam citar
_CITATION = re.compile(
    r"\b(Ato\s+(?:T[ée]cnico\s+)?Conjunto\s+RFB/CGIBS|Instru[çc][ãa]o\s+Normativa\s+RFB|Portaria\s+Conjunta(?:\s+[A-Z/]+)?|"
    r"Resolu[çc][ãa]o\s+CGSN|Decreto)\s+n[ºo°]?\.?\s*(\d[\d.]*)\s*,?\s+de\s+(\d{1,2}º?\s+de\s+[a-zç]+\s+de\s+\d{4})",
    re.IGNORECASE,
)
# a mesma citação sem a data do ato: "a Resolução CGSN nº 186, que estabelece os prazos..."
_UNDATED_CITATION = re.compile(
    r"\b(Ato\s+(?:T[ée]cnico\s+)?Conjunto\s+RFB/CGIBS|Instru[çc][ãa]o\s+Normativa\s+RFB|Portaria\s+Conjunta(?:\s+[A-Z/]+)?|"
    r"Resolu[çc][ãa]o\s+CGSN|Decreto)\s+n[ºo°]?\.?\s*(\d[\d.]*)\b",
    re.IGNORECASE,
)
# "ato conjunto rfb/cgibs n 4" -> ("ato conjunto rfb/cgibs", "4")
_ACT_KEY = re.compile(
    r"^(ato (?:tecnico )?conjunto rfb/cgibs|instrucao normativa rfb|portaria conjunta(?: [a-z/]+)?|resolucao cgsn|resolucao cgibs|"
    r"decreto|lei complementar|medida provisoria|lei)\s+n\s*\.?\s*(\d[\d.]*)"
)
_DOU_BODY = re.compile(r'<div class="texto-dou">([\s\S]*?)</div>\s*</div>')
# o ato pode sair no DOU dias depois da assinatura (a Resolução CGSN nº 191, de 4/8/2026, saiu
# na edição extra de 10/8): procura em 7 dias úteis a partir da data do ato
DOU_SEARCH_BUSINESS_DAYS = 7
DOU_SECTIONS = ["do1", "do1e"]
# atos de antes da Reforma (ex.: TIPI de 2022) não entram no calendário
ACTS_SINCE = "2025-01-01"
# dias com muitos atos citados: até 25 buscas por execução, dentro de 4 minutos; o que sobrar
# fica para a próxima execução (o mais recente primeiro)
MAX_LOOKUPS_PER_RUN = 25
LOOKUP_TIME_BUDGET = timedelta(minutes=4)
MISS_RETRY = timedelta(days=7)


def act_key(title: str) -> tuple[str, str] | None:
    """Kind and number of an act from its title or citation, the same for "ATO CONJUNTO
    RFB/CGIBS Nº 4, DE 30..." and "Ato Conjunto RFB/CGIBS nº 4"."""
    match = _ACT_KEY.match(normalize_for_match(decode_entities(title)).strip())
    if not match:
        return None
    return match.group(1), match.group(2).replace(".", "").lstrip("0")


def citations(body: str) -> list[tuple[tuple[str, str], str, str]]:
    """(act key, citation text, date of the act) of the DOU acts cited in a text."""
    found = []
    for match in _CITATION.finditer(body or ""):
        key = act_key(f"{match.group(1)} nº {match.group(2)}")
        date = parse_br_date(match.group(3))
        if key and date:
            found.append((key, clean_text(match.group(0), 200), date))
    return found


def undated_citations(body: str) -> list[tuple[tuple[str, str], str]]:
    """(act key, citation text) of the acts cited without their date ("Resolução CGSN nº 186")."""
    found = []
    for match in _UNDATED_CITATION.finditer(body or ""):
        key = act_key(f"{match.group(1)} nº {match.group(2)}")
        if key:
            found.append((key, clean_text(match.group(0), 200)))
    return found


def dou_text(html: str) -> str:
    """Official text of a DOU act page, tables kept as "cell | cell" rows."""
    match = _DOU_BODY.search(html)
    if not match:
        raise ValueError("Texto do ato não encontrado na página do DOU")
    return clean_text(html_to_text(_TABLE.sub(_table_as_lines, match.group(1)), 400_000), 400_000)


def _cache_path() -> Path:
    from app.modules.reforma.files import files_dir

    return files_dir() / "cited-acts-lookups.json"


def _load_cache() -> dict:
    try:
        return json.loads(_cache_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save_cache(cache: dict) -> None:
    path = _cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")


def _known_acts() -> set[tuple[str, str]]:
    titles = db.session.execute(text("SELECT title FROM reforma_documents WHERE kind IN ('norma', 'resolucao')")).scalars()
    return {key for key in (act_key(title) for title in titles) if key}


def _cited_in_documents() -> dict[tuple[str, str], tuple[str, str, bool]]:
    """Every DOU act cited by the stored texts: key -> (citation, date, before).

    With the act's date, the DOU is searched from that date on (before=False). Cited without
    it, the act was published before the text that cites it: the search goes back from the
    publication date of that text (before=True)."""
    cited: dict[tuple[str, str], tuple[str, str, bool]] = {}
    undated: dict[tuple[str, str], tuple[str, str, bool]] = {}
    rows = db.session.execute(
        text(
            "SELECT v.full_text, COALESCE(v.published_at, d.published_at) AS published_at FROM reforma_document_versions v "
            "JOIN reforma_documents d ON d.current_version_id = v.id "
            "WHERE v.full_text IS NOT NULL AND d.source_id != 'atos-citados'"
        )
    ).mappings()
    for row in rows:
        for key, citation, date in citations(row["full_text"]):
            cited.setdefault(key, (citation, date, False))
        if row["published_at"]:
            for key, citation in undated_citations(row["full_text"]):
                # a citação mais antiga dá a janela mais próxima da publicação do ato
                if key not in undated or row["published_at"] < undated[key][1]:
                    undated[key] = (citation, row["published_at"], True)
    for key, value in undated.items():
        cited.setdefault(key, value)
    return cited


def search_days(date: str, before: bool = False) -> list[str]:
    """DOU_SEARCH_BUSINESS_DAYS business days: the act's date and the next ones, or (before)
    the date of the text that cites it and the previous ones, the closest first."""
    days, offset = [], 0
    while len(days) < DOU_SEARCH_BUSINESS_DAYS:
        day = add_days(date, -offset if before else offset)
        if datetime.fromisoformat(day).weekday() < 5:
            days.append(day)
        offset += 1
    return days


def find_in_dou(ctx: SyncContext, key: tuple[str, str], date: str, before: bool = False, pages: dict | None = None) -> dict | None:
    """The act in the DOU of the search days (see search_days): {title, urlTitle, date}.

    pages: the DOU pages already read in this run, by address (buscas vizinhas leem os mesmos dias)."""
    pages = {} if pages is None else pages
    for day in search_days(date, before):
        y, m, d = day.split("-")
        for section in DOU_SECTIONS:
            address = f"https://www.in.gov.br/leiturajornal?data={d}-{m}-{y}&secao={section}"
            if address not in pages:
                pages[address] = parse_dou_page(ctx.fetch_text(address))
            for act in pages[address]:
                title = act.get("title") or act.get("titulo") or ""
                if act.get("urlTitle") and act_key(title) == key:
                    return {"title": clean_text(decode_entities(title), 500), "urlTitle": act["urlTitle"], "date": day}
    return None


def collect(ctx: SyncContext) -> list[dict]:
    known = _known_acts()
    cache = _load_cache()
    now = datetime.now(UTC)
    items, lookups, pages = [], 0, {}
    started = datetime.now(UTC)
    # o mais recente primeiro: é o que está valendo agora
    for key, (citation, date, before) in sorted(_cited_in_documents().items(), key=lambda entry: entry[1][1], reverse=True):
        cache_key = f"{key[0]}|{key[1]}|{'ate ' if before else ''}{date}"
        entry = cache.get(cache_key)
        if date < ACTS_SINCE or (key in known and not entry):
            continue
        # uma busca sem resultado feita com uma janela menor é refeita
        searched_fully = entry and entry.get("searchDays") == DOU_SEARCH_BUSINESS_DAYS
        if entry and entry.get("status") == "missing" and searched_fully and now - datetime.fromisoformat(entry["checkedAt"]) < MISS_RETRY:
            continue
        if entry and entry.get("status") == "found":
            found = entry
        else:
            if lookups >= MAX_LOOKUPS_PER_RUN or datetime.now(UTC) - started > LOOKUP_TIME_BUDGET:
                break
            lookups += 1
            found = find_in_dou(ctx, key, date, before, pages)
            status = "found" if found else "missing"
            cache[cache_key] = {
                "status": status,
                "checkedAt": now.isoformat(),
                "searchDays": DOU_SEARCH_BUSINESS_DAYS,
                **(found or {}),
                "citation": citation,
            }
            if not found:
                continue
        url = f"https://www.in.gov.br/web/dou/-/{found['urlTitle']}"
        items.append(
            {
                "externalId": found["urlTitle"],
                "title": found["title"],
                "url": url,
                "kind": "norma",
                "publishedAt": found["date"],
                "summary": f"Ato oficial citado em documento monitorado: {citation}",
                "contentText": dou_text(ctx.fetch_text(url)),
                "sourceStatus": "Diário Oficial da União",
            }
        )
    _save_cache(cache)
    return items
