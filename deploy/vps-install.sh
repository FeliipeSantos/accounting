#!/usr/bin/env bash
# Instala o Project Accounting numa VPS Ubuntu/Debian com acesso por http://IP:8082,
# ao lado de outros sistemas (não mexe em outras portas, sites do Nginx nem no Node do sistema).
#
# Uso, na VPS (o código vem do GitHub):
#   sudo git clone https://github.com/FeliipeSantos/accounting.git /opt/project-accounting
#   sudo bash /opt/project-accounting/deploy/vps-install.sh [/tmp/project-accounting-dados.tar.gz]
#
# O arquivo opcional traz os dados do seu computador (app.db e reforma-files); sem ele,
# o banco começa vazio. Pode ser rodado de novo: o que já existe é mantido.
#
# Portas (variáveis de ambiente): PUBLIC_PORT=8082 (acesso pelo navegador) e
# API_PORT=8090 (backend, só interno em 127.0.0.1).

set -euo pipefail

PUBLIC_PORT="${PUBLIC_PORT:-8082}"
API_PORT="${API_PORT:-8090}"
APP_DIR=/opt/project-accounting
DATA_DIR=/var/lib/project-accounting
# Node próprio, dentro da pasta do projeto (ignorado pelo git): uma pasta só por projeto em /opt
NODE_DIR=$APP_DIR/.tools/node
OLD_NODE_DIR=/opt/project-accounting-node
SERVICE_USER=project-accounting
REPO=https://github.com/FeliipeSantos/accounting.git
NGINX_SITE=/etc/nginx/sites-available/project-accounting-ip
BUNDLE="${1:-}"

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERRO: %s\033[0m\n' "$*" >&2; exit 1; }
as_app() { (cd "$APP_DIR/backend" && sudo -u "$SERVICE_USER" .venv/bin/flask "$@"); }
port_in_use() { ss -ltnH "( sport = :$1 )" | grep -q .; }

[[ $EUID -eq 0 ]] || fail "rode com sudo: sudo bash $0"
[[ -z "$BUNDLE" || -f "$BUNDLE" ]] || fail "arquivo de dados não encontrado: $BUNDLE"

step "Conferindo as portas $PUBLIC_PORT e $API_PORT"
if [[ ! -e "$NGINX_SITE" ]] && port_in_use "$PUBLIC_PORT"; then
  fail "a porta $PUBLIC_PORT já está em uso por outro programa (veja: sudo ss -ltnp | grep :$PUBLIC_PORT)"
fi
if ! systemctl is-active --quiet project-accounting-api && port_in_use "$API_PORT"; then
  fail "a porta interna $API_PORT já está em uso; rode com outra, ex.: sudo API_PORT=8091 bash $0"
fi

step "Pacotes do sistema (git, Python, Nginx)"
NGINX_WAS_INSTALLED=0
command -v nginx >/dev/null && NGINX_WAS_INSTALLED=1
apt-get update -q
if [[ $NGINX_WAS_INSTALLED -eq 0 ]]; then
  # não deixa o Nginx novo subir sozinho na porta 80 (pode estar em uso por outro sistema)
  printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d && chmod +x /usr/sbin/policy-rc.d
fi
apt-get install -y -q git curl xz-utils python3-venv nginx
rm -f /usr/sbin/policy-rc.d
if [[ $NGINX_WAS_INSTALLED -eq 0 ]]; then
  rm -f /etc/nginx/sites-enabled/default
fi
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)' || fail "precisa de Python 3.12 ou superior (tem $(python3 --version))"

step "Usuário do serviço e pastas"
id "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
mkdir -p "$DATA_DIR"
chown "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"
chmod 750 "$DATA_DIR"

step "Código do GitHub"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO" "$APP_DIR"
fi

step "Backend (Python)"
[[ -d "$APP_DIR/backend/.venv" ]] || python3 -m venv "$APP_DIR/backend/.venv"
"$APP_DIR/backend/.venv/bin/pip" install -q --upgrade pip
"$APP_DIR/backend/.venv/bin/pip" install -q -r "$APP_DIR/backend/requirements.txt"

step "Node.js 24 próprio (só para gerar a tela; o Node do sistema não muda)"
# instalações antigas guardavam o Node em /opt/project-accounting-node
if [[ ! -x "$NODE_DIR/bin/node" && -x "$OLD_NODE_DIR/bin/node" ]]; then
  mkdir -p "$(dirname "$NODE_DIR")" && mv "$OLD_NODE_DIR" "$NODE_DIR"
fi
if [[ ! -x "$NODE_DIR/bin/node" ]]; then
  case "$(uname -m)" in
    x86_64) NODE_ARCH=x64 ;;
    aarch64 | arm64) NODE_ARCH=arm64 ;;
    *) fail "arquitetura não suportada: $(uname -m)" ;;
  esac
  NODE_FILE=$(curl -fsSL https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt | awk -v a="linux-$NODE_ARCH.tar.xz" '$2 ~ a"$" {print $2; exit}')
  [[ -n "$NODE_FILE" ]] || fail "não encontrei o Node 24 para linux-$NODE_ARCH"
  mkdir -p "$NODE_DIR"
  curl -fsSL "https://nodejs.org/dist/latest-v24.x/$NODE_FILE" | tar -xJ -C "$NODE_DIR" --strip-components=1
fi
"$NODE_DIR/bin/node" --version

step "Tela (React)"
(cd "$APP_DIR/frontend" && PATH="$NODE_DIR/bin:$PATH" npm ci --no-audit --no-fund && PATH="$NODE_DIR/bin:$PATH" npm run build)
chown -R "root:$SERVICE_USER" "$APP_DIR"

step "Configuração (.env)"
APP_USER=""
if [[ ! -f "$APP_DIR/.env" ]]; then
  read -rp "Nome do seu usuário de acesso (ex.: felipe): " APP_USER
  [[ "$APP_USER" =~ ^[A-Za-z0-9._-]{3,64}$ ]] || fail "usuário inválido (use letras, números, ponto, hífen; 3 a 64)"
  cat > "$APP_DIR/.env" <<EOF
# Gerado pelo deploy/vps-install.sh. Veja .env.example para todas as opções.
APP_ENV=production
# backend só interno: o acesso externo passa pelo Nginx na porta $PUBLIC_PORT
HOST=127.0.0.1
PORT=$API_PORT
TRUST_PROXY=true
TZ=America/Sao_Paulo
DB_PATH=$DATA_DIR/app.db
BACKUP_KEEP=7
SESSION_TTL_HOURS=8
# acesso por http://IP:$PUBLIC_PORT, sem HTTPS: o cookie de sessão não pode exigir HTTPS
COOKIE_SECURE=false
# usuários com acesso ao Calendário
REFORMA_USERS=$APP_USER
EOF
  chown "root:$SERVICE_USER" "$APP_DIR/.env"
  chmod 640 "$APP_DIR/.env"
else
  echo ".env já existe: mantido"
  APP_USER=$(sed -n 's/^REFORMA_USERS=\([^,]*\).*/\1/p' "$APP_DIR/.env")
fi

step "Dados"
if [[ -f "$DATA_DIR/app.db" ]]; then
  echo "Banco já existe em $DATA_DIR/app.db: mantido"
elif [[ -n "$BUNDLE" ]]; then
  tar -xzf "$BUNDLE" -C "$DATA_DIR"
  echo "Dados do seu computador copiados para $DATA_DIR"
fi
chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"
find "$DATA_DIR" -maxdepth 1 -name 'app.db*' -exec chmod 640 {} +
as_app db upgrade

if [[ -n "$APP_USER" ]] && ! as_app user list | grep -q "^$APP_USER "; then
  echo "Crie a senha de \"$APP_USER\" (mínimo 10 caracteres):"
  as_app user add "$APP_USER"
fi
# o usuário de desenvolvimento admin/admin impede o servidor de subir em produção
if as_app user list | grep -q "^admin "; then
  as_app user remove admin
fi

step "Serviços (systemd)"
cp "$APP_DIR"/deploy/project-accounting-{api,intel,reforma,backup}.service "$APP_DIR"/deploy/project-accounting-{intel,reforma,backup}.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable -q project-accounting-api project-accounting-intel.timer project-accounting-reforma.timer project-accounting-backup.timer
systemctl restart project-accounting-api
systemctl start project-accounting-intel.timer project-accounting-reforma.timer project-accounting-backup.timer
for _ in $(seq 1 20); do
  curl -fs "http://127.0.0.1:$API_PORT/healthz" >/dev/null && break
  sleep 1
done
curl -fs "http://127.0.0.1:$API_PORT/healthz" >/dev/null || fail "o backend não respondeu; veja: sudo journalctl -u project-accounting-api -n 40"

step "Nginx na porta $PUBLIC_PORT"
sed -e "s/__PUBLIC_PORT__/$PUBLIC_PORT/g" -e "s/__API_PORT__/$API_PORT/g" "$APP_DIR/deploy/nginx-ip.conf" > "$NGINX_SITE"
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/project-accounting-ip
nginx -t
systemctl enable -q nginx
if systemctl is-active --quiet nginx; then systemctl reload nginx; else systemctl start nginx; fi

step "Firewall da VPS (porta $PUBLIC_PORT)"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow "$PUBLIC_PORT/tcp"
fi
# imagens Ubuntu da Oracle Cloud trazem iptables com REJECT no fim da cadeia INPUT
if iptables -S INPUT 2>/dev/null | grep -q -- "-j REJECT" && ! iptables -S INPUT | grep -q -- "--dport $PUBLIC_PORT "; then
  REJECT_LINE=$(iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" {print $1; exit}')
  iptables -I INPUT "$REJECT_LINE" -m state --state NEW -p tcp --dport "$PUBLIC_PORT" -j ACCEPT
  command -v netfilter-persistent >/dev/null && netfilter-persistent save
fi

curl -fs "http://127.0.0.1:$PUBLIC_PORT/healthz" >/dev/null || fail "o Nginx não respondeu na porta $PUBLIC_PORT; veja: sudo journalctl -u nginx -n 40"
IP=$(curl -fs --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')
step "Pronto: http://$IP:$PUBLIC_PORT"
echo "Se não abrir de fora, libere a porta $PUBLIC_PORT (TCP) no firewall do provedor"
echo "(Oracle Cloud: VCN > Security List > Ingress Rule, origem 0.0.0.0/0, porta $PUBLIC_PORT)."
echo "Atualizações futuras: sudo bash $APP_DIR/deploy/vps-update.sh"
