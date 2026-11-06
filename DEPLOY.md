# Deploy em VPS

Guia para publicar o Project Accounting (Portal de Projetos + Inteligência Contábil) numa VPS Linux (Ubuntu 24.04 ou Debian 12) com Nginx e HTTPS.

**Arquitetura:** internet → Nginx (HTTPS, porta 443) → Node em `127.0.0.1:8080` (systemd) → banco SQLite em `/var/lib/project-accounting/app.db`.

Todos os dados (usuários, sessões, projetos e Inteligência Contábil) ficam **no banco único**. O `.env` guarda só a infraestrutura (porta, fuso, caminho do banco).

> Escolha uma **VPS no Brasil**: alguns sites oficiais podem recusar acessos de fora do país ou de datacenters. O passo 8 confirma isso.

---

## 1. Preparar o servidor

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git ufw
# Node.js 24 LTS (NodeSource) — o banco usa o node:sqlite, que exige Node 22.13 ou superior
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

Firewall: só SSH, HTTP e HTTPS.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Usuário dedicado (sem login) e pastas:

```bash
sudo useradd --system --home /opt/project-accounting --shell /usr/sbin/nologin project-accounting
sudo mkdir -p /opt/project-accounting /var/lib/project-accounting
sudo chown project-accounting:project-accounting /var/lib/project-accounting
sudo chmod 750 /var/lib/project-accounting
```

## 2. Instalar o código

```bash
sudo git clone https://github.com/FeliipeSantos/accounting.git /opt/project-accounting
cd /opt/project-accounting
sudo chown -R root:project-accounting /opt/project-accounting
```

O projeto não tem dependências npm: não é preciso `npm install`.

O repositório traz só o necessário para rodar. Os testes automáticos ficam na máquina de desenvolvimento: rode `npm test` lá **antes** de enviar cada atualização ao GitHub.

## 3. Configurar o `.env`

```bash
cd /opt/project-accounting
sudo cp .env.example .env
sudo chown root:project-accounting .env
sudo chmod 640 .env
```

Confira os valores (o modelo já vem pronto para esta arquitetura): `NODE_ENV=production`, `HOST=127.0.0.1`, `TZ=America/Sao_Paulo`, `TRUST_PROXY=true` e `DB_PATH=/var/lib/project-accounting/app.db`.

> Nos comandos abaixo, o padrão `sudo -u project-accounting node --env-file=.env ...` roda como o usuário do serviço, com o mesmo `.env` (o `npm` não é usado aqui porque esse usuário não tem pasta própria para o cache do npm).

## 4. Levar os dados para a VPS

### Opção A — copiar o banco do seu computador (recomendado)

No seu computador, na pasta do projeto, gere uma cópia consistente do banco:

```bash
npm run db:backup
```

O comando mostra o arquivo criado (ex.: `data/backups/app-2026-11-06_160000.db`). Envie-o para a VPS:

```bash
scp data/backups/app-AAAA-MM-DD_HHMMSS.db usuario@ip-da-vps:/tmp/app.db
```

Na VPS:

```bash
sudo mv /tmp/app.db /var/lib/project-accounting/app.db
sudo chown project-accounting:project-accounting /var/lib/project-accounting/app.db
sudo chmod 640 /var/lib/project-accounting/app.db
```

O banco do seu computador tem o usuário de desenvolvimento **admin/admin**. Em produção o servidor **se recusa a iniciar** enquanto ele existir. Crie o seu usuário e remova o `admin` (a senha é digitada no terminal, mínimo 10 caracteres):

```bash
cd /opt/project-accounting
sudo -u project-accounting node --env-file=.env lib/user-cli.js add seu.usuario
sudo -u project-accounting node --env-file=.env lib/user-cli.js remove admin
sudo -u project-accounting node --env-file=.env lib/user-cli.js list
```

### Opção B — instalação nova, sem dados

Basta criar o primeiro usuário antes de iniciar o serviço (o banco é criado automaticamente):

```bash
cd /opt/project-accounting
sudo -u project-accounting node --env-file=.env lib/user-cli.js add seu.usuario
```

## 5. Serviço (systemd)

```bash
sudo cp deploy/project-accounting.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now project-accounting
sudo systemctl status project-accounting
```

O log deve mostrar algo como:

```
Servidor rodando em http://localhost:8080 (escutando em 127.0.0.1)
[intelligence] agendamento ativo: diariamente às 06:00; próxima execução ...
[backup] cópia do banco criada: /var/lib/project-accounting/backups/app-....db
```

Mensagens que pedem ação:

| Mensagem | O que fazer |
|---|---|
| `Nenhum usuário no banco` | Crie um usuário (passo 4, opção B) |
| `O usuário de desenvolvimento admin/admin existe neste banco` | Crie o seu usuário e remova o `admin` (passo 4, opção A) |
| Aviso de **fuso horário** | Confira `TZ=America/Sao_Paulo` no `.env` |

Para acompanhar o log e testar:

```bash
sudo journalctl -u project-accounting -f
```

```bash
curl -s http://127.0.0.1:8080/healthz
```

## 6. Nginx + HTTPS

1. Aponte o DNS do domínio (registro A) para o IP da VPS.
2. Crie o snippet de proxy e a zona de limite de login, conforme comentários no fim de `deploy/nginx.conf`.
3. Copie o site (troque `seu-dominio.com.br` no arquivo) e, **antes do certificado**, comente o bloco `server { listen 443 ... }`:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/project-accounting
sudo ln -s /etc/nginx/sites-available/project-accounting /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo mkdir -p /var/www/certbot
sudo nginx -t && sudo systemctl reload nginx
```

4. Gere o certificado gratuito (Let's Encrypt) e reative o bloco 443:

```bash
sudo apt install -y certbot
sudo certbot certonly --webroot -w /var/www/certbot -d seu-dominio.com.br
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

A renovação é automática (timer do certbot). Teste com `sudo certbot renew --dry-run`.

5. Acesse `https://seu-dominio.com.br` e entre com o seu usuário.

> O cookie de sessão é `Secure` em produção: **o login só funciona por HTTPS**. Pelo IP em HTTP a tela de login aparece, mas a sessão não se mantém.

## 7. Usuários

```bash
cd /opt/project-accounting
sudo -u project-accounting node --env-file=.env lib/user-cli.js list
sudo -u project-accounting node --env-file=.env lib/user-cli.js add maria
sudo -u project-accounting node --env-file=.env lib/user-cli.js passwd maria
sudo -u project-accounting node --env-file=.env lib/user-cli.js remove maria
```

Trocar a senha ou remover um usuário encerra as sessões abertas dele na hora. Remover um usuário também remove os favoritos dele.

## 8. Confirmar as fontes oficiais a partir da VPS

```bash
cd /opt/project-accounting
sudo -u project-accounting node --env-file=.env intelligence/cli.js check
```

Esperado: `9 de 9 fontes acessíveis`. Se alguma falhar (ex.: bloqueio de IP), ela aparece com o erro; as demais continuam funcionando normalmente.

## 9. Backup e restauração

**Automático:** uma cópia consistente do banco por dia (feita mesmo com o sistema em uso) em `/var/lib/project-accounting/backups/`, guardando as últimas 7 (`BACKUP_KEEP`).

**Manual (antes de mudanças importantes):**

```bash
cd /opt/project-accounting
sudo -u project-accounting node --env-file=.env lib/backup.js
```

**Fora da VPS:** se a VPS for perdida, os backups dela vão junto. Copie-os periodicamente para outro lugar, por exemplo do seu computador:

```bash
scp "usuario@ip-da-vps:/var/lib/project-accounting/backups/*.db" ./backups-vps/
```

**Restaurar uma cópia:**

```bash
sudo systemctl stop project-accounting
cd /var/lib/project-accounting
sudo -u project-accounting cp app.db app.db.antes-da-restauracao
sudo -u project-accounting cp backups/app-AAAA-MM-DD_HHMMSS.db app.db
sudo rm -f app.db-wal app.db-shm
sudo systemctl start project-accounting
```

## 10. Atualizar a aplicação

Na máquina de desenvolvimento: rode `npm test` e envie ao GitHub (`git push`). Depois, na VPS:

```bash
cd /opt/project-accounting
sudo -u project-accounting node --env-file=.env lib/backup.js
sudo git pull
sudo systemctl restart project-accounting
curl -s http://127.0.0.1:8080/healthz
```

Alterações de estrutura do banco (migrations) são aplicadas automaticamente ao iniciar, cada uma por inteiro ou nenhuma. As sessões ficam no banco: os usuários **continuam logados** após a atualização. Se houver coleta em andamento, o serviço aguarda até 25 s para ela terminar.

## Referência: variáveis do `.env`

| Variável | Produção | Descrição |
|---|---|---|
| `NODE_ENV` | `production` | Exige usuário real no banco e cookie `Secure` |
| `HOST` | `127.0.0.1` | Só o Nginx acessa o Node |
| `PORT` | `8080` | Porta interna do Node |
| `TRUST_PROXY` | `true` | Usa o IP real (do Nginx) no limite de tentativas de login |
| `TZ` | `America/Sao_Paulo` | Fuso da coleta diária e do backup diário |
| `DB_PATH` | `/var/lib/project-accounting/app.db` | Banco único do sistema |
| `BACKUP_DIR` | (vazio) | Pasta dos backups (padrão: `backups/` ao lado do banco) |
| `BACKUP_KEEP` | `7` | Quantos backups diários manter |
| `BACKUP_SCHEDULER` | (vazio) | `off` desliga o backup diário automático |
| `SESSION_TTL_HOURS` | `8` | Sessão expira após esse tempo sem uso |
| `INTEL_SCHEDULER` | (vazio) | `off` desliga a coleta automática |
| `COOKIE_SECURE` | (vazio) | Só `false` para testar produção sem HTTPS |
