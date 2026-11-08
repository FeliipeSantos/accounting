#!/usr/bin/env bash
# Atualiza o Project Accounting instalado pelo deploy/vps-install.sh com o que está no GitHub:
# backup do banco, código novo, dependências, tela, migrations e reinício.
#
# Uso, na VPS:  sudo bash /opt/project-accounting/deploy/vps-update.sh

set -euo pipefail

APP_DIR=/opt/project-accounting
NODE_DIR=/opt/project-accounting-node
SERVICE_USER=project-accounting
NGINX_SITE=/etc/nginx/sites-available/project-accounting-ip

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERRO: %s\033[0m\n' "$*" >&2; exit 1; }
as_app() { (cd "$APP_DIR/backend" && sudo -u "$SERVICE_USER" .venv/bin/flask "$@"); }

[[ $EUID -eq 0 ]] || fail "rode com sudo: sudo bash $0"
API_PORT=$(sed -n 's/^PORT=//p' "$APP_DIR/.env")
PUBLIC_PORT=$(sed -n 's/^ *listen \([0-9]*\);/\1/p' "$NGINX_SITE" | head -1)

step "Backup do banco"
as_app db-backup

step "Código do GitHub"
git -C "$APP_DIR" pull --ff-only
git -C "$APP_DIR" log --oneline -1

step "Backend e tela"
"$APP_DIR/backend/.venv/bin/pip" install -q -r "$APP_DIR/backend/requirements.txt"
(cd "$APP_DIR/frontend" && PATH="$NODE_DIR/bin:$PATH" npm ci --no-audit --no-fund && PATH="$NODE_DIR/bin:$PATH" npm run build)
chown -R "root:$SERVICE_USER" "$APP_DIR"

step "Migrations do banco"
as_app db upgrade

step "Serviços e Nginx"
cp "$APP_DIR"/deploy/project-accounting-{api,intel,reforma,backup}.service "$APP_DIR"/deploy/project-accounting-{intel,reforma,backup}.timer /etc/systemd/system/
systemctl daemon-reload
systemctl restart project-accounting-api
sed -e "s/__PUBLIC_PORT__/$PUBLIC_PORT/g" -e "s/__API_PORT__/$API_PORT/g" "$APP_DIR/deploy/nginx-ip.conf" > "$NGINX_SITE"
nginx -t && systemctl reload nginx

for _ in $(seq 1 20); do
  curl -fs "http://127.0.0.1:$PUBLIC_PORT/healthz" >/dev/null && break
  sleep 1
done
curl -fs "http://127.0.0.1:$PUBLIC_PORT/healthz" >/dev/null || fail "não respondeu; veja: sudo journalctl -u project-accounting-api -n 40"
step "Atualizado e no ar na porta $PUBLIC_PORT"
