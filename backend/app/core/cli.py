"""Terminal commands.

    flask user list
    flask user add <usuario>       (asks the password in the terminal)
    flask user passwd <usuario>    (also ends the user's open sessions)
    flask user remove <usuario>
    flask db-backup

Passwords are never taken from the command line, so they stay out of the shell history.
"""

import sys

import click
from flask import Flask, current_app
from flask.cli import AppGroup, with_appcontext

from app.core import users
from app.core.backup import backup_dir, create_backup


def _ask_new_password() -> str:
    # sem terminal (ex.: testes, scripts), lê uma linha só, sem confirmação
    if not sys.stdin.isatty():
        return sys.stdin.readline().rstrip("\r\n")
    return click.prompt(
        f"Senha (mín. {users.MIN_PASSWORD_LENGTH} caracteres)",
        hide_input=True,
        confirmation_prompt="Repita a senha",
    )


def _run(action) -> None:
    try:
        action()
    except users.UserError as err:
        raise click.ClickException(str(err)) from err


# AppGroup abre o contexto da aplicação (acesso ao banco) em cada subcomando
user_group = AppGroup("user", help="Gerencia os usuários do sistema.")


@user_group.command("list", help="Lista os usuários.")
def list_command() -> None:
    rows = users.list_users()
    if not rows:
        click.echo("Nenhum usuário cadastrado.")
    for u in rows:
        click.echo(f"{u.username}  (criado em {u.created_at[:10]}, alterado em {u.updated_at[:10]})")


@user_group.command("add", help="Cria um usuário.")
@click.argument("username")
def add_command(username: str) -> None:
    _run(lambda: users.create_user(username, _ask_new_password()))
    click.echo(f'Usuário "{username}" criado.')


@user_group.command("passwd", help="Troca a senha e encerra as sessões abertas do usuário.")
@click.argument("username")
def passwd_command(username: str) -> None:
    _run(lambda: users.set_password(username, _ask_new_password()))
    click.echo(f'Senha de "{username}" alterada; as sessões abertas dele foram encerradas.')


@user_group.command("remove", help="Remove um usuário.")
@click.argument("username")
def remove_command(username: str) -> None:
    _run(lambda: users.remove_user(username))
    click.echo(f'Usuário "{username}" removido.')


@click.command("db-backup", help="Cria uma cópia consistente do banco agora.")
@with_appcontext
def backup_command() -> None:
    settings = current_app.config["SETTINGS"]
    target = create_backup(settings.db_path, backup_dir(settings.db_path, settings.backup_dir), settings.backup_keep)
    click.echo(f"Cópia criada: {target}")


def register_commands(app: Flask) -> None:
    app.cli.add_command(user_group)
    app.cli.add_command(backup_command)
