#!/bin/sh
# Entrada dos containers da api e do agendador: deixa o banco na versão do código
# (flask db upgrade, que não faz nada quando já está em dia) e roda o comando pedido.
#
#   docker compose run --rm api flask user add seu@email.com.br
#   docker compose run --rm api flask db-backup
set -eu

cd /app/backend
flask db upgrade
exec "$@"
