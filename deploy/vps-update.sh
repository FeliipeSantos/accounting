#!/usr/bin/env bash
# Atualiza o opencontabil instalado pelo deploy/vps-install.sh com o que está no GitHub:
# backup do banco, código novo, dependências, tela, migrations e reinício.
#
# Uso, na VPS:  sudo bash /opt/opencontabil/deploy/vps-update.sh

set -euo pipefail

APP_DIR=/opt/opencontabil
NODE_DIR=$APP_DIR/.tools/node
OLD_NODE_DIR=/opt/project-accounting-node
SERVICE_USER=opencontabil
NGINX_SITE=/etc/nginx/sites-available/opencontabil-ip

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERRO: %s\033[0m\n' "$*" >&2; exit 1; }
as_app() { (cd "$APP_DIR/backend" && sudo -u "$SERVICE_USER" .venv/bin/flask "$@"); }

[[ $EUID -eq 0 ]] || fail "rode com sudo: sudo bash $0"
# instalação de antes da troca de nome: primeiro a migração única (pastas, usuário e serviços)
if [[ ! -d "$APP_DIR" && -d /opt/project-accounting ]]; then
  fail "esta VPS ainda usa o nome antigo; rode uma vez: sudo bash /opt/project-accounting/deploy/vps-rename.sh"
fi
API_PORT=$(sed -n 's/^PORT=//p' "$APP_DIR/.env")
PUBLIC_PORT=$(sed -n 's/^ *listen \([0-9]*\)[ ;].*/\1/p' "$NGINX_SITE" | head -1)
[[ -n "$PUBLIC_PORT" ]] || fail "não encontrei a porta em $NGINX_SITE"

step "Backup do banco"
as_app db-backup

step "Código do GitHub"
git -C "$APP_DIR" pull --ff-only
git -C "$APP_DIR" log --oneline -1

step "Backend e tela"
# instalações antigas guardavam o Node em /opt/project-accounting-node: vai para dentro do projeto
if [[ ! -x "$NODE_DIR/bin/node" && -x "$OLD_NODE_DIR/bin/node" ]]; then
  mkdir -p "$(dirname "$NODE_DIR")" && mv "$OLD_NODE_DIR" "$NODE_DIR"
fi
[[ -x "$NODE_DIR/bin/node" ]] || fail "Node da tela não encontrado em $NODE_DIR; rode o deploy/vps-install.sh"
"$APP_DIR/backend/.venv/bin/pip" install -q -r "$APP_DIR/backend/requirements.txt"
(cd "$APP_DIR/frontend" && PATH="$NODE_DIR/bin:$PATH" npm ci --no-audit --no-fund && PATH="$NODE_DIR/bin:$PATH" npm run build)
chown -R "root:$SERVICE_USER" "$APP_DIR"

step "Migrations do banco"
as_app db upgrade

step "Serviços e Nginx"
cp "$APP_DIR"/deploy/opencontabil-{api,intel,reforma,backup}.service "$APP_DIR"/deploy/opencontabil-{intel,reforma,backup}.timer /etc/systemd/system/
systemctl daemon-reload
# ativa sempre: depois da troca de nome os serviços novos ainda não estão ativados
systemctl enable -q opencontabil-api opencontabil-intel.timer opencontabil-reforma.timer opencontabil-backup.timer
systemctl restart opencontabil-api
systemctl start opencontabil-intel.timer opencontabil-reforma.timer opencontabil-backup.timer
# o site padrão do Nginx ("Welcome to nginx") na mesma porta também é default_server: sai da frente
if [[ -L /etc/nginx/sites-enabled/default ]] && grep -qE "listen +(\[::\]:)?${PUBLIC_PORT} +default_server" /etc/nginx/sites-enabled/default; then
  rm -f /etc/nginx/sites-enabled/default
  echo "site padrão do Nginx desativado (ocupava a porta $PUBLIC_PORT); continua em /etc/nginx/sites-available/default"
fi
sed -e "s/__PUBLIC_PORT__/$PUBLIC_PORT/g" -e "s/__API_PORT__/$API_PORT/g" "$APP_DIR/deploy/nginx-ip.conf" > "$NGINX_SITE"
nginx -t && systemctl reload nginx

for _ in $(seq 1 20); do
  curl -fs "http://127.0.0.1:$PUBLIC_PORT/healthz" >/dev/null && break
  sleep 1
done
if ! curl -fs "http://127.0.0.1:$PUBLIC_PORT/healthz" >/dev/null; then
  # o backend responde direto, mas não pelo Nginx: outro site atende a mesma porta
  curl -fs "http://127.0.0.1:$API_PORT/healthz" >/dev/null &&
    fail "o backend responde, mas o Nginx da porta $PUBLIC_PORT não chega nele; veja os sites dessa porta: sudo grep -Rn \"listen\" /etc/nginx/sites-enabled/"
  fail "não respondeu; veja: sudo journalctl -u opencontabil-api -n 40"
fi
step "Atualizado e no ar na porta $PUBLIC_PORT"
