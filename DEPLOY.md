# Deploy em VPS

Guia para publicar o Project Accounting (Portal de Projetos + Publicações) numa VPS Linux (Ubuntu 24.04 ou Debian 12) com Nginx e HTTPS.

**Arquitetura:**
- **Entrada:** internet → Nginx (HTTPS, porta 443).
- **Tela:** o Nginx entrega o build do React (`frontend/dist`).
- **API:** o Nginx repassa `/api` ao gunicorn em `127.0.0.1:8080`, que roda o backend Flask (`backend/`, serviço do systemd).
- **Banco:** SQLite em `/var/lib/project-accounting/app.db`.
- **Tarefas diárias:** a coleta do módulo Publicações e o backup do banco rodam por timers do systemd.

Todos os dados (usuários, sessões, projetos e Publicações) ficam **no banco único**. O `.env` guarda só a infraestrutura (porta, fuso, caminho do banco).

> **Sem domínio, pelo IP e uma porta (ex.: `http://IP:8082`), ao lado de outros sistemas?** Use a [instalação por IP e porta](#instalação-por-ip-e-porta-sem-domínio), que é automática. O restante deste guia é a instalação com domínio e HTTPS.

> Escolha uma **VPS no Brasil**: alguns sites oficiais podem recusar acessos de fora do país ou de datacenters. O passo 8 confirma isso.

> Já tem a versão antiga (servidor Node) instalada na VPS? Siga a seção [Vindo da versão Node](#vindo-da-versão-node) no fim deste guia.

---

## 1. Preparar o servidor

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git ufw python3-venv
# Node.js 24 LTS (NodeSource): usado só para gerar a tela (npm run build)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
python3 --version   # 3.12 ou superior
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

# backend (Python)
sudo python3 -m venv backend/.venv
sudo backend/.venv/bin/pip install --upgrade pip
sudo backend/.venv/bin/pip install -r backend/requirements.txt

# tela (React): gera frontend/dist
cd frontend
sudo npm ci
sudo npm run build
cd ..

sudo chown -R root:project-accounting /opt/project-accounting
```

O repositório traz só o necessário para rodar. Os testes automáticos ficam na máquina de desenvolvimento.

## 3. Configurar o `.env`

```bash
cd /opt/project-accounting
sudo cp .env.example .env
sudo chown root:project-accounting .env
sudo chmod 640 .env
```

Confira os valores (o modelo já vem pronto para esta arquitetura): `APP_ENV=production`, `HOST=127.0.0.1`, `TZ=America/Sao_Paulo`, `TRUST_PROXY=true` e `DB_PATH=/var/lib/project-accounting/app.db`.

> Nos comandos abaixo, o padrão `sudo -u project-accounting .venv/bin/flask ...`, rodado na pasta `backend`, executa o comando como o usuário do serviço. O `.env` da raiz é lido automaticamente.

## 4. Levar os dados para a VPS

### Opção A: copiar o banco do seu computador (recomendado)

No seu computador, na pasta `backend` do projeto, gere uma cópia consistente do banco:

```bash
.venv\Scripts\flask db-backup        # Linux/macOS: .venv/bin/flask db-backup
```

O comando mostra o arquivo criado (ex.: `data/backups/app-2026-11-07_160000.db`). Envie-o para a VPS:

```bash
scp data/backups/app-AAAA-MM-DD_HHMMSS.db usuario@ip-da-vps:/tmp/app.db
```

Na VPS:

```bash
sudo mv /tmp/app.db /var/lib/project-accounting/app.db
sudo chown project-accounting:project-accounting /var/lib/project-accounting/app.db
sudo chmod 640 /var/lib/project-accounting/app.db
```

O banco do seu computador tem o usuário de desenvolvimento **admin/admin**. Em produção, o servidor **se recusa a iniciar** enquanto ele existir. Crie o seu usuário e remova o `admin` (a senha é digitada no terminal, mínimo 10 caracteres):

```bash
cd /opt/project-accounting/backend
sudo -u project-accounting .venv/bin/flask user add seu.usuario
sudo -u project-accounting .venv/bin/flask user remove admin
sudo -u project-accounting .venv/bin/flask user list
```

### Opção B: instalação nova, sem dados

As tabelas são criadas pelas migrations do Alembic, que a equipe gera e aplica manualmente. O servidor nunca as aplica sozinho.

- **Migrations:** ficam em `backend/migrations/` (a baseline e as seguintes).
- **Comandos:**

```bash
cd /opt/project-accounting/backend
sudo -u project-accounting .venv/bin/flask db upgrade
sudo -u project-accounting .venv/bin/flask user add seu.usuario
```

## 5. Serviços (systemd)

```bash
cd /opt/project-accounting/deploy
sudo cp project-accounting-api.service \
        project-accounting-intel.service project-accounting-intel.timer \
        project-accounting-reforma.service project-accounting-reforma.timer \
        project-accounting-backup.service project-accounting-backup.timer \
        /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now project-accounting-api
sudo systemctl enable --now project-accounting-intel.timer project-accounting-reforma.timer project-accounting-backup.timer
```

| Unidade | Função |
|---|---|
| `project-accounting-api` | Backend (gunicorn: 1 processo, 8 threads) |
| `project-accounting-intel.timer` | A cada 5 min, verifica se a coleta diária está na hora. Recupera coleta perdida e repete falhas até 3 vezes no dia |
| `project-accounting-reforma.timer` | A cada 5 min, verifica se a sincronização diária do Calendário está na hora (`REFORMA_RUN_TIME`, padrão 07:00). Mesmas regras de recuperação e nova tentativa |
| `project-accounting-backup.timer` | Cópia do banco às 03:00, ou ao ligar a VPS se ela estava desligada nesse horário |

Verifique:

```bash
sudo systemctl status project-accounting-api
curl -s http://127.0.0.1:8080/healthz
systemctl list-timers | grep project-accounting
```

Mensagens que pedem ação (no log: `sudo journalctl -u project-accounting-api -n 30`):

| Mensagem | O que fazer |
|---|---|
| `não tem as tabelas do sistema` | Banco sem tabelas: use a opção A ou B do passo 4 |
| `Nenhum usuário no banco` | Crie um usuário (passo 4) |
| `O usuário de desenvolvimento admin/admin existe neste banco` | Crie o seu usuário e remova o `admin` (passo 4, opção A) |
| Aviso de **fuso horário** | Confira `TZ=America/Sao_Paulo` no `.env` |

## 6. Nginx + HTTPS

1. Aponte o DNS do domínio (registro A) para o IP da VPS.
2. Crie a zona de limite de login e os dois snippets (`project-accounting-proxy.conf` e `project-accounting-security.conf`), conforme os comentários no fim de `deploy/nginx.conf`.
3. Copie o site, troque `seu-dominio.com.br` no arquivo e, **antes do certificado**, comente o bloco `server { listen 443 ... }`:

```bash
sudo cp /opt/project-accounting/deploy/nginx.conf /etc/nginx/sites-available/project-accounting
sudo ln -s /etc/nginx/sites-available/project-accounting /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo mkdir -p /var/www/certbot
sudo nginx -t && sudo systemctl reload nginx
```

4. Gere o certificado gratuito (Let's Encrypt) e reative o bloco 443:

```bash
sudo apt install -y certbot
sudo certbot certonly --webroot -w /var/www/certbot -d seu-dominio.com.br
sudo nginx -t && sudo systemctl reload nginx
```

A renovação é automática (timer do certbot). Teste com `sudo certbot renew --dry-run`.

5. Acesse `https://seu-dominio.com.br` e entre com o seu usuário.

> O cookie de sessão é `Secure` em produção: **o login só funciona por HTTPS**.

O Nginx entrega só a tela (`index.html` e `assets/`) e a API. Qualquer outro caminho, como `/.env` ou `/backend/wsgi.py`, responde 404.

## 7. Usuários

```bash
cd /opt/project-accounting/backend
sudo -u project-accounting .venv/bin/flask user list
sudo -u project-accounting .venv/bin/flask user add maria
sudo -u project-accounting .venv/bin/flask user passwd maria
sudo -u project-accounting .venv/bin/flask user remove maria
```

Trocar a senha ou remover um usuário encerra as sessões abertas dele na hora. Remover um usuário também remove os favoritos dele.

## 8. Confirmar as fontes oficiais a partir da VPS

```bash
cd /opt/project-accounting/backend
sudo -u project-accounting .venv/bin/flask intel check
```

Esperado: `12 de 12 fontes acessíveis`. Se alguma falhar (ex.: bloqueio de IP), ela aparece com o erro; as demais continuam funcionando normalmente.

Coleta manual pelo terminal: `sudo -u project-accounting .venv/bin/flask intel run`. Depois do horário configurado (padrão 06:00), confira a coleta automática:

```bash
sudo journalctl -u project-accounting-intel -n 20
```

## 9. Backup e restauração

**Automático:** uma cópia consistente do banco por dia (feita mesmo com o sistema em uso) em `/var/lib/project-accounting/backups/`, guardando as últimas 7 (`BACKUP_KEEP`).

**Manual (antes de mudanças importantes):**

```bash
cd /opt/project-accounting/backend
sudo -u project-accounting .venv/bin/flask db-backup
```

**Fora da VPS:** se a VPS for perdida, os backups dela vão junto. Copie-os periodicamente para outro lugar, por exemplo do seu computador:

```bash
scp "usuario@ip-da-vps:/var/lib/project-accounting/backups/*.db" ./backups-vps/
```

**Restaurar uma cópia:**

```bash
sudo systemctl stop project-accounting-api
cd /var/lib/project-accounting
sudo -u project-accounting cp app.db app.db.antes-da-restauracao
sudo -u project-accounting cp backups/app-AAAA-MM-DD_HHMMSS.db app.db
sudo rm -f app.db-wal app.db-shm
sudo systemctl start project-accounting-api
```

## 10. Atualizar a aplicação

```bash
cd /opt/project-accounting/backend
sudo -u project-accounting .venv/bin/flask db-backup
cd ..
sudo git pull
sudo backend/.venv/bin/pip install -r backend/requirements.txt
cd frontend && sudo npm ci && sudo npm run build && cd ..
sudo chown -R root:project-accounting /opt/project-accounting
sudo systemctl restart project-accounting-api
curl -s http://127.0.0.1:8080/healthz
```

**Migrations novas do Alembic:** se houver, aplique-as antes do `restart`, sempre manualmente:

```bash
cd /opt/project-accounting/backend
sudo -u project-accounting .venv/bin/flask db upgrade
```

**Ao reiniciar:**
- **Sessões:** ficam no banco, então os usuários **continuam logados**.
- **Coleta em andamento:** o serviço espera até 25 s para ela terminar.

## Instalação por IP e porta (sem domínio)

Para acessar por `http://IP-da-VPS:8082`, sem domínio, numa VPS que já roda outros sistemas.

**O que o script faz:**
- **Código:** baixa do GitHub para `/opt/project-accounting`.
- **Tela:** gera o build com um Node.js 24 próprio, em `/opt/project-accounting-node`, sem trocar o Node do sistema.
- **Backend:** sobe só em `127.0.0.1:8090`; o Nginx atende na porta 8082 e repassa `/api`.
- **Isolamento:** não mexe em outras portas, outros sites do Nginx nem no Node do sistema. Se o Nginx não estava instalado, ele não é ligado na porta 80.
- **Firewall da VPS:** libera a porta 8082 no `ufw` (se ativo) e no `iptables` das imagens da Oracle Cloud.

> **Sem HTTPS**, o login e os dados trafegam sem criptografia, e o `.env` usa `COOKIE_SECURE=false`. Quando houver um domínio, passe para o Nginx com HTTPS (passo 6).

**1. No seu computador, gere o pacote de dados** (banco e PDFs do Calendário). Na pasta `backend`:

```bash
.venv\Scripts\flask db-backup        # Linux/macOS: .venv/bin/flask db-backup
```

Copie o arquivo criado para uma pasta vazia com o nome `app.db`, junto com a pasta `data/reforma-files`, e compacte as duas (`tar -czf project-accounting-dados.tar.gz app.db reforma-files`). Envie para a VPS:

```bash
scp project-accounting-dados.tar.gz ubuntu@IP-da-VPS:/tmp/
```

**2. Na VPS, baixe o código e rode a instalação:**

```bash
sudo apt-get install -y git
sudo git clone https://github.com/FeliipeSantos/accounting.git /opt/project-accounting
sudo bash /opt/project-accounting/deploy/vps-install.sh /tmp/project-accounting-dados.tar.gz
```

O script pergunta o seu nome de usuário e a senha (mínimo 10 caracteres), remove o `admin/admin` do banco copiado e mostra o endereço no fim. Sem o arquivo de dados, o banco começa vazio.

**3. Libere a porta 8082 no firewall do provedor.** Na Oracle Cloud: *VCN > Security Lists > Add Ingress Rule*, origem `0.0.0.0/0`, protocolo TCP, porta `8082`.

**Atualizar** com o que estiver no GitHub (backup, código, tela, migrations e reinício):

```bash
sudo bash /opt/project-accounting/deploy/vps-update.sh
```

Outras portas: `sudo PUBLIC_PORT=8083 API_PORT=8091 bash .../vps-install.sh`.

## Vindo da versão Node

Para uma VPS instalada com a versão anterior (`project-accounting.service` rodando `node server.js`). O banco é o mesmo, e os dados não mudam de formato.

1. **Backup, ainda com o código antigo:**
   ```bash
   cd /opt/project-accounting
   sudo -u project-accounting node --env-file=.env lib/backup.js
   git rev-parse --short HEAD    # anote a versão atual, para a volta
   ```
2. **Código novo:** `sudo git pull` e depois o passo 2 a partir de "backend (Python)".
3. **`.env`:** troque `NODE_ENV` por `APP_ENV`. O nome antigo continua aceito, mas o novo é o padrão. As outras variáveis continuam iguais.
4. **Conferir antes da troca:** com o Node ainda no ar, estes comandos só leem. O `user list` deve mostrar os mesmos usuários, e o `intel check` deve indicar 9 de 9.
   ```bash
   cd backend
   sudo -u project-accounting .venv/bin/flask user list
   sudo -u project-accounting .venv/bin/flask intel check
   ```
5. **Nginx:** guarde a configuração atual (`sudo cp /etc/nginx/sites-available/project-accounting /etc/nginx/sites-available/project-accounting.node`), crie o snippet `project-accounting-security.conf`, acrescente a linha do HSTS ao snippet do proxy e instale o novo `deploy/nginx.conf` (passo 6). Rode `sudo nginx -t`, mas **ainda não recarregue**.
6. **Trocar:** copie as unidades do passo 5 e depois rode:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl disable --now project-accounting
   sudo systemctl enable --now project-accounting-api
   curl -s http://127.0.0.1:8080/healthz
   sudo systemctl reload nginx
   sudo systemctl enable --now project-accounting-intel.timer project-accounting-backup.timer
   ```
   A coleta diária e o backup, que antes rodavam dentro do Node, passam para os timers.
7. **Alembic:** marque a baseline como aplicada neste banco, que já tem as tabelas, e aplique as migrations seguintes. Use a revisão da baseline, **não** `head`: `head` marcaria como aplicadas também as migrations novas, sem criar as tabelas delas.
   ```bash
   sudo -u project-accounting .venv/bin/flask db stamp a92784c200a9
   sudo -u project-accounting .venv/bin/flask db upgrade
   sudo -u project-accounting .venv/bin/flask intel fulltext
   ```
   O último comando busca o texto completo das publicações já guardadas (leva alguns minutos; falhas do site do DOU são refeitas na coleta seguinte).

**Voltar para o Node, se algo der errado:**

```bash
sudo systemctl disable --now project-accounting-api project-accounting-intel.timer project-accounting-backup.timer
cd /opt/project-accounting && sudo git checkout <versão anotada no passo 1>
sudo cp /etc/nginx/sites-available/project-accounting.node /etc/nginx/sites-available/project-accounting
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl enable --now project-accounting
```

O banco continua compatível com o Node: projetos, publicações, favoritos e sessões gravados pelo Flask são lidos normalmente por ele.

## Referência: variáveis do `.env`

| Variável | Produção | Descrição |
|---|---|---|
| `APP_ENV` | `production` | Exige usuário real no banco e cookie `Secure` (`NODE_ENV` ainda é aceito) |
| `HOST` | `127.0.0.1` | Só o Nginx acessa o backend |
| `PORT` | `8080` | Porta interna do backend |
| `TRUST_PROXY` | `true` | Usa o IP real (do Nginx) no limite de tentativas de login |
| `TZ` | `America/Sao_Paulo` | Fuso da coleta diária |
| `DB_PATH` | `/var/lib/project-accounting/app.db` | Banco único do sistema |
| `BACKUP_DIR` | (vazio) | Pasta dos backups (padrão: `backups/` ao lado do banco) |
| `BACKUP_KEEP` | `7` | Quantos backups manter |
| `SESSION_TTL_HOURS` | `8` | Sessão expira após esse tempo sem uso |
| `INTEL_SCHEDULER` | (vazio) | `off` desliga a coleta automática |
| `COOKIE_SECURE` | (vazio) | Só `false` para testar produção sem HTTPS |
