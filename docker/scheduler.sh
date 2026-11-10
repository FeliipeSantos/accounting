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

# Pasta das cópias: a mesma do flask db-backup (backup_dir em app/core/backup.py):
# BACKUP_DIR, ou "backups" ao lado do banco. DB_PATH relativo vale a partir da raiz do
# projeto (/app) e, sem ele, o banco fica em /app/data/app.db, como em app/config.py.
db_path=${DB_PATH:-data/app.db}
case "$db_path" in
  /*) ;;
  *) db_path="/app/$db_path" ;;
esac
backup_dir=${BACKUP_DIR:-$(dirname "$db_path")/backups}

# Já existe cópia do dia ($1 = AAAA-MM-DD)? O controle fica no disco, e não na memória,
# para um reinício do container (atualização, reboot) não gerar outra cópia no mesmo dia.
# Uma cópia manual do dia (flask db-backup antes de atualizar) também conta.
has_backup_for() {
  for file in "$backup_dir"/app-"$1"_*.db; do
    [ -e "$file" ] && return 0
  done
  return 1
}

cd /app/backend
echo "[agendador] iniciado: verificações a cada $((INTERVAL_SECONDS / 60)) min, cópia do banco às ${BACKUP_HOUR}:00 em $backup_dir"

while true; do
  flask intel scheduled || echo "[agendador] a coleta do Publicações falhou; nova tentativa na próxima volta"
  flask reforma scheduled || echo "[agendador] a sincronização do Calendário falhou; nova tentativa na próxima volta"

  today=$(date +%F)
  # uma cópia por dia, a partir das 03:00 (como o Persistent=true do timer: se o
  # container estava parado no horário, a cópia sai na primeira volta depois)
  if [ "$(date +%H)" -ge "$BACKUP_HOUR" ] && ! has_backup_for "$today"; then
    flask db-backup || echo "[agendador] a cópia do banco falhou; nova tentativa na próxima volta"
  fi

  sleep "$INTERVAL_SECONDS"
done
