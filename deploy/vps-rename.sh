#!/usr/bin/env bash
# Troca de nome, uma única vez: uma VPS instalada como "project-accounting" passa a "opencontabil".
#
#   pasta do código   /opt/project-accounting        -> /opt/opencontabil
#   pasta dos dados   /var/lib/project-accounting    -> /var/lib/opencontabil  (banco, PDFs e backups)
#   usuário/grupo     project-accounting             -> opencontabil           (mesmo UID: arquivos continuam dele)
#   serviços          project-accounting-*           -> opencontabil-*
#   site do Nginx     project-accounting-ip          -> opencontabil-ip        (mesma porta)
#   repositório       FeliipeSantos/accounting       -> FeliipeSantos/opencontabil
#
# Antes: renomeie o repositório no GitHub para "opencontabil". Depois, na VPS:
#   sudo git -C /opt/project-accounting pull
#   sudo bash /opt/project-accounting/deploy/vps-rename.sh
#
# O sistema fica fora do ar por alguns minutos (até o fim do vps-update.sh, chamado no final).
# Nenhum dado é apagado: o banco é copiado antes, e pastas e usuário só mudam de nome.

set -euo pipefail

OLD=project-accounting
NEW=opencontabil
OLD_APP=/opt/$OLD
NEW_APP=/opt/$NEW
OLD_DATA=/var/lib/$OLD
NEW_DATA=/var/lib/$NEW
REPO=https://github.com/FeliipeSantos/opencontabil.git

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERRO: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "rode com sudo: sudo bash $0"
if [[ -d "$NEW_APP" && ! -d "$OLD_APP" ]]; then
  echo "A troca de nome já foi feita. Para atualizar: sudo bash $NEW_APP/deploy/vps-update.sh"
  exit 0
fi
[[ -d "$OLD_APP" ]] || fail "não encontrei $OLD_APP: nada para trocar"
[[ ! -e "$NEW_APP" ]] || fail "$NEW_APP já existe; confira antes de continuar"
[[ ! -e "$NEW_DATA" ]] || fail "$NEW_DATA já existe; confira antes de continuar"
! id "$NEW" >/dev/null 2>&1 || fail "o usuário $NEW já existe; confira antes de continuar"
git ls-remote "$REPO" HEAD >/dev/null 2>&1 || fail "não encontrei $REPO; renomeie o repositório no GitHub para \"$NEW\" primeiro"

step "Backup do banco (ainda com os nomes antigos)"
(cd "$OLD_APP/backend" && sudo -u "$OLD" .venv/bin/flask db-backup)

step "Parando os serviços antigos"
systemctl disable --now "$OLD"-intel.timer "$OLD"-reforma.timer "$OLD"-backup.timer 2>/dev/null || true
# espera uma coleta ou backup em andamento terminar
systemctl stop "$OLD"-intel.service "$OLD"-reforma.service "$OLD"-backup.service 2>/dev/null || true
systemctl disable --now "$OLD"-api 2>/dev/null || true
rm -f /etc/systemd/system/"$OLD"-{api,intel,reforma,backup}.service /etc/systemd/system/"$OLD"-{intel,reforma,backup}.timer
systemctl daemon-reload

step "Usuário e grupo: $OLD -> $NEW"
usermod -l "$NEW" "$OLD"
# o useradd --system do Ubuntu cria um grupo com o mesmo nome; confere antes de renomear
if getent group "$OLD" >/dev/null; then
  groupmod -n "$NEW" "$OLD"
fi
usermod -d "$NEW_APP" "$NEW"

step "Pastas: $OLD_APP -> $NEW_APP e $OLD_DATA -> $NEW_DATA"
mv "$OLD_APP" "$NEW_APP"
mv "$OLD_DATA" "$NEW_DATA"

step "Caminhos do .env"
sed -i -e "s#$OLD_DATA#$NEW_DATA#g" -e "s#$OLD_APP#$NEW_APP#g" "$NEW_APP/.env"
grep -E '^(DB_PATH|BACKUP_DIR|REFORMA_FILES_DIR)=' "$NEW_APP/.env" || true

step "Endereço do repositório"
git -C "$NEW_APP" remote set-url origin "$REPO"
git -C "$NEW_APP" remote -v | head -1

step "Ambiente Python (os programas do .venv guardam o caminho da pasta antiga)"
rm -rf "$NEW_APP/backend/.venv"
python3 -m venv "$NEW_APP/backend/.venv"
"$NEW_APP/backend/.venv/bin/pip" install -q --upgrade pip
"$NEW_APP/backend/.venv/bin/pip" install -q -r "$NEW_APP/backend/requirements.txt"
chown -R "root:$NEW" "$NEW_APP"

step "Site do Nginx: $OLD-ip -> $NEW-ip (o vps-update.sh grava o conteúdo novo)"
if [[ -e /etc/nginx/sites-available/"$OLD"-ip ]]; then
  mv /etc/nginx/sites-available/"$OLD"-ip /etc/nginx/sites-available/"$NEW"-ip
fi
rm -f /etc/nginx/sites-enabled/"$OLD"-ip
ln -sf /etc/nginx/sites-available/"$NEW"-ip /etc/nginx/sites-enabled/"$NEW"-ip

step "Instalando com os nomes novos"
bash "$NEW_APP/deploy/vps-update.sh"

step "Troca de nome concluída"
echo "Daqui em diante: sudo bash $NEW_APP/deploy/vps-update.sh"
