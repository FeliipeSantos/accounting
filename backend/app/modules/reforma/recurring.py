"""Recurring deadlines: obligations whose date repeats every month or every year by a fixed
rule of the legislation, without a new act repeating it (e.g. the option for the SIMEI in
January, the ECD in June). Nothing is stored: the dates are calculated for the period shown.

Every rule keeps, like the other calendar dates, the literal text of an official source and
its address (checked on 2026-11-08). A rule enters here only when that source was found.

Business days: weekends and the national holidays (fixed ones and Good Friday). Carnaval,
Corpus Christi and state or municipal holidays are not considered; when the rule depends on
them, the note of the date says so.
"""

import re
from datetime import date, timedelta

from app.modules.reforma.events import CALENDAR_KINDS

SOURCE_ID = "recorrentes"
SOURCE_NAME = "Prazos recorrentes da legislação"
STATUS = "recorrente"
LEGAL_STATUS = "Regra recorrente da legislação"
# o "a seguir" conta as ocorrências dos próximos 12 meses
UPCOMING_DAYS = 365
# dia em que as regras foram conferidas nas fontes oficiais; ao atualizar uma regra, atualize
# o "checkedOn" dela: os atos publicados até esse dia deixam de gerar o alerta
CHECKED_ON = "2026-11-08"

# watch: palavras que identificam a obrigação num ato novo (texto sem acentos, minúsculo)
# rule: ("last_business_day",) | ("last_day",) | ("day", n) | ("day", n, "before"|"after") for a non-business day
RULES: list[dict] = [
    {
        "id": "simei-opcao",
        "watch": r"\bsimei\b",
        "title": "Opção pelo SIMEI (MEI já inscrito no CNPJ)",
        "kind": "prazo",
        "subjects": ["simples-nacional"],
        "frequency": "annual",
        "month": 1,
        "rule": ("last_business_day",),
        "quote": (
            "Se você já era um empresário individual, inscrito no CNPJ, você pode optar pelo Simei no mês de janeiro, "
            "até o último dia útil."
        ),
        "url": "https://www.gov.br/pt-br/servicos/optar-pelo-sistema-de-recolhimento-do-mei",
        "sourceName": "gov.br — Optar pelo sistema de recolhimento do MEI (SIMEI)",
        "basis": "Resolução CGSN nº 140, de 2018",
    },
    {
        "id": "dasn-simei",
        "watch": r"\bdasn-?simei\b|declaracao anual simplificada do microempreendedor",
        "title": "DASN-SIMEI (declaração anual do MEI)",
        "kind": "prazo",
        "subjects": ["simples-nacional", "obrigacoes-acessorias"],
        "frequency": "annual",
        "month": 5,
        "rule": ("day", 31),
        "quote": (
            "O prazo para a entrega da Declaração Anual Simplificada do Microempreendedor Individual (DASN-Simei), "
            "referente ao ano-calendário de 2025, encerra-se no dia 31 de maio de 2026."
        ),
        "url": "https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/maio/microempreendedor-individual-mei-tem-ate-31-de-maio-para-entregar-declaracao-anual",
        "sourceName": "Receita Federal — MEI tem até 31 de maio para entregar declaração anual",
        "basis": "Resolução CGSN nº 140, de 2018",
    },
    {
        "id": "defis",
        "watch": r"\bdefis\b|declaracao de informacoes socioeconomicas e fiscais",
        "title": "DEFIS (declaração anual do Simples Nacional)",
        "kind": "prazo",
        "subjects": ["simples-nacional", "obrigacoes-acessorias"],
        "frequency": "annual",
        "month": 3,
        "rule": ("last_day",),
        "quote": (
            "O prazo mensal para entregar a Declaração de Informações Socioeconômicas e Fiscais (DEFIS) é o último dia "
            "do mês de março de cada ano, relativa aos fatos ocorridos no ano-calendário anterior."
        ),
        "url": "https://www.gov.br/pt-br/servicos/declarar-apuracoes-e-informacoes-anuais-do-simples-nacional",
        "sourceName": "gov.br — Declarar apurações e informações anuais do Simples Nacional",
        "basis": "Resolução CGSN nº 140, de 2018",
    },
    {
        "id": "ecd",
        "watch": r"\becd\b|escrituracao contabil digital",
        "title": "ECD (Escrituração Contábil Digital)",
        "kind": "prazo",
        "subjects": ["sped", "obrigacoes-acessorias"],
        "frequency": "annual",
        "month": 6,
        "rule": ("last_business_day",),
        "quote": (
            "A ECD deve ser transmitida ao Sistema Público de Escrituração Digital (Sped) até o último dia útil do mês "
            "de junho do ano subsequente ao ano-calendário a que se refere a escrituração."
        ),
        "url": "https://www.gov.br/pt-br/servicos/entregar-escrituracao-contabil-digital",
        "sourceName": "gov.br — Entregar Escrituração Contábil Digital (ECD)",
        "basis": "Instrução Normativa RFB nº 2.003, de 2021",
    },
    {
        "id": "ecf",
        "watch": r"\becf\b|escrituracao contabil fiscal",
        "title": "ECF (Escrituração Contábil Fiscal)",
        "kind": "prazo",
        "subjects": ["sped", "irpj-csll", "obrigacoes-acessorias"],
        "frequency": "annual",
        "month": 7,
        "rule": ("last_business_day",),
        "quote": (
            "a ECF deve ser transmitida ao Sistema Público de Escrituração Digital (Sped) até o último dia útil do mês "
            "de julho do ano subsequente ao ano-calendário a que se refere a escrituração."
        ),
        "url": "https://www.gov.br/pt-br/servicos/entregar-escrituracao-contabil-fiscal",
        "sourceName": "gov.br — Entregar Escrituração Contábil Fiscal (ECF)",
        "basis": "Instrução Normativa RFB nº 2.004, de 2021",
    },
    {
        "id": "das",
        "watch": r"documento de arrecadacao do simples|\b(?:pagamento|vencimento|recolhimento) do das\b|\bdas(?:-| do )mei\b",
        "title": "DAS do Simples Nacional (apuração do mês anterior)",
        "kind": "prazo",
        "subjects": ["simples-nacional"],
        "frequency": "monthly",
        "rule": ("day", 20, "after"),
        "quote": (
            "Quando não houver expediente bancário no dia 20, o DAS deverá ser pago até o dia útil imediatamente "
            "posterior (para prazos normais, sem prorrogação)"
        ),
        "url": "https://www8.receita.fazenda.gov.br/SimplesNacional/ConteudoApoio/agenda/agenda.aspx",
        "sourceName": "Portal do Simples Nacional — Agenda",
        "basis": "Resolução CGSN nº 140, de 2018",
    },
    {
        "id": "dctfweb",
        "watch": r"\bdctf ?web\b",
        "title": "DCTFWeb (fatos geradores do mês anterior)",
        "kind": "prazo",
        "subjects": ["previdenciaria", "obrigacoes-acessorias"],
        "frequency": "monthly",
        "rule": ("day", 15, "after"),
        "quote": (
            "A partir da publicação da Instrução Normativa RFB nº 2.162, de 4 de outubro de 2023 , que alterou a IN RFB "
            "nº 2.005, de 2021, quando o dia 15 cair em dia não útil para fins fiscais, o prazo de entrega será "
            "postergado para o primeiro dia útil após o dia 15."
        ),
        "url": "https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2023/outubro/postergado-prazo-de-entrega-da-dctfweb",
        "sourceName": "Receita Federal — Postergado prazo de entrega da DCTFWeb",
        "basis": "Instrução Normativa RFB nº 2.005, de 2021, art. 10 (redação da IN RFB nº 2.162, de 2023)",
    },
    {
        "id": "efd-reinf",
        "watch": r"\befd-? ?reinf\b",
        "title": "EFD-Reinf (eventos do mês anterior)",
        "kind": "prazo",
        "subjects": ["sped", "obrigacoes-acessorias"],
        "frequency": "monthly",
        "rule": ("day", 15, "before"),
        "quote": (
            "O prazo de envio dos eventos da EFD-Reinf, salvo do evento R-3010, é o dia 15 do mês seguinte, antecipando-se "
            "o vencimento para o dia útil imediatamente anterior, em caso de não haver expediente bancário."
        ),
        "url": "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/sped/efd-reinf/efdr/1-geral/1-12-qual-e-o",
        "sourceName": "Receita Federal — Perguntas frequentes da EFD-Reinf (1.12)",
        "basis": "Instrução Normativa RFB nº 2.043, de 2021",
    },
]

_FIXED_HOLIDAYS = [(1, 1), (4, 21), (5, 1), (9, 7), (10, 12), (11, 2), (11, 15), (11, 20), (12, 25)]
_LIMITATION = "Dias úteis sem Carnaval, Corpus Christi e feriados estaduais ou municipais"


def easter(year: int) -> date:
    """Easter Sunday (Gregorian calendar, anonymous algorithm)."""
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    m = (32 + 2 * e + 2 * i - h - k) % 7
    n = (a + 11 * h + 22 * m) // 451
    month = (h + m - 7 * n + 114) // 31
    day = (h + m - 7 * n + 114) % 31 + 1
    return date(year, month, day)


def national_holidays(year: int) -> set[date]:
    return {date(year, m, d) for m, d in _FIXED_HOLIDAYS} | {easter(year) - timedelta(days=2)}


def is_business_day(day: date) -> bool:
    return day.weekday() < 5 and day not in national_holidays(day.year)


def _last_day(year: int, month: int) -> date:
    return (date(year + (month == 12), month % 12 + 1, 1)) - timedelta(days=1)


def due_date(rule: tuple, year: int, month: int) -> tuple[date, str | None]:
    """The date of one occurrence and, when the business-day rule moved it, why."""
    kind = rule[0]
    if kind == "last_day":
        return _last_day(year, month), None
    if kind == "last_business_day":
        day = _last_day(year, month)
        while not is_business_day(day):
            day -= timedelta(days=1)
        return day, _LIMITATION
    nominal = date(year, month, min(rule[1], _last_day(year, month).day))
    if len(rule) < 3 or is_business_day(nominal):
        return nominal, None
    step = timedelta(days=-1 if rule[2] == "before" else 1)
    day = nominal
    while not is_business_day(day):
        day += step
    direction = "antecipado para o dia útil anterior" if rule[2] == "before" else "adiado para o dia útil seguinte"
    return day, f"Dia {nominal.day:02d}/{nominal.month:02d} não é dia útil: {direction}. {_LIMITATION}"


def _months(start: date, end: date):
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        yield year, month
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)


def occurrences(date_from: str, date_to: str) -> list[dict]:
    """Calendar events of every rule between two dates (yyyy-mm-dd), in the shape of the API."""
    start, end = date.fromisoformat(date_from), date.fromisoformat(date_to)
    events = []
    for rule in RULES:
        for year, month in _months(start, end):
            if rule["frequency"] == "annual" and month != rule["month"]:
                continue
            day, note = due_date(rule["rule"], year, month)
            if not (start <= day <= end):
                continue
            iso = day.isoformat()
            events.append(
                {
                    "id": f"rec-{rule['id']}-{iso}",
                    "documentId": "",
                    "versionId": None,
                    "kind": rule["kind"],
                    "date": iso,
                    "title": f"{CALENDAR_KINDS[rule['kind']]}: {rule['title']}",
                    "quote": rule["quote"],
                    "dateStatus": STATUS,
                    "dateNote": note,
                    "legalStatus": LEGAL_STATUS,
                    "importance": "alto",
                    "importanceReason": "Prazo recorrente da legislação: pede ação até a data, todo ano ou todo mês.",
                    "dateReason": f"Data calculada pela regra da legislação ({rule['basis']}), conforme a fonte oficial citada.",
                    "subjects": rule["subjects"],
                    "origin": "recorrente",
                    "status": "ativo",
                    "createdAt": None,
                    "updatedAt": None,
                    "document": {
                        "title": rule["sourceName"],
                        "kind": "regra",
                        "sourceId": SOURCE_ID,
                        "url": rule["url"],
                        "versionLabel": None,
                        "summary": rule["basis"],
                    },
                    "alsoIn": [],
                }
            )
    return events


def matches(event: dict, filters: dict) -> bool:
    """The same filters as the stored events."""
    if filters.get("kind") and event["kind"] != filters["kind"]:
        return False
    if filters.get("importance") and event["importance"] not in filters["importance"]:
        return False
    return not (filters.get("subjects") and not set(filters["subjects"]) & set(event["subjects"]))


# um ato que muda o prazo: prorroga, adia, antecipa, altera, extingue ou dispensa
_CHANGE = re.compile(
    r"prorrog|\badia\b|\badiad|\badiament|antecip|novos? prazos?|\balter(?:a|am|ou|ad[oa]s?|acao|acoes)\b|"
    r"passa(?:m|ra|rao)? a (?:ser|vigorar|vencer)|\bextin|\bdispens|\bsubstitu|\brevog"
)
# o assunto do prazo perto da mudança: o mesmo trecho, não um ato que só cita a obrigação
_DEADLINE = re.compile(r"\bprazo|vencimento|\bentreg|transmi|apresenta|recolhiment|pagament|\bopcao\b|\bdeclar")
_WINDOW = 300
# prorrogações só para municípios atingidos por calamidade: não mudam a regra geral
_REGIONAL = re.compile(r"calamidade|atingid[oa]s? (?:por|pel)|desastre|enchente|fortes chuvas")


def checked_on(rule: dict) -> str:
    return rule.get("checkedOn", CHECKED_ON)


def touches(rule: dict, text: str) -> bool:
    """A text (normalized) that names the obligation and, near it, a change of its deadline."""
    if _REGIONAL.search(text):
        return False
    for found in re.finditer(rule["watch"], text):
        start, end = max(0, found.start() - _WINDOW), found.end() + _WINDOW
        near = text[start:end]
        # antecipar parcelas de um parcelamento não muda o vencimento
        if _CHANGE.search(near) and _DEADLINE.search(near) and "parcelament" not in near:
            return True
    return False


def reviews(documents: list[dict]) -> dict[str, list[dict]]:
    """The acts published after each rule was checked that may change it, by rule id.

    documents: {id, title, url, date (yyyy-mm-dd), text (normalized title + summary + start)}."""
    found: dict[str, list[dict]] = {}
    for rule in RULES:
        since = checked_on(rule)
        acts = [
            {"documentId": d["id"], "title": d["title"], "url": d["url"], "date": d["date"]}
            for d in documents
            if d["date"] and d["date"] > since and touches(rule, d["text"])
        ]
        if acts:
            found[rule["id"]] = sorted(acts, key=lambda a: a["date"], reverse=True)
    return found


def attach_reviews(events: list[dict], found: dict[str, list[dict]]) -> list[dict]:
    """Marks the occurrences of a rule that may have changed (review: since + acts)."""
    for event in events:
        rule_id = event["id"][len("rec-") : -len("-yyyy-mm-dd")]
        acts = found.get(rule_id)
        rule = next((r for r in RULES if r["id"] == rule_id), None)
        event["review"] = {"since": checked_on(rule), "acts": acts} if acts and rule else None
    return events


def review_list(found: dict[str, list[dict]]) -> list[dict]:
    """The rules to review, for the status (tab Fontes)."""
    return [{"ruleId": r["id"], "title": r["title"], "since": checked_on(r), "acts": found[r["id"]]} for r in RULES if r["id"] in found]
