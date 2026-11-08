"""Rule-based classification (no AI): subjects by keywords, relevance by act type,
and norm type / effective date by explicit phrases in the official text."""

import re

from app.modules.intelligence.catalog import SOURCES, SUBJECTS
from app.modules.intelligence.text import normalize_for_match, parse_br_date

# Peso por tipo de ato (prefixo normalizado do tipo, peso, nome exibido).
# Ordem importa: o mais específico primeiro.
ACT_WEIGHTS = [
    ("emenda constitucional", 3, "Emenda Constitucional"),
    ("lei complementar", 3, "Lei Complementar"),
    ("medida provisoria", 3, "Medida Provisória"),
    ("lei", 3, "Lei"),
    ("decreto", 2, "Decreto"),
    ("instrucao normativa", 2, "Instrução Normativa"),
    ("resolucao", 2, "Resolução"),
    ("convenio", 2, "Convênio"),
    ("ajuste", 2, "Ajuste"),
    ("protocolo", 2, "Protocolo"),
    ("portaria conjunta", 2, "Portaria Conjunta"),
    ("portaria normativa", 2, "Portaria Normativa"),
    ("portaria", 1, "Portaria"),
    ("ato declaratorio", 1, "Ato Declaratório"),
    ("solucao de consulta", 1, "Solução de Consulta"),
    ("parecer normativo", 1, "Parecer Normativo"),
    ("nota tecnica", 1, "Nota Técnica"),
    ("ato cotepe", 1, "Ato COTEPE"),
    ("despacho", 1, "Despacho"),
]

REFORM_SUBJECTS = {"reforma-tributaria", "ibs-cbs", "imposto-seletivo"}

# Regras legíveis, mostradas na tela de configurações
RULES_DESCRIPTION = [
    "Assuntos: palavras-chave encontradas no título ou no trecho oficial (sem acentos, palavra inteira). "
    "Simples Nacional, CONFAZ, SPED e eSocial já trazem o assunto da própria fonte.",
    "Peso do ato: 3 para Emenda Constitucional, Lei Complementar, Lei e Medida Provisória; 2 para Decreto, Instrução Normativa, "
    "Resolução, Convênio, Ajuste, Protocolo e Portarias conjuntas/normativas; 1 para Portaria, Ato Declaratório, Solução de Consulta, "
    "Parecer Normativo, Nota Técnica e Despacho; 0 para notícias, comunicados e projetos de lei.",
    "Relevância: peso do ato + 1 se tratar da Reforma Tributária (IBS, CBS ou Imposto Seletivo). 4 ou mais = Crítica, 3 = Alta, "
    "1–2 = Média, 0 = Baixa.",
    "Classificação: projetos de lei vêm da Câmara; notícias e comunicados são informativos; para normas, a vigência só é indicada "
    "quando o texto oficial a declara expressamente.",
]


def _word_pattern(term: str) -> re.Pattern:
    return re.compile(rf"(^|[^a-z0-9]){re.escape(normalize_for_match(term))}($|[^a-z0-9])")


_KEYWORDS = {s["id"]: [(k, _word_pattern(k)) for k in s["keywords"]] for s in SUBJECTS}
_EXCLUDES = {s["id"]: [_word_pattern(k) for k in s.get("exclude", [])] for s in SUBJECTS}
_SOURCES_BY_ID = {s["id"]: s for s in SOURCES}


def match_subjects_detailed(text: str) -> list[dict]:
    """Subjects whose keywords appear in the text (and none of whose exclusion
    terms do), with the keywords found: [{"id", "terms"}]."""
    normalized = normalize_for_match(text)
    matches = []
    for subject in SUBJECTS:
        terms = [term for term, pattern in _KEYWORDS[subject["id"]] if pattern.search(normalized)]
        excluded = any(pattern.search(normalized) for pattern in _EXCLUDES[subject["id"]])
        if terms and not excluded:
            matches.append({"id": subject["id"], "terms": terms})
    return matches


def match_subjects(text: str) -> list[str]:
    return [m["id"] for m in match_subjects_detailed(text)]


def act_rule(act_type: str | None, title: str | None = None) -> tuple[int, str | None]:
    """Weight and label of the act type. The title is used only when the source gives
    no type, so a news headline mentioning "Lei ..." is not weighed as a law."""
    candidate = normalize_for_match(act_type or title).strip()
    if not candidate:
        return 0, None
    for prefix, weight, label in ACT_WEIGHTS:
        # prefixo seguido de fim ou não-letra: "lei" não casa com "leilao"
        following = candidate[len(prefix) : len(prefix) + 1]
        if candidate.startswith(prefix) and not re.match(r"[a-z]", following):
            return weight, label
    return 0, None


def act_weight(act_type: str | None, title: str | None = None) -> int:
    return act_rule(act_type, title)[0]


def relevance_from_score(score: int) -> str:
    if score >= 4:
        return "critica"
    if score == 3:
        return "alta"
    if score >= 1:
        return "media"
    return "baixa"


EFFECTIVE_ON_PUBLICATION = re.compile(r"entr(?:a|ara) em vigor na data de (?:sua )?publicacao")
EFFECTIVE_ON_DATE = re.compile(
    r"(?:entr(?:a|ara) em vigor|produz(?:indo|ira|e)? efeitos?)\s+(?:a partir\s+)?(?:de|em|do dia)\s+"
    r"(\d{1,2}\s*(?:o\s*)?de\s+[a-z]+\s+de\s+\d{4})"
)


TECHNICAL_DOCUMENT = "Documento técnico"
# leiautes e regras de validação (Notas Técnicas da NF-e): não são normas; as datas de
# produção vêm no próprio documento
_TECHNICAL_ACTS = re.compile(r"^nota tecnica\b")


def detect_norm_type(source_id: str, weight: int, text: str, published_at: str | None, act_type: str | None = None) -> dict:
    """Norm type and effective date, only from explicit phrases."""
    if _TECHNICAL_ACTS.match(normalize_for_match(act_type or "").strip()):
        return {"normType": TECHNICAL_DOCUMENT, "effectiveDate": None}
    if source_id == "camara":
        return {"normType": "Projeto de lei", "effectiveDate": None}
    if weight == 0:
        return {"normType": "Comunicado informativo", "effectiveDate": None}

    normalized = normalize_for_match(text)
    if EFFECTIVE_ON_PUBLICATION.search(normalized):
        return {"normType": "Norma vigente", "effectiveDate": published_at or None}
    dated = EFFECTIVE_ON_DATE.search(normalized)
    if dated:
        effective = parse_br_date(dated.group(1))
        if effective:
            future = effective > published_at if published_at else False
            return {"normType": "Norma com vigência futura" if future else "Norma vigente", "effectiveDate": effective}
    return {"normType": "Norma publicada (vigência não identificada no trecho)", "effectiveDate": None}


def classify(item: dict, enabled_subjects: list[str]) -> dict:
    """Classifies a collected item and records why (shown to the user).

    Returns relevant, subjects, relevance, normType, effectiveDate and
    classificationReason {actType, actLabel, weight, reformBonus, reformSubjects, score,
    subjects: [{id, via: "source"|"keywords", terms}]}.
    """
    enabled = set(enabled_subjects)
    source = _SOURCES_BY_ID.get(item.get("sourceId"))
    text = f"{item.get('title')}\n{item.get('excerpt') or ''}"

    matched = {m["id"]: m["terms"] for m in match_subjects_detailed(text)}
    candidates = list(dict.fromkeys([*(source or {}).get("defaultSubjects", []), *matched]))
    subjects = [sid for sid in candidates if sid in enabled]
    weight, label = act_rule(item.get("actType"), item.get("title"))
    reform_subjects = [sid for sid in subjects if sid in REFORM_SUBJECTS]
    reform_bonus = 1 if reform_subjects else 0
    score = weight + reform_bonus

    return {
        "relevant": len(subjects) > 0,
        "subjects": subjects,
        "relevance": relevance_from_score(score),
        **detect_norm_type(item.get("sourceId"), weight, text, item.get("publishedAt"), item.get("actType")),
        "classificationReason": {
            "actType": item.get("actType") or None,
            "actLabel": label,
            "weight": weight,
            "reformBonus": reform_bonus,
            "reformSubjects": reform_subjects,
            "score": score,
            # via "source": assunto da própria fonte; via "keywords": termos encontrados no texto
            "subjects": [{"id": sid, "via": "keywords" if sid in matched else "source", "terms": matched.get(sid, [])} for sid in subjects],
        },
    }
