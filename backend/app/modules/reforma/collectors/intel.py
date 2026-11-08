"""Publications already collected by the Publicações module (read-only).

Avoids fetching the DOU, Senado, Câmara, CONFAZ convênios, Receita, Fazenda and Simples
again: all their publications (every subject, not only the Reforma) come in with the full
text that module already read. Nothing in that module is changed.
"""

from datetime import timedelta

from sqlalchemy import text

from app.extensions import db
from app.modules.intelligence.text import parse_iso_datetime
from app.modules.reforma.collectors import SyncContext

# fontes que o Calendário lê direto, com versões e PDFs: não entram de novo pelo Publicações
_READ_DIRECTLY = {"nfe", "cgibs", "cff"}
# fontes de notícia e de projeto de lei: nunca viram norma
_NEWS_SOURCES = {"receita", "fazenda", "simples", "sped", "esocial"}
# margem sobre a última leitura: publicações gravadas enquanto a anterior rodava
OVERLAP = timedelta(hours=2)


def kind_of(source_id: str, norm_type: str | None, act_type: str | None = None) -> str:
    if source_id == "camara" or norm_type == "Projeto de lei":
        return "proposta"
    if act_type == "Protocolo ICMS":
        return "protocolo"
    if source_id in _NEWS_SOURCES:
        return "noticia"
    if norm_type == "Comunicado informativo":
        return "comunicado"
    return "norma"


def collect(ctx: SyncContext) -> list[dict]:
    # as novas desde a última leitura e as que o Calendário ainda não tem (ex.: assuntos que
    # passaram a entrar depois); as já conhecidas e sem novidade não são lidas de novo
    since = (parse_iso_datetime(ctx.last_success_at) - OVERLAP).isoformat().replace("+00:00", "Z") if ctx.last_success_at else ""
    # protocolos que o Calendário já lia do CONFAZ (até 08/11/2026): o mesmo endereço não entra de novo
    stored_urls = set(db.session.execute(text("SELECT url FROM reforma_documents WHERE source_id = 'confaz-protocolos'")).scalars())
    ids = [
        row["id"]
        for row in db.session.execute(text("SELECT id, collected_at FROM intel_publications ORDER BY collected_at")).mappings()
        if row["id"] not in ctx.known or (row["collected_at"] or "") >= since
    ]
    rows = []
    # em blocos: o SQLite limita a quantidade de parâmetros de uma consulta
    for start in range(0, len(ids), 500):
        names = {f"p{i}": publication_id for i, publication_id in enumerate(ids[start : start + 500])}
        rows += (
            db.session.execute(
                text(
                    "SELECT p.id, p.source_id, p.title, p.url, p.published_at, p.excerpt, p.act_type, p.organ, p.norm_type, "
                    "t.full_text FROM intel_publications p "
                    "LEFT JOIN intel_publication_texts t ON t.publication_id = p.id AND t.status = 'ok' "
                    f"WHERE p.id IN ({', '.join(':' + name for name in names)}) "
                    "ORDER BY p.collected_at"
                ),
                names,
            )
            .mappings()
            .all()
        )
    return [
        {
            "externalId": row["id"],
            "title": row["title"],
            "url": row["url"],
            "kind": kind_of(row["source_id"], row["norm_type"], row["act_type"]),
            "publishedAt": row["published_at"],
            "summary": row["excerpt"] or "",
            "fullText": row["full_text"],
            "sourceStatus": f"Publicações · {row['source_id']}",
        }
        for row in rows
        if row["url"] not in stored_urls and row["source_id"] not in _READ_DIRECTLY
    ]
