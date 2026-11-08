"""Official pages without a list of publications (schedules, technical documentation):
their main text is compared on every check, and a change becomes a new version."""

import hashlib
import re

from app.modules.intelligence.text import clean_text, html_to_text
from app.modules.reforma.catalog import WATCHED_PAGES
from app.modules.reforma.collectors import SyncContext

MAX_PAGE_TEXT = 200_000

# início do conteúdo principal, por ordem de preferência (Plone do gov.br e o portal do CGIBS)
_CONTENT_STARTS = ['id="parent-fieldname-text"', 'id="content-core"', 'class="artigo__texto"', 'id="content"', "<main"]
# fim do conteúdo principal (rodapé, compartilhamento, data de atualização)
_CONTENT_ENDS = re.compile(
    r'<div[^>]*class="[^"]*(?:documentByLine|social-links|documentActions|link-box|rodape)|<footer|id="viewlet-below-content|id="portal-footer',
    re.IGNORECASE,
)


_TABLE = re.compile(r"<table\b[\s\S]*?</table>", re.IGNORECASE)
_ROW = re.compile(r"<tr\b[\s\S]*?</tr>", re.IGNORECASE)
_CELL = re.compile(r"<t[dh]\b[^>]*>([\s\S]*?)</t[dh]>", re.IGNORECASE)
CELL_SEPARATOR = " | "


def _table_as_lines(match: re.Match) -> str:
    """A table as one line per row, cells separated by " | " (the header row first)."""
    lines = []
    for row in _ROW.findall(match.group(0)):
        cells = [clean_text(html_to_text(cell), 500).replace("\n", " ") for cell in _CELL.findall(row)]
        if any(cells):
            lines.append(CELL_SEPARATOR.join(cells))
    return "<p>" + "</p><p>".join(lines) + "</p>"


def main_text(html: str, tables: bool = False) -> str:
    """Readable main content of an official page, without menus, footer and sharing links.

    tables=True keeps each table row on its own line ("cell | cell"), so dates in a schedule
    stay tied to their row; the monitored pages keep the plain text (their version identity)."""
    start = -1
    for marker in _CONTENT_STARTS:
        start = html.find(marker)
        if start >= 0:
            break
    if start < 0:
        raise ValueError("Conteúdo principal da página não encontrado")
    # o texto começa depois da tag que contém o marcador
    start = html.find(">", start) + 1
    end = _CONTENT_ENDS.search(html, start)
    content = html[start : end.start() if end else len(html)]
    if tables:
        content = _TABLE.sub(_table_as_lines, content)
    return clean_text(html_to_text(content, MAX_PAGE_TEXT), MAX_PAGE_TEXT)


# data de publicação na página do item: <time datetime="2026-10-28T..."> (CGIBS) ou "publicado 05/11/2026" (gov.br)
_PAGE_TIME = re.compile(r'<time[^>]*datetime="(\d{4}-\d{2}-\d{2})')
_PAGE_PUBLISHED = re.compile(r'class="documentPublished"[\s\S]{0,400}?(\d{2})/(\d{2})/(\d{4})')


def published_date(html: str) -> str | None:
    """Publication date shown on an item page, when there is one."""
    if match := _PAGE_TIME.search(html):
        return match.group(1)
    if match := _PAGE_PUBLISHED.search(html):
        return f"{match.group(3)}-{match.group(2)}-{match.group(1)}"
    return None


def collect(ctx: SyncContext) -> list[dict]:
    items = []
    for page in WATCHED_PAGES:
        text = main_text(ctx.fetch_text(page["url"]))
        items.append(
            {
                "externalId": page["id"],
                "title": page["title"],
                "url": page["url"],
                "kind": "pagina",
                "publishedAt": None,
                "summary": clean_text(text, 400),
                # o texto é a identidade da versão: qualquer mudança na página é uma nova versão
                "contentText": text,
                "versionLabel": f"conteúdo {hashlib.sha256(text.encode('utf-8')).hexdigest()[:8]}",
            }
        )
    return items
