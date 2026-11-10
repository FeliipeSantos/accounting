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
# Com PUBLIC_DOMAIN no .env, o site do Nginx vem do nginx-domain.conf (HTTPS);
# sem ele, do nginx-ip.conf (IP e porta, sem HTTPS).
PUBLIC_DOMAIN=$(sed -n 's/^PUBLIC_DOMAIN=//p' "$APP_DIR/.env" | tr -d '[:space:]')
CERT_DIR=/etc/letsencrypt/live/$PUBLIC_DOMAIN
if [[ -n "$PUBLIC_DOMAIN" ]]; then
  # com HTTPS o cookie de sessão volta a exigir HTTPS (a instalação por IP grava false)
  if grep -q '^COOKIE_SECURE=false' "$APP_DIR/.env"; then
    sed -i 's/^COOKIE_SECURE=false/# COOKIE_SECURE=false  (desligado: o acesso agora é por HTTPS)/' "$APP_DIR/.env"
    echo "COOKIE_SECURE=false desligado no .env: o acesso agora é por HTTPS"
  fi
else
  PUBLIC_PORT=$(sed -n 's/^ *listen \([0-9]*\)[ ;].*/\1/p' "$NGINX_SITE" | head -1)
  [[ -n "$PUBLIC_PORT" ]] || fail "não encontrei a porta em $NGINX_SITE"
fi

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
if [[ -n "$PUBLIC_DOMAIN" ]]; then
  mkdir -p /var/www/certbot
  if [[ -f "$CERT_DIR/fullchain.pem" ]]; then
    sed -e "s/__DOMAIN__/$PUBLIC_DOMAIN/g" -e "s/__API_PORT__/$API_PORT/g" "$APP_DIR/deploy/nginx-domain.conf" > "$NGINX_SITE"
  else
    # sem certificado ainda: só a porta 80, que responde à validação do certbot
    sed -e "s/__DOMAIN__/$PUBLIC_DOMAIN/g" -e "s/__API_PORT__/$API_PORT/g" "$APP_DIR/deploy/nginx-domain.conf" |
      sed '/^# --- HTTPS/,$d' > "$NGINX_SITE"
  fi
  nginx -t && systemctl reload nginx
  if [[ ! -f "$CERT_DIR/fullchain.pem" ]]; then
    fail "falta o certificado de $PUBLIC_DOMAIN. Gere com:
  sudo certbot certonly --webroot -w /var/www/certbot -d $PUBLIC_DOMAIN
e rode este script de novo."
  fi
  HEALTH_CURL=(curl -fs --resolve "$PUBLIC_DOMAIN:443:127.0.0.1" "https://$PUBLIC_DOMAIN/healthz")
  WHERE="https://$PUBLIC_DOMAIN"
else
  # o site padrão do Nginx ("Welcome to nginx") na mesma porta também é default_server: sai da frente
  if [[ -L /etc/nginx/sites-enabled/default ]] && grep -qE "listen +(\[::\]:)?${PUBLIC_PORT} +default_server" /etc/nginx/sites-enabled/default; then
    rm -f /etc/nginx/sites-enabled/default
    echo "site padrão do Nginx desativado (ocupava a porta $PUBLIC_PORT); continua em /etc/nginx/sites-available/default"
  fi
  sed -e "s/__PUBLIC_PORT__/$PUBLIC_PORT/g" -e "s/__API_PORT__/$API_PORT/g" "$APP_DIR/deploy/nginx-ip.conf" > "$NGINX_SITE"
  nginx -t && systemctl reload nginx
  HEALTH_CURL=(curl -fs "http://127.0.0.1:$PUBLIC_PORT/healthz")
  WHERE="a porta $PUBLIC_PORT"
fi

for _ in $(seq 1 20); do
  "${HEALTH_CURL[@]}" >/dev/null && break
  sleep 1
done
if ! "${HEALTH_CURL[@]}" >/dev/null; then
  # o backend responde direto, mas não pelo Nginx: outro site atende o mesmo endereço
  curl -fs "http://127.0.0.1:$API_PORT/healthz" >/dev/null &&
    fail "o backend responde, mas o Nginx não chega nele por $WHERE; veja os sites ativos: sudo grep -Rn \"listen\\|server_name\" /etc/nginx/sites-enabled/"
  fail "não respondeu; veja: sudo journalctl -u opencontabil-api -n 40"
fi
step "Atualizado e no ar em $WHERE"
