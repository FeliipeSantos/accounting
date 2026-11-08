"""Portal da NF-e — Notas Técnicas (number, version, date, official PDF) and Avisos.

The portal has no API or feed (checked 2026-11-07). The NT list has two sections,
"Documentos vigentes" and "Documentos não vigentes"; each line reads
"Nota Técnica 2026.008 v1.01 - Publicada em 30/10/2026" followed by its description.

The parsers are shared: the Publicações module lists every new NT version and aviso;
the Calendário module reads the same pages to keep the versions and the official PDFs.
"""

import re
from urllib.parse import quote, urljoin

from app.modules.intelligence.collectors import CollectContext
from app.modules.intelligence.text import clean_text, html_to_text, parse_br_date

BASE_URL = "https://www.nfe.fazenda.gov.br/portal/"
NT_LIST_URL = f"{BASE_URL}listaConteudo.aspx?tipoConteudo=04BIflQt1aY="
AVISOS_URL = f"{BASE_URL}informe.aspx?ehCTG=false"

_SECTION = re.compile(r'<p class="tituloSessao">([^<]+)</p>')
_ITEM = re.compile(
    r'<a[^>]*href="(exibirArquivo\.aspx\?conteudo=[^"]+)"[^>]*>\s*<span class="tituloConteudo">([\s\S]*?)</span>\s*</a>([\s\S]*?)(?=</p>)'
)
# "Nota Técnica 2026.008 v1.01 - Publicada em 30/10/2026" ou "Nota Técnica NT2023.002_v1.02 - ..."
_NT_TITLE = re.compile(r"(?:NT\s*)?(\d{4})[./](\d{3})[\s_]*v?\.?\s*(\d+\.\d+)", re.IGNORECASE)
_PUBLISHED = re.compile(r"Publicad[ao] em\s*(\d{2}/\d{2}/\d{4})", re.IGNORECASE)
_AVISO = re.compile(r'<div class="divInforme"[^>]*>\s*<a name="(\d+)"></a>\s*<p>([\s\S]*?)</p>([\s\S]*?)</div>')
_AVISO_HEAD = re.compile(r"^\s*(\d{2}/\d{2}/\d{4})\s*-\s*([\s\S]*)$")
# Avisos lidos por consulta (o portal pagina de 5 em 5)
AVISOS_PAGE_SIZE = 30


def _file_url(href: str) -> str:
    # o portal escreve o parâmetro em base64 sem codificar (pode conter espaço ou "+")
    absolute = urljoin(BASE_URL, href.replace("&amp;", "&"))
    return quote(absolute, safe=":/?=&%+")


def parse_notas_tecnicas(html: str) -> list[dict]:
    sections = list(_SECTION.finditer(html))
    if not sections:
        raise ValueError("Estrutura da página de Notas Técnicas da NF-e mudou (seções não encontradas)")
    items: dict[str, dict] = {}
    for index, section in enumerate(sections):
        end = sections[index + 1].start() if index + 1 < len(sections) else len(html)
        status = "não vigente" if "não" in section.group(1).lower() or "nao" in section.group(1).lower() else "vigente"
        for match in _ITEM.finditer(html[section.end() : end]):
            raw_title = clean_text(html_to_text(match.group(2)), 300)
            number = _NT_TITLE.search(raw_title)
            published = _PUBLISHED.search(raw_title)
            if number:
                key = f"NT {number.group(1)}.{number.group(2)}"
                label = f"v{number.group(3)}"
            else:
                key = re.sub(r"\s*-\s*Publicad[ao] em.*$", "", raw_title, flags=re.IGNORECASE)
                label = None
            if key in items:
                # a mesma NT pode aparecer nas duas seções: vale a primeira (vigente)
                continue
            title = re.sub(r"\s*-\s*Publicad[ao] em.*$", "", raw_title, flags=re.IGNORECASE).strip()
            url = _file_url(match.group(1))
            items[key] = {
                "externalId": key,
                "title": title,
                "url": url,
                "kind": "nota-tecnica",
                "publishedAt": parse_br_date(published.group(1)) if published else None,
                "summary": clean_text(html_to_text(match.group(3)), 1000),
                "versionLabel": label,
                "fileUrl": url,
                "sourceStatus": status,
            }
    return list(items.values())


def parse_avisos(html: str) -> list[dict]:
    blocks = list(_AVISO.finditer(html))
    if not blocks and "divInforme" not in html:
        raise ValueError("Estrutura da página de Avisos da NF-e mudou (avisos não encontrados)")
    items = []
    for block in blocks:
        head = _AVISO_HEAD.match(clean_text(html_to_text(block.group(2)), 400))
        if not head:
            continue
        body = clean_text(html_to_text(block.group(3)), 5000)
        items.append(
            {
                "externalId": block.group(1),
                "title": head.group(2).strip(),
                "url": f"{AVISOS_URL}#{block.group(1)}",
                "kind": "aviso",
                "publishedAt": parse_br_date(head.group(1)),
                "summary": clean_text(body, 600),
                "contentText": body,
            }
        )
    return items


def avisos_url() -> str:
    return f"{AVISOS_URL}&page=0&pagesize={AVISOS_PAGE_SIZE}"


def collect(ctx: CollectContext) -> list[dict]:
    """Publicações: each NT version and each aviso published in the period."""
    items = []
    for nt in parse_notas_tecnicas(ctx.fetch_text(NT_LIST_URL)):
        if not nt["publishedAt"] or nt["publishedAt"] < ctx.since:
            continue
        items.append(
            {
                # cada versão nova da NT é uma publicação nova
                "externalId": f"{nt['externalId']} {nt['versionLabel'] or ''}".strip(),
                "title": nt["title"],
                "url": nt["url"],
                "publishedAt": nt["publishedAt"],
                "excerpt": nt["summary"],
                "actType": "Nota Técnica",
                "organ": "Portal da NF-e",
            }
        )
    for aviso in parse_avisos(ctx.fetch_text(avisos_url())):
        if not aviso["publishedAt"] or aviso["publishedAt"] < ctx.since:
            continue
        items.append(
            {
                "externalId": f"aviso {aviso['externalId']}",
                "title": aviso["title"],
                "url": aviso["url"],
                "publishedAt": aviso["publishedAt"],
                "excerpt": aviso["summary"],
                "actType": "Aviso",
                "organ": "Portal da NF-e",
            }
        )
    return items
