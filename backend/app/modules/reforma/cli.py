"""Terminal commands of Calendário.

flask reforma run        -> synchronizes the sources now (--backfill: first load, all pending texts and files)
flask reforma scheduled  -> runs the daily synchronization if it is due (called by the systemd timer)
flask reforma status     -> last synchronization and the state of each source
flask reforma events     -> extracts the calendar dates still pending (--rebuild: all again, after rules change)
flask reforma reread-pages -> reads the item pages again (tables kept) and redoes their calendar dates
"""

from datetime import datetime

import click
from flask.cli import AppGroup

from app.extensions import db
from app.modules.intelligence import http_client
from app.modules.reforma import monitor, repository, scheduler
from app.modules.reforma.catalog import SOURCES

reforma_group = AppGroup("reforma", help="Calendário: sincronização das fontes oficiais.")
_NAMES = {s["id"]: s["name"] for s in SOURCES}


def _print_run(run: dict) -> None:
    click.echo(
        f"\nStatus: {run['status']} | documentos novos: {run['newDocuments']} | versões novas: {run['newVersions']} | "
        f"arquivos baixados: {run['filesDownloaded']}"
    )
    for s in run.get("sources", []):
        counts = f"{s['fetched']} lidos, {s['newDocuments']} novos, {s['newVersions']} versões"
        detail = f"ERRO: {s['error']}" if s["status"] == "error" else counts
        click.echo(f"- {_NAMES.get(s['sourceId'], s['sourceId'])}: {detail} ({s['durationMs'] / 1000:.1f}s)")


# primeira carga: lê de uma vez os textos e PDFs que a rotina diária leria aos poucos
BACKFILL_TEXTS = 400
BACKFILL_FILES = 200


def _run(trigger: str, backfill: bool = False) -> None:
    limits = {"max_texts": BACKFILL_TEXTS, "max_files": BACKFILL_FILES} if backfill else {}
    try:
        run = monitor.run_sync(trigger=trigger, **limits)
    except monitor.SyncBusyError as err:
        raise click.ClickException(str(err)) from err
    _print_run(run)
    if run["status"] == "failed":
        raise SystemExit(1)


@reforma_group.command("run", help="Sincroniza as fontes agora.")
@click.option("--backfill", is_flag=True, help="Primeira carga: lê todos os textos e PDFs pendentes de uma vez (leva vários minutos).")
def run_command(backfill: bool) -> None:
    _run("cli", backfill)


@reforma_group.command("scheduled", help="Sincroniza se estiver na hora (usado pelo timer do systemd).")
def scheduled_command() -> None:
    if not scheduler.is_enabled():
        click.echo("Sincronização automática desligada (REFORMA_SCHEDULER=off).")
        return
    if not scheduler.is_due(repository.schedule_data(), datetime.now().astimezone()):
        return
    click.echo("[reforma] sincronização agendada iniciada")
    try:
        _run("scheduled")
    except click.ClickException:
        click.echo("[reforma] sincronização agendada adiada: outra em andamento")


@reforma_group.command("status", help="Mostra a última sincronização e a situação de cada fonte.")
def status_command() -> None:
    run = repository.last_run()
    if run is None:
        click.echo("Nenhuma sincronização realizada ainda.")
        return
    click.echo(f"Última sincronização: {run['finishedAt'] or run['startedAt']} ({run['trigger']})")
    _print_run(run)
    totals = repository.totals(datetime.now().astimezone().strftime("%Y-%m-01"))
    click.echo(
        f"\nDocumentos: {totals['documents']} | versões: {totals['versions']} | pendentes de análise: {totals['pendingAnalysis']} | "
        f"arquivos pendentes: {totals['pendingFiles']}"
    )


@reforma_group.command("events", help="Extrai as datas do calendário pendentes (--rebuild refaz todas, depois de mudar as regras).")
@click.option("--rebuild", is_flag=True, help="Refaz a extração de todos os documentos (o histórico dos eventos é mantido).")
def events_command(rebuild: bool) -> None:
    if rebuild:
        repository.reset_event_extraction()
        db.session.commit()
    totals = monitor.extract_pending_events(limit=100_000)
    click.echo(
        f"Documentos processados: {totals['documents']} | eventos criados: {totals['created']} | "
        f"atualizados: {totals['updated']} | substituídos: {totals['superseded']}"
    )


# fontes cujo texto vem da página de cada item (lido pelo próprio módulo)
REREAD_SOURCES = {"cgibs-comunicados", "cgibs-noticias", "receita-rt", "receita-noticias"}


@reforma_group.command("reread-pages", help="Lê de novo o texto das páginas dos itens (CGIBS, Receita) e refaz as datas do calendário.")
def reread_pages_command() -> None:
    cleared = repository.clear_page_texts(REREAD_SOURCES)
    db.session.commit()
    click.echo(f"Lendo de novo {cleared} página(s)...")
    filled = monitor.fill_page_texts(monitor.paced(http_client.fetch_text), limit=cleared + 10)
    totals = monitor.extract_pending_events(limit=100_000)
    click.echo(
        f"Páginas lidas: {filled} | eventos criados: {totals['created']} | atualizados: {totals['updated']} | "
        f"substituídos: {totals['superseded']}"
    )
