"""Terminal commands of the Inteligência Contábil module.

flask intel run         -> runs one monitoring cycle now
flask intel scheduled   -> runs the daily cycle if it is due (called by the systemd timer)
flask intel reclassify  -> re-applies the classification rules to stored publications
flask intel check       -> tests access to every source without storing anything
"""

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import click
from flask.cli import AppGroup

from app.modules.intelligence import http_client, monitor, repository, scheduler
from app.modules.intelligence.catalog import SOURCES
from app.modules.intelligence.collectors import CollectContext, registry
from app.modules.intelligence.text import add_days, local_iso_date

intel_group = AppGroup("intel", help="Inteligência Contábil: coletas e classificação.")
_NAMES = {s["id"]: s["name"] for s in SOURCES}


def _print_run(result: dict) -> None:
    click.echo(f"\nStatus: {result['status']} | novas: {result['newCount']} | duplicadas: {result['duplicateCount']}")
    for s in result["sources"]:
        if s["status"] == "error":
            detail = f"ERRO: {s['error']}"
        else:
            detail = f"{s['fetched']} lidas, {s['relevant']} relevantes, {s['newCount']} novas"
        click.echo(f"- {_NAMES.get(s['sourceId'], s['sourceId'])}: {detail} ({s['durationMs'] / 1000:.1f}s)")


def _run(trigger: str) -> None:
    try:
        result = monitor.run_monitoring(trigger=trigger)
    except monitor.MonitorBusyError as err:
        raise click.ClickException(str(err)) from err
    _print_run(result)
    if result["status"] == "failed":
        raise SystemExit(1)


@intel_group.command("run", help="Executa uma coleta agora.")
def run_command() -> None:
    _run("cli")


@intel_group.command("scheduled", help="Executa a coleta diária se estiver na hora (usado pelo timer do systemd).")
def scheduled_command() -> None:
    if not scheduler.is_scheduler_enabled():
        click.echo("Coleta automática desligada (INTEL_SCHEDULER=off).")
        return
    if not scheduler.is_due(repository.schedule_data(), datetime.now().astimezone()):
        return
    click.echo("[intelligence] execução agendada iniciada")
    try:
        _run("scheduled")
    except click.ClickException:
        # ocupado (coleta manual em andamento): o próximo disparo do timer tenta de novo
        click.echo("[intelligence] execução agendada adiada: outra coleta em andamento")


@intel_group.command("reclassify", help="Reaplica as regras de classificação às publicações guardadas.")
def reclassify_command() -> None:
    try:
        result = monitor.reclassify_all()
    except monitor.MonitorBusyError as err:
        raise click.ClickException(str(err)) from err
    click.echo(
        f"Reclassificadas: {result['updated']} | removidas (sem assunto monitorado): {result['removed']} | "
        f"favoritas mantidas sem assunto: {result['keptFavorites']}"
    )


@intel_group.command("check", help="Testa o acesso às fontes oficiais (últimos 7 dias), sem gravar nada.")
def check_command() -> None:
    today = local_iso_date()
    since = add_days(today, -7)
    click.echo(f"Verificando acesso às fontes oficiais (últimos 7 dias, fuso {time.strftime('%Z')})...\n")
    collectors = registry()

    def probe(source: dict) -> tuple[dict, bool, str, float]:
        started = time.monotonic()
        try:
            ctx = CollectContext(http_client.fetch_text, http_client.fetch_json, today, since, lambda _id: True)
            items = collectors[source["id"]](ctx)
            return source, True, f"{len(items)} item(ns) lido(s)", time.monotonic() - started
        except Exception as err:  # noqa: BLE001
            return source, False, str(err), time.monotonic() - started

    collectable = [s for s in SOURCES if s["collectable"]]
    with ThreadPoolExecutor(max_workers=len(collectable)) as pool:
        results = list(pool.map(probe, collectable))
    for source, ok, detail, seconds in results:
        click.echo(f"{'OK  ' if ok else 'ERRO'} {source['name']}: {detail} ({seconds:.1f}s)")
    failed = sum(1 for _, ok, _, _ in results if not ok)
    click.echo(f"\n{len(results) - failed} de {len(results)} fontes acessíveis.")
    if failed:
        raise SystemExit(1)
