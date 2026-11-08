"""Calendar events extracted by rules (no AI) from the official text of each document.

The calendar shows only what changes a company's obligations, with dates written in an
official act (any subject: Reforma, ICMS/ST, Simples Nacional, MEI, trabalhista...):

    obrigatoriedade  "obrigatório", "obrigatoriedade"; also the start of a Nota Técnica
                     in production, when the new layout becomes mandatory
    prazo            "até", "prazo", "data-limite"; also deadlines to opt for a regime
    vigencia         "entra em vigor", "produz efeitos", "a partir de" in a new act
    alteracao        the same, in an act that changes another one ("Altera o Protocolo
                     ICMS 41/08...", exclusion of products from the ST)

The text around a date is first classified in finer kinds (KINDS: production, test
environment, option, publication), then mapped to the calendar kinds; publication and
test-environment dates are not calendar events. Every event keeps the literal excerpt it
came from, so it can be checked against the source.

Rules against inventing information:
    - news, communications and bills give no dates: they are read only to find the
      official act they cite (collectors/cited.py), whose own dates enter the calendar;
    - dates of citations ("Lei nº 1, de 2 de março de 2020"), of publication in the DOU,
      of issue of documents ("data de emissão anterior a") and of signature are ignored;
    - a date without year ("16 de novembro") takes the year of the document and says so.
"""

import hashlib
import re

from app.modules.intelligence.text import clean_text, normalize_for_match

FIRST_DATE = "2025-01-01"
LAST_DATE = "2035-12-31"
# cronogramas oficiais têm dezenas de itens (o Ato Conjunto RFB/CGIBS nº 4 tem 30)
MAX_EVENTS_PER_DOCUMENT = 120
QUOTE_BEFORE = 220
QUOTE_AFTER = 160

_MONTHS = {
    "janeiro": 1,
    "fevereiro": 2,
    "marco": 3,
    "março": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}
_MONTH = "(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)"
_NUMERIC = re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b")
_WRITTEN = re.compile(rf"\b(\d{{1,2}})º?\s+de\s+{_MONTH}(?:\s+de\s+(\d{{4}}))?", re.IGNORECASE)

# tipos do calendário (o que a tela mostra e filtra)
CALENDAR_KINDS = {
    "obrigatoriedade": "Início da obrigatoriedade",
    "prazo": "Prazo",
    "vigencia": "Início de vigência",
    "alteracao": "Vigência de alteração",
}
# tipo fino do texto -> tipo do calendário (None: não entra)
_TO_CALENDAR = {
    "obrigatoriedade": "obrigatoriedade",
    "producao": "obrigatoriedade",
    "prazo": "prazo",
    "opcao": "prazo",
    "vigencia": "vigencia",
    "publicacao": None,
    "homologacao": None,
}
# o ato altera outro: "Altera o Protocolo ICMS 41/08", "exclui do Anexo...", "revoga..."
_ALTERS = re.compile(
    r"\b(?:altera|alteram|exclui|excluem|inclui|incluem|acrescenta|revoga|prorroga|modifica|da nova redacao|introduz alteracoes)\b|"
    r"passa(?:m)? a vigorar com as? seguintes? alterac"
)

# ato individual: de delegacia, superintendência regional, alfândega ou inspetoria da Receita
# (habilitação, benefício ou exclusão de uma empresa), não uma regra geral
_INDIVIDUAL_ACT = re.compile(
    r"\b(?:(?:delegacia|delegado|superintendencia regional|superintendente regional|alfandega|inspetoria|derat)\b|srrf\d)"
)

# tipos finos, do texto em volta da data
KINDS = {
    "publicacao": "Publicação",
    "vigencia": "Início de vigência",
    "producao": "Início em produção",
    "homologacao": "Início em homologação (testes)",
    "prazo": "Prazo",
    "opcao": "Prazo de opção",
    "obrigatoriedade": "Início da obrigatoriedade",
}

# palavras que dizem o que acontece na data (texto sem acentos, minúsculo); a mais próxima vence
_KEYWORDS: list[tuple[str, re.Pattern]] = [
    ("producao", re.compile(r"producao")),
    ("homologacao", re.compile(r"homologacao|ambiente de teste")),
    ("obrigatoriedade", re.compile(r"obrigatori(?:edade|a|o)")),
    ("opcao", re.compile(r"\bopcao\b|\boptar\b|\bopte\b")),
    ("vigencia", re.compile(r"entra(?:m|ra)? em vigor|vigencia|produz(?:ir|indo|em|ira)? efeitos|passa(?:m|ra)? a vigorar|a partir de")),
    ("prazo", re.compile(r"\bprazo\b|data-limite|data limite|\bate\b|termina")),
]
# depois da data: "25/09/2023 em homologação e 30/10/2023 em produção"
_AFTER = re.compile(r"^\W{0,3}(?:em|no ambiente de|(?:como )?a data de)\s+(producao|homologacao)")
# data antiga numa alteração: "mudou de 05/10/2026 para 03/11/2026" (vale só a nova)
_REPLACED = re.compile(r"^\W{0,3}para\s+(?:\d|o dia)")
# antes da data: datas que não são do calendário
_IGNORED_BEFORE = re.compile(
    r"(?:n[ºo°]?\.?\s*[\d./-]+,?\s+de\s*$|uniao\s+de\s*$|\bdou\s+de\s*$|publicad[ao]s?\s+(?:no|em)\s+\S*\s*$|"
    r"data de emissao[^.]{0,40}$|assinad[ao]\s+em\s*$|brasilia,?\s*$)"
)
# "deverá ser feita até..." num ato oficial é uma ordem, não uma previsão
_PREVISION = re.compile(r"previst[ao]s?|estimad[ao]|pretende")

# tipos de documento: situação legal e se as datas são oficiais
_LEGAL_STATUS = {
    "norma": "Norma publicada",
    "resolucao": "Norma publicada",
    "protocolo": "Norma publicada",
    "nota-tecnica": "Documento técnico publicado",
    "aviso": "Comunicado oficial",
    "pagina": "Página oficial",
    "proposta": "Proposta legislativa",
    "comunicado": "Comunicado informativo",
    "noticia": "Comunicado informativo",
}
_INFORMATIVE = {"noticia", "comunicado", "proposta"}
_NORMS = {"norma", "resolucao", "protocolo"}
# nas Notas Técnicas, só produção e homologação: "Até 01/09/2026" das tabelas é ambíguo
_NT_KINDS = {"producao", "homologacao", "obrigatoriedade"}


def _iso(year: int, month: int, day: int) -> str | None:
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


def find_dates(text: str, document_date: str | None) -> list[tuple[int, int, str, str | None]]:
    """(start, end, iso date, note) of every date in the text; a date without year takes the
    year of the document (the next year when the month already passed long ago)."""
    found = []
    for match in _NUMERIC.finditer(text):
        iso = _iso(int(match.group(3)), int(match.group(2)), int(match.group(1)))
        if iso:
            found.append((match.start(), match.end(), iso, None))
    for match in _WRITTEN.finditer(text):
        month = _MONTHS[normalize_for_match(match.group(2)).strip()]
        if match.group(3):
            iso, note = _iso(int(match.group(3)), month, int(match.group(1))), None
        elif document_date:
            year, doc_month = int(document_date[:4]), int(document_date[5:7])
            # aviso de outubro sobre "15 de janeiro" fala do ano seguinte
            year = year + 1 if month < doc_month - 2 else year
            iso, note = _iso(year, month, int(match.group(1))), "Ano deduzido da data do documento"
        else:
            continue
        if iso:
            found.append((match.start(), match.end(), iso, note))
    return sorted(found)


def _classify(before: str, after: str) -> str | None:
    """Kind of the date from the words right after it, or the nearest keyword before it."""
    tail = _AFTER.search(normalize_for_match(after))
    if tail:
        return tail.group(1)
    window = normalize_for_match(before)
    best, best_position = None, -1
    for kind, pattern in _KEYWORDS:
        for match in pattern.finditer(window):
            if match.end() > best_position:
                best, best_position = kind, match.end()
    return best


# fim de frase ou de item: a palavra que classifica a data precisa estar na mesma frase
_SENTENCE_BREAK = re.compile(r"\.\s|\n|;|Observação\s*\d*\s*:|\(NR\)", re.IGNORECASE)
_FILLER = re.compile(r"\s*[.…]{4,}\s*")
_IN_FORCE_ON_PUBLICATION = re.compile(r"entra(?:m)?\s+em\s+vigor\s+na\s+data\s+de\s+sua\s+publica", re.IGNORECASE)


# inciso ou alínea: "I - 1º de janeiro de 2028" depende da frase que o introduz ("produz efeitos a partir de:")
_LIST_ITEM = re.compile(r"^\s*(?:[IVXLC]+\s*[-–—]|[a-z]\))")
_INTRO_LIMIT = 400


def _sentence_before(text: str, start: int, limit: int) -> str:
    """Text of the same sentence right before the date (at most `limit` characters); for a
    list item, also the sentence that introduces the list."""
    window = text[max(0, start - limit) : start]
    breaks = list(_SENTENCE_BREAK.finditer(window))
    segment = window[breaks[-1].end() :] if breaks else window
    if _LIST_ITEM.match(segment):
        intro = text[max(0, start - _INTRO_LIMIT) : start - len(segment)]
        if intro.rstrip().endswith(":"):
            sentence_start = intro.rfind(". ")
            return intro[sentence_start + 2 if sentence_start >= 0 else 0 :] + segment
    return segment


def _quote(text: str, start: int, end: int) -> str:
    """Literal excerpt around the date, cut at sentence limits when possible."""
    left = max(0, start - QUOTE_BEFORE)
    boundary = max(text.rfind(". ", left, start), text.rfind("\n", left, start))
    left = boundary + 1 if boundary >= 0 else left
    right = min(len(text), end + QUOTE_AFTER)
    stop = text.find(". ", end, right)
    right = stop + 1 if stop >= 0 else right
    excerpt = clean_text(_FILLER.sub(" … ", text[left:right].replace("\n", " ")), QUOTE_BEFORE + QUOTE_AFTER + 40)
    return f"{'… ' if left > 0 and boundary < 0 else ''}{excerpt}{'' if stop >= 0 or right >= len(text) else ' …'}"


def importance_of(kind: str, document: dict) -> str:
    if document["kind"] in _INFORMATIVE:
        return "informativo"
    title = normalize_for_match(document["title"])
    major = "lei complementar" in title or "emenda constitucional" in title or "medida provisoria" in title
    if kind in ("vigencia", "alteracao", "obrigatoriedade") and major:
        return "critico"
    if kind in ("obrigatoriedade", "prazo", "vigencia", "alteracao"):
        return "alto"
    return "medio"


_MAJOR_ACTS = "lei complementar, emenda constitucional ou medida provisória"


def importance_reason(importance: str, kind: str, date_status: str, document: dict) -> str:
    """Why an event got its importance, in the words of the rules of importance_of."""
    label = CALENDAR_KINDS.get(kind, KINDS.get(kind, kind))
    if importance == "informativo":
        return "Vem de notícia, comunicado ou proposta: serve de aviso e não cria obrigação."
    if date_status == "citada" and importance == "alto":
        return f"{label} de ato oficial reproduzido em comunicado: importante mesmo vindo de notícia, mas confira no ato."
    if importance == "critico":
        return f"{label} em {_MAJOR_ACTS}: muda a regra para todos."
    if importance == "alto" and kind == "publicacao":
        return f"Publicação de {_MAJOR_ACTS}."
    if importance == "alto":
        return f"{label} em documento oficial: pede ação ou preparação até a data."
    return f"{label} em documento oficial: data de referência para acompanhar, sem ação imediata."


def date_reason(date_status: str, document: dict, legal_status: str) -> str:
    """Why the date is official, cited or a forecast."""
    if date_status == "confirmada":
        return f"A data está escrita no próprio documento oficial ({legal_status.lower()})."
    if date_status == "citada":
        return "A data está num comunicado que reproduz um ato oficial; o ato ainda não foi encontrado no DOU para confirmar."
    if document.get("kind") in _INFORMATIVE:
        return "A data vem de notícia ou comunicado, sem ato oficial que a fixe: é uma previsão, não obrigação legal."
    return "O próprio texto oficial apresenta a data como prevista ou estimada."


def event_key(document_id: str, kind: str, date: str | None, subject: str | None = None) -> str:
    # o assunto (linha de tabela) distingue eventos do mesmo tipo e data no mesmo documento
    base = f"{document_id}|{kind}|{date}" + (f"|{subject}" if subject else "")
    return hashlib.sha256(base.encode()).hexdigest()[:24]


# obrigação definida pela data de emissão: "passa a ser obrigatório para as NF-e com data de emissão maior ou igual a 05/01/2026"
_EMISSION_OBLIGATION = re.compile(r"obrigatori[^.]{0,200}(?:maior ou igual a|a partir de)\s*$")

# colunas de tabela que dão o tipo da data da linha ("Início da obrigatoriedade", "Produção"...)
_COLUMN_KINDS: list[tuple[str, re.Pattern]] = [
    ("obrigatoriedade", re.compile(r"obrigatori")),
    ("producao", re.compile(r"producao")),
    ("homologacao", re.compile(r"homologacao|\bteste")),
    ("vigencia", re.compile(r"vigencia|vigor")),
    ("opcao", re.compile(r"\bopcao\b")),
    ("prazo", re.compile(r"\bprazo\b|data-limite|data limite")),
]
TABLE_SEPARATOR = " | "


def _table_rows(body: str) -> list[tuple[list[str], list[str]]]:
    """(header, cells) of every row of the tables kept as "cell | cell" lines."""
    rows, header = [], None
    for line in body.split("\n"):
        if TABLE_SEPARATOR not in line:
            header = None
            continue
        cells = [cell.strip() for cell in line.split("|")]
        if header is None:
            header = cells
            continue
        rows.append((header, cells))
    return rows


_ITEM_LINE = re.compile(r"^\s*(?:([IVXLC]+)\s*[-–—]|([a-z])\))\s*(.+?):\s*$")
_INCISO_LINE = re.compile(r"^\s*[IVXLC]+\s*[-–—]\s*(.+?):?\s*$")
_ANY_ITEM = re.compile(r"^\s*(?:[IVXLC]+\s*[-–—]|[a-z]\))")
MAX_LIST_LOOKBACK = 60


def _list_item(body: str, line_start: int, start: int) -> tuple[str, str, str] | None:
    """(subject, introduction, quote) when the date closes an item of an enumerated list
    ("a) nas locações de bens móveis...: 1º de dezembro de 2026;"), else None."""
    item = _ITEM_LINE.match(body[line_start:start])
    if not item:
        return None
    subject = clean_text(item.group(3), 180)
    line_end = body.find("\n", start)
    quote = clean_text(body[line_start : line_end if line_end >= 0 else len(body)], 400)
    lines = body[:line_start].split("\n")[-MAX_LIST_LOOKBACK:]
    intro = ""
    parent = None
    for line in reversed(lines):
        stripped = line.strip()
        if not stripped:
            continue
        if item.group(2) and parent is None and (inciso := _INCISO_LINE.match(stripped)):
            # alínea: o inciso a que pertence dá o nome do documento ("Nota Fiscal de Serviços Eletrônica - NFS-e")
            parent = clean_text(inciso.group(1), 120)
            quote = f"{clean_text(stripped, 160)} … {quote}"
            continue
        if _ANY_ITEM.match(stripped):
            continue  # outros incisos e alíneas da mesma lista: a introdução está antes deles
        if stripped.endswith(":"):
            intro = stripped
        break
    if not intro:
        return None
    return (f"{parent} — {subject}" if parent else subject), intro, quote


# "produzirá efeitos a partir de 1º de novembro de 2026, em relação ao art. 1º": a data é a do
# artigo referido; quando ele torna algo obrigatório, é o início de uma obrigatoriedade
_EFFECTS_OF_ARTICLE = re.compile(r"^[^\n]{0,40}?em relacao aos? arts?\.?\s*(\d+)")
_OBLIGATION_WORD = re.compile(r"obrigatori", re.IGNORECASE)


def _article_obligation(body: str, number: str) -> str | None:
    """The sentence of "Art. <number>" of the act that makes something obligatory, if any.
    Articles amended inside quotes ("Art. 59 ...) are part of the article that amends them."""
    start = re.search(rf"(?m)^Art\.?\s*{number}\s*[º°o]?\b", body)
    if not start:
        return None
    following = re.search(r"(?m)^Art\.?\s*\d+", body[start.end() :])
    article = body[start.start() : start.end() + following.start()] if following else body[start.start() :]
    found = _OBLIGATION_WORD.search(article)
    if not found:
        return None
    left = article.rfind("\n", 0, found.start()) + 1
    right = article.find("\n", found.end())
    return clean_text(_FILLER.sub(" … ", article[left : right if right >= 0 else len(article)]), 360)


def extract_events(document: dict, text: str | None, published_at: str | None) -> list[dict]:
    """Events of one document version. `document`: id, kind, title, (version) label."""
    kind_of_doc = document["kind"]
    legal_status = _LEGAL_STATUS.get(kind_of_doc, "Comunicado informativo")
    label = document["title"]
    events: dict[str, dict] = {}
    body = text or ""
    # notícias, comunicados e projetos não dão datas: servem só para achar o ato oficial citado;
    # atos de unidades regionais da Receita tratam de um contribuinte, não de uma regra geral
    head = normalize_for_match(f"{document['title']} {document.get('summary') or ''} {body[:600]}")
    if kind_of_doc in _INFORMATIVE or _INDIVIDUAL_ACT.search(head):
        return []
    # a vigência de um ato que altera outro é uma alteração
    alters = bool(_ALTERS.search(normalize_for_match(f"{document['title']} {document.get('summary') or ''} {body[:800]}")))

    def add(fine_kind: str, date: str, quote: str, note: str | None, prevision: bool, subject: str | None = None) -> None:
        kind = _TO_CALENDAR.get(fine_kind, fine_kind)
        if kind is None or not (FIRST_DATE <= date <= LAST_DATE) or len(events) >= MAX_EVENTS_PER_DOCUMENT:
            return
        if kind == "vigencia" and alters:
            kind = "alteracao"
        key = event_key(document["id"], kind, date, subject)
        if key in events:
            return
        status = "previsao" if prevision else "confirmada"
        # o título diz o tipo fino quando ele explica mais ("Início em produção", "Prazo de opção")
        heading = KINDS[fine_kind] if fine_kind in ("producao", "opcao") else CALENDAR_KINDS[kind]
        events[key] = {
            "eventKey": key,
            "kind": kind,
            "date": date,
            "title": f"{heading}: {subject or label}",
            "quote": quote,
            "dateStatus": status,
            "dateNote": note,
            "legalStatus": legal_status,
            "importance": importance_of(kind, document),
        }

    # cronogramas em tabela: cada linha com data numa coluna de tipo conhecido é um evento
    for header, cells in _table_rows(body):
        for column, cell in enumerate(cells[: len(header)]):
            column_name = normalize_for_match(header[column])
            kind = next((k for k, pattern in _COLUMN_KINDS if pattern.search(column_name)), None)
            if kind is None or "publicacao" in column_name:
                continue
            for _start, _end, date, note in find_dates(cell, published_at):
                quote = "; ".join(f"{name}: {value}" for name, value in zip(header, cells, strict=False) if value)
                add(kind, date, quote, note, False, subject=clean_text(cells[0], 200))

    # a publicação dos atos oficiais e das notas técnicas é um evento por si
    if published_at and kind_of_doc in _NORMS | {"nota-tecnica"}:
        published = f"{published_at[8:10]}/{published_at[5:7]}/{published_at[:4]}"
        add("publicacao", published_at, f"Data de publicação informada pela fonte oficial: {published}", None, False)

    in_force = _IN_FORCE_ON_PUBLICATION.search(body)
    if published_at and kind_of_doc in _NORMS and in_force:
        add("vigencia", published_at, _quote(body, in_force.start(), in_force.end()), None, False)

    for start, end, date, note in find_dates(body, published_at):
        line_start = body.rfind("\n", 0, start) + 1
        line_end = body.find("\n", end)
        if TABLE_SEPARATOR in body[line_start : line_end if line_end >= 0 else len(body)]:
            continue  # linhas de tabela já tratadas acima
        if _REPLACED.search(normalize_for_match(body[end : end + 20])):
            continue
        effects_of = (
            _EFFECTS_OF_ARTICLE.search(normalize_for_match(body[end : line_end if line_end >= 0 else len(body)]))
            if kind_of_doc in _NORMS
            else None
        )
        obligation = _article_obligation(body, effects_of.group(1)) if effects_of else None
        if obligation:
            # o efeito do artigo que cria a obrigação: a data passa a ser a do início da obrigatoriedade
            line = clean_text(body[line_start : line_end if line_end >= 0 else len(body)], 200)
            add("obrigatoriedade", date, f"{line} … Art. {effects_of.group(1)}: {obligation}", note, False)
            continue
        listed = _list_item(body, line_start, start)
        if listed:
            # cronograma em incisos: "I - Nota Fiscal Eletrônica - NF-e, modelo 55: 3 de agosto de 2026;"
            subject, intro, quote = listed
            kind = next((k for k, pattern in _COLUMN_KINDS if pattern.search(normalize_for_match(intro))), None)
            if kind:
                add(kind, date, quote, note, False, subject=subject)
                continue
        # nas Notas Técnicas, só a frase curta junto da data (as tabelas de cronograma são ambíguas)
        before = _sentence_before(body, start, 100 if kind_of_doc == "nota-tecnica" else 160)
        if _EMISSION_OBLIGATION.search(normalize_for_match(before)):
            # "obrigatório para as NF-e com data de emissão maior ou igual a 05/01/2026"
            kind = "obrigatoriedade"
        elif _IGNORED_BEFORE.search(normalize_for_match(body[max(0, start - 60) : start])):
            continue
        else:
            kind = _classify(before, body[end : end + 40])
        if kind is None or (kind_of_doc == "nota-tecnica" and kind not in _NT_KINDS):
            continue
        prevision = bool(_PREVISION.search(normalize_for_match(before[-80:])))
        add(kind, date, _quote(body, start, end), note, prevision)
    return list(events.values())
