#!/bin/sh
# Agendador do Docker: faz o papel dos timers do systemd da VPS (deploy/*.timer).
#
#   a cada 5 minutos  flask intel scheduled     coleta diária do Publicações, quando está na hora
#                     flask reforma scheduled   sincronização diária do Calendário, quando está na hora
#   uma vez por dia   flask db-backup           cópia do banco, a partir das 03:00
#
# Os dois primeiros só trabalham na hora configurada (e recuperam uma execução perdida),
# então rodar a cada 5 minutos é o mesmo que a VPS faz. Uma falha não para o agendador.
set -u

INTERVAL_SECONDS=300
BACKUP_HOUR=03
last_backup=""

cd /app/backend
echo "[agendador] iniciado: verificações a cada $((INTERVAL_SECONDS / 60)) min, cópia do banco às ${BACKUP_HOUR}:00"

while true; do
  flask intel scheduled || echo "[agendador] a coleta do Publicações falhou; nova tentativa na próxima volta"
  flask reforma scheduled || echo "[agendador] a sincronização do Calendário falhou; nova tentativa na próxima volta"

  today=$(date +%F)
  # uma cópia por dia, a partir das 03:00 (como o Persistent=true do timer: se o
  # container estava parado no horário, a cópia sai na primeira volta depois)
  if [ "$(date +%H)" -ge "$BACKUP_HOUR" ] && [ "$last_backup" != "$today" ]; then
    if flask db-backup; then
      last_backup="$today"
    else
      echo "[agendador] a cópia do banco falhou; nova tentativa na próxima volta"
    fi
  fi

  sleep "$INTERVAL_SECONDS"
done
