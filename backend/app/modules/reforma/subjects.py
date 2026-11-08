"""Subjects of the calendar events (Reforma Tributária, ICMS, Simples Nacional...), the same
list and keyword rules as the Publicações module, so a filter means the same in both.

An event gets the subjects of:
    - its source, when the whole source is about one subject (Notas Técnicas: documentos
      fiscais; Comitê Gestor do IBS: IBS/CBS and Reforma; Protocolos ICMS: ICMS);
    - the publication it came from, when it came from the Publicações module;
    - the keywords found in the act's title, summary, the start of its text (where the
      ementa is) and the excerpt of the date; besides the Publicações keywords, the CGIBS
      and the names of the electronic fiscal documents (BP-e, NF3e, NFCom, DeRE...).
IBS/CBS and Imposto Seletivo also count as Reforma Tributária, so "Reforma" finds them all.
"""

import re

from sqlalchemy import text

from app.extensions import db
from app.modules.intelligence.catalog import SUBJECTS
from app.modules.intelligence.classifier import match_subjects
from app.modules.intelligence.text import normalize_for_match

REFORM = "reforma-tributaria"
_PART_OF_REFORM = {"ibs-cbs", "imposto-seletivo"}
_ORDER = {subject["id"]: index for index, subject in enumerate(SUBJECTS)}

SOURCE_SUBJECTS = {
    "nfe-nt": ["documentos-fiscais"],
    "nfe-avisos": ["documentos-fiscais"],
    "cff-noticias": ["documentos-fiscais"],
    "cgibs-resolucoes": ["ibs-cbs", REFORM],
    "cgibs-comunicados": ["ibs-cbs", REFORM],
    "cgibs-noticias": ["ibs-cbs", REFORM],
    "receita-rt": [REFORM],
    "confaz-protocolos": ["icms"],
}


# termos dos atos da Reforma e dos documentos fiscais que a lista do Publicações não tem
_EXTRA = {
    "ibs-cbs": re.compile(r"\bcgibs\b"),
    "documentos-fiscais": re.compile(
        r"\b(?:df-e|dfe|bp-e|nf3e|nfcom|gtv-e|dc-e|nfag|nfgas|cte-os|mdfe|nfse|dere|duimp|"
        r"documentos? fisca(?:l|is) eletronicos?|declaracao de importacao de remessa)\b"
    ),
    # programas de conformidade (Sintonia, Confia): classificam o contribuinte pelo cumprimento
    # das obrigações, principais e acessórias
    "obrigacoes-acessorias": re.compile(r"\b(?:sintonia|programa confia|conformidade tributaria)\b"),
    # tributação dos combustíveis (alíquotas de PIS/Cofins e Cide, subvenção ao etanol)
    "pis-cofins": re.compile(r"\b(?:biocombustiveis|etanol hidratado combustivel|cide[- ]combustiveis)\b"),
}


def subject_list() -> list[dict]:
    """[{id, name}] for the filter, in the Publicações order."""
    return [{"id": subject["id"], "name": subject["name"]} for subject in SUBJECTS]


def _intel_subjects(publication_ids: list[str]) -> dict[str, set[str]]:
    found: dict[str, set[str]] = {}
    for start in range(0, len(publication_ids), 500):
        names = {f"p{i}": pid for i, pid in enumerate(publication_ids[start : start + 500])}
        rows = db.session.execute(
            text(
                "SELECT publication_id, subject_id FROM intel_publication_subjects "
                f"WHERE publication_id IN ({', '.join(':' + name for name in names)})"
            ),
            names,
        )
        for publication_id, subject_id in rows:
            found.setdefault(publication_id, set()).add(subject_id)
    return found


def subjects_of(rows: list[dict]) -> list[list[str]]:
    """Subjects of each event row (with doc_source, doc_external, doc_title, version_summary,
    title and quote), in the same order."""
    intel = _intel_subjects([r["doc_external"] for r in rows if r["doc_source"] == "intel" and r.get("doc_external")])
    result = []
    for r in rows:
        found = set(SOURCE_SUBJECTS.get(r["doc_source"], []))
        found |= intel.get(r.get("doc_external") or "", set())
        body = f"{r['doc_title']}\n{r.get('version_summary') or ''}\n{r.get('text_head') or ''}\n{r['title']}\n{r['quote']}"
        found |= set(match_subjects(body))
        normalized = normalize_for_match(body)
        found |= {subject for subject, pattern in _EXTRA.items() if pattern.search(normalized)}
        if found & _PART_OF_REFORM:
            found.add(REFORM)
        result.append(sorted(found, key=lambda sid: _ORDER.get(sid, 99)))
    return result
