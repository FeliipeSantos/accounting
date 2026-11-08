"""Key points of an act, extracted by rules (no AI) from its full official text.

Each line of the text is one provision (article, paragraph, item or clause). A provision
becomes a key point when it states a concrete value: an amount in R$, a percentage, a
deadline, a quantity ("até 2 empregados") or a date. The provision whose text says when the
act takes effect is returned apart. Everything shown is the act's own wording, shortened;
nothing is inferred.

Acts without any such value fall back to their main provisions (the caput of each article
or clause); texts without articles at all (e.g. Soluções de Consulta) fall back to their
"Rótulo: valor" lines (Assunto, Mercadoria, Código NCM...). `basis` says which one was used.
"""

import re

MAX_POINTS = 10
MAX_POINT_LENGTH = 360

_MONTH = r"(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)"

# valores que fazem de um dispositivo um ponto principal, do mais forte ao mais fraco
_HIGHLIGHTS: list[tuple[str, re.Pattern]] = [
    ("money", re.compile(r"R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?(?:\s(?:mil|milh[õo]es|bilh[õo]es))?")),
    ("percent", re.compile(r"\d+(?:,\d+)?\s?%|\d+(?:,\d+)?\s+por\s+cento")),
    (
        "deadline",
        re.compile(
            r"\b(?:\d+|dois|duas|três|quatro|cinco|seis|sete|oito|nove|dez|quinze|vinte|trinta|quarenta e cinco|sessenta|noventa|"
            r"cento e vinte|cento e oitenta|trezentos e sessenta e cinco)\s+(?:dias|meses|anos|horas)(?:\s+(?:úteis|corridos))?\b",
            re.IGNORECASE,
        ),
    ),
    ("quantity", re.compile(r"\baté\s+\d+\s+(?!de\s)[a-zà-úç]+")),
    (
        "date",
        re.compile(
            # data completa, exceto a de publicação ("Diário Oficial da União de 29 de ...")
            rf"(?:\b(?:a\s+partir\s+de|até|desde|em|após)\s+)?(?<!União de )(?<!DOU de )\b(?:1º|\d{{1,2}})\s+de\s+{_MONTH}\s+de\s+\d{{4}}"
            r"|\bano-calend[áa]rio\s+de\s+\d{4}|\bexerc[íi]cios?\s+de\s+\d{4}(?:\s+a\s+\d{4})?",
            re.IGNORECASE,
        ),
    ),
]
_STRENGTH = {kind: index for index, (kind, _) in enumerate(_HIGHLIGHTS)}

# número escrito por extenso depois do algarismo: "R$ 140.000,00 (cento e quarenta mil reais)"
_WRITTEN_NUMBER = re.compile(r"(\d[\d.,]*\s*%?)\s*\((?:[a-zà-úç]+[ ,\-]*)+\)")
_FILLER_DOTS = re.compile(r"\s*\.{4,}\s*")
_SPACES = re.compile(r"\s+")

_ARTICLE = re.compile(r"^[\"“]?\s*(Art\.\s*\d+(?:[º°o]|\.)?(?:-[A-Z])?)\.?\s*", re.IGNORECASE)
_CLAUSE = re.compile(r"^[\"“]?\s*(Cl[áa]usula\s+[a-zà-ú]+(?:-[A-Z])?)\.?\s*", re.IGNORECASE)
_PARAGRAPH = re.compile(r"^[\"“]?\s*(§\s*\d+[º°o]?(?:-[A-Z])?|Par[áa]grafo\s+[úu]nico)\.?\s*", re.IGNORECASE)
_ITEM = re.compile(r"^[\"“]?\s*([IVXLC]+)\s*[-–—]\s*")
_LETTER = re.compile(r"^[\"“]?\s*([a-z])\)\s*")
# fim da nova redação citada: "(NR)" (atos federais) ou a aspa de fechamento (CONFAZ)
_QUOTE_END = re.compile(r"(?:\((?:NR|AC)\)|[\"”]\s*[.;,]?)\s*$")
_IN_FORCE = re.compile(r"entra(?:m)?\s+em\s+vigor", re.IGNORECASE)
_TAKES_EFFECT = re.compile(r"produz(?:irá|indo|ir|em|irão)?\s+efeitos", re.IGNORECASE)
_REVOKES = re.compile(r"^(?:Ficam?\s+revogad|Revoga-se|Revogam-se)", re.IGNORECASE)
_SIGNATURE = re.compile(r"^Bras[íi]lia,\s", re.IGNORECASE)
_AMENDS = re.compile(r"passa(?:m)?\s+a\s+vigorar|fica(?:m)?\s+acrescid", re.IGNORECASE)

# data de citação de qualquer ato: "nº 13, de 23 de março de 2026" -> "nº 13/2026"
_CITATION_DATE = re.compile(rf"(n[º°o]\.?\s*\d[\d./-]*),?\s+de\s+\d{{1,2}}º?\s+de\s+{_MONTH}\s+de\s+(\d{{4}})", re.IGNORECASE)
# linha "Rótulo: valor" de textos sem artigos (Assunto:, Mercadoria:, Código NCM:)
_FIELD = re.compile(r"^([A-ZÀ-Ú][A-Za-zÀ-ú ]{2,40}):\s*(\S.*)$|^(Código NCM)\s+(\d\S*.*)$")
# rótulos longos e pouco informativos para o resumo
_SKIPPED_FIELDS = {"dispositivos legais"}
MAX_PROVISIONS = 6

# "<tipo> nº <número>, de 14 de dezembro de 2006" -> "LC 123/2006"
_REFERENCE = re.compile(
    r"\b(Lei Complementar|Decreto-Lei|Decreto|Lei|Medida Provis[óo]ria|Emenda Constitucional|Instru[çc][ãa]o Normativa|Conv[êe]nio ICMS)"
    rf"\s+n[º°o]?\.?\s*(\d+(?:\.\d+)*)(?:,?\s+de\s+(?:\d{{1,2}}º?\s+de\s+{_MONTH}\s+de\s+)?(\d{{4}}))?",
    re.IGNORECASE,
)
_SHORT_KIND = {
    "lei complementar": "LC",
    "medida provisória": "MP",
    "medida provisoria": "MP",
    "emenda constitucional": "EC",
    "decreto-lei": "DL",
    "instrução normativa": "IN",
    "instrucao normativa": "IN",
}


def _abbreviate(match: re.Match) -> str:
    kind, number, year = match.group(1), match.group(2), match.group(3)
    short = _SHORT_KIND.get(kind.lower(), kind)
    return f"{short} {number}/{year}" if year else f"{short} {number}"


def abbreviate_references(text: str) -> str:
    return _REFERENCE.sub(_abbreviate, text)


def _clean(line: str) -> str:
    text = _FILLER_DOTS.sub(" … ", line)
    text = _WRITTEN_NUMBER.sub(r"\1", text)
    text = abbreviate_references(text)
    text = _CITATION_DATE.sub(r"\1/\2", text)
    text = _SPACES.sub(" ", text).strip(' "“”')
    text = re.sub(r"\s+([,.;:])", r"\1", text)
    return re.sub(r"(?:\s*…\s*)+$", "", re.sub(r"^(?:…\s*)+", "", text)).strip()


def _highlights(text: str) -> list[tuple[str, str]]:
    found = []
    for kind, pattern in _HIGHLIGHTS:
        for match in pattern.finditer(text):
            value = match.group(0).strip()
            if all(value not in seen and seen not in value for _, seen in found):
                found.append((kind, value))
    return found


def _shorten(text: str, first_value: str | None) -> str:
    if len(text) <= MAX_POINT_LENGTH:
        return text
    at = text.find(first_value) if first_value else 0
    start = max(0, at - MAX_POINT_LENGTH // 2)
    if start:
        # começa numa palavra inteira
        start = text.find(" ", start) + 1
    end = min(len(text), start + MAX_POINT_LENGTH)
    if end < len(text):
        end = text.rfind(" ", start, end)
    return f"{'… ' if start else ''}{text[start:end].strip()}{' …' if end < len(text) else ''}"


def _lower_first(text: str) -> str:
    return text[:1].lower() + text[1:]


def _ref(article: str | None, quoted: str | None, paragraph: str | None, item: str | None, letter: str | None, target: str | None) -> str:
    """Where the provision is: "Art. 1º · nova redação do art. 18-A, § 1º da LC 123/2006" or "Art. 2º, parágrafo único"."""
    parts = [_lower_first(paragraph) if paragraph else None, f"inciso {item}" if item else None, f"alínea {letter}" if letter else None]
    inner = ", ".join(p for p in parts if p)
    if quoted:
        # concordância: "da cláusula", "do art."; "do Convênio ICMS", "do Decreto", "da LC", "da Lei"
        of_target = f" {'do' if re.match(r'(Conv|Decreto|DL\b|Ajuste)', target) else 'da'} {target}" if target else ""
        of_quoted = "da" if quoted.lower().startswith("cl") else "do"
        where = f"{_lower_first(quoted)}{f', {inner}' if inner else ''}{of_target}"
        return f"{article} · nova redação {of_quoted} {where}" if article else where
    if article:
        return f"{article}{f', {inner}' if inner else ''}"
    return inner or "Texto"


# rótulo do dispositivo no início da linha (já mostrado na referência)
_LEADING_LABEL = re.compile(
    r"^(?:Art\.\s*\d+(?:[º°o]|\.)?(?:-[A-Z])?\.?|Cl[áa]usula\s+[a-zà-ú]+(?:-[A-Z])?\.?|§\s*\d+[º°o]?(?:-[A-Z])?\.?|Par[áa]grafo\s+[úu]nico\.?|[IVXLC]+\s*[-–—]|[a-z]\))\s*",
    re.IGNORECASE,
)


def _without_label(text: str) -> str:
    rest = _LEADING_LABEL.sub("", text, count=1)
    return rest[:1].upper() + rest[1:] if rest else text


def extract_key_points(full_text: str | None) -> dict:
    """Key points and the effective-date provision of an act, from its full text.

    Returns {"points": [{"ref", "text", "highlights"}], "effective": {"ref", "text", "items"} | None,
    "basis": "values" | "provisions" | "fields" | None}.
    """
    points: list[dict] = []
    provisions: list[dict] = []  # caput de cada artigo: usado quando não há valores
    fields: list[dict] = []  # "Rótulo: valor": usado quando não há artigos
    in_force = None  # "entra em vigor": a vigência do ato
    takes_effect = None  # "produz efeitos": usado só quando não há "entra em vigor"
    effective_open = False  # incisos seguintes ainda pertencem ao artigo da vigência
    article = quoted = paragraph = item = letter = target = None
    inside_quote = False
    quoted_provisions = 0

    for index, raw in enumerate((full_text or "").splitlines()):
        line = raw.strip()
        if not line or not line.strip(". …"):
            continue
        if _SIGNATURE.match(line):
            break

        starts_quote = line[0] in '"“'
        new_article = False
        if match := (_ARTICLE.match(line) or _CLAUSE.match(line)):
            label = _SPACES.sub(" ", match.group(1)).rstrip(".")
            label = re.sub(r"(\d)o$", r"\1º", label)
            label = label[:1].upper() + label[1:]
            if starts_quote or inside_quote:
                quoted, paragraph, item, letter = label, None, None, None
                inside_quote = True
            else:
                article, quoted, paragraph, item, letter = label, None, None, None, None
                refs = _REFERENCE.search(line)
                target = _abbreviate(refs) if refs and _AMENDS.search(line) else None
                new_article, quoted_provisions = True, 0
        elif match := _PARAGRAPH.match(line):
            paragraph, item, letter = _SPACES.sub(" ", match.group(1)).rstrip("."), None, None
            paragraph = paragraph[:1].upper() + paragraph[1:]
            inside_quote = inside_quote or starts_quote
        elif match := _ITEM.match(line):
            item, letter = match.group(1), None
            inside_quote = inside_quote or starts_quote
        elif match := _LETTER.match(line):
            letter = match.group(1)
            inside_quote = inside_quote or starts_quote

        if article is None:
            # cabeçalho, ementa e preâmbulo; em textos sem artigos, as linhas "Rótulo: valor"
            if index and (field := _FIELD.match(line)):
                label = (field.group(1) or field.group(3)).strip()
                entry = {"ref": label, "text": _shorten(_clean(field.group(2) or field.group(4)), None), "highlights": []}
                if label.lower() not in _SKIPPED_FIELDS and entry not in fields:
                    fields.append(entry)
            continue

        ends_quote = bool(_QUOTE_END.search(line)) and (inside_quote or starts_quote)
        text = _QUOTE_END.sub("", _clean(line)).strip(' "“”') if ends_quote else _clean(line)
        body = _without_label(text)
        ref = _ref(article, quoted if inside_quote else None, paragraph, item, letter, target)

        if new_article:
            effective_open = False
        if not inside_quote and in_force is None and _IN_FORCE.search(line):
            in_force = {"ref": ref, "text": _shorten(body, None), "items": []}
            effective_open = True
        elif effective_open and not new_article and in_force is not None:
            in_force["items"].append(_shorten(body, None))
        else:
            if new_article and not (_AMENDS.search(line) and line.rstrip().endswith(":")):
                provisions.append({"ref": ref, "text": _shorten(body, None), "highlights": []})
            elif inside_quote and quoted_provisions < 2 and len(body) > 20:
                # nova redação citada: o conteúdo que muda
                provisions.append({"ref": ref, "text": _shorten(body, None), "highlights": []})
                quoted_provisions += 1
            if not inside_quote and _REVOKES.match(body):
                points.append({"ref": ref, "text": _shorten(body, None), "highlights": [], "strength": len(_HIGHLIGHTS)})
            elif found := _highlights(body):
                values = [value for _, value in found]
                strength = min(_STRENGTH[kind] for kind, _ in found)
                points.append({"ref": ref, "text": _shorten(body, values[0]), "highlights": values, "strength": strength})
                if not inside_quote and takes_effect is None and _TAKES_EFFECT.search(line):
                    takes_effect = {"ref": ref, "text": _shorten(body, None), "items": []}

        if ends_quote:
            inside_quote, quoted, paragraph, item, letter = False, None, None, None, None

    if len(points) > MAX_POINTS:
        # mantém os mais fortes (valores em R$ e percentuais primeiro), na ordem do texto
        keep = sorted(range(len(points)), key=lambda i: (points[i]["strength"], i))[:MAX_POINTS]
        points = [points[i] for i in sorted(keep)]
    for point in points:
        point.pop("strength")

    if any(point["highlights"] for point in points):
        basis = "values"
    elif provisions:
        points, basis = provisions[:MAX_PROVISIONS], "provisions"
    elif fields:
        points, basis = fields[:MAX_POINTS], "fields"
    else:
        basis = "values" if points else None
    return {"points": points, "effective": in_force or takes_effect, "basis": basis}
