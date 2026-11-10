# Deploy em VPS

Guia para publicar o opencontabil (Portal de Projetos + Publicações) numa VPS Linux (Ubuntu 24.04 ou Debian 12) com Nginx e HTTPS.

**Arquitetura:**
- **Entrada:** internet → Nginx (HTTPS, porta 443).
- **Tela:** o Nginx entrega o build do React (`frontend/dist`).
- **API:** o Nginx repassa `/api` ao gunicorn em `127.0.0.1:8080`, que roda o backend Flask (`backend/`, serviço do systemd).
- **Banco:** SQLite em `/var/lib/opencontabil/app.db`.
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
sudo useradd --system --home /opt/opencontabil --shell /usr/sbin/nologin opencontabil
sudo mkdir -p /opt/opencontabil /var/lib/opencontabil
sudo chown opencontabil:opencontabil /var/lib/opencontabil
sudo chmod 750 /var/lib/opencontabil
```

## 2. Instalar o código

```bash
sudo git clone https://github.com/FeliipeSantos/opencontabil.git /opt/opencontabil
cd /opt/opencontabil

# backend (Python)
sudo python3 -m venv backend/.venv
sudo backend/.venv/bin/pip install --upgrade pip
sudo backend/.venv/bin/pip install -r backend/requirements.txt

# tela (React): gera frontend/dist
cd frontend
sudo npm ci
sudo npm run build
cd ..

sudo chown -R root:opencontabil /opt/opencontabil
```

O repositório traz só o necessário para rodar. Os testes automáticos ficam na máquina de desenvolvimento.

## 3. Configurar o `.env`

```bash
cd /opt/opencontabil
sudo cp .env.example .env
sudo chown root:opencontabil .env
sudo chmod 640 .env
```

Confira os valores (o modelo já vem pronto para esta arquitetura): `APP_ENV=production`, `HOST=127.0.0.1`, `TZ=America/Sao_Paulo`, `TRUST_PROXY=true` e `DB_PATH=/var/lib/opencontabil/app.db`.

> Nos comandos abaixo, o padrão `sudo -u opencontabil .venv/bin/flask ...`, rodado na pasta `backend`, executa o comando como o usuário do serviço. O `.env` da raiz é lido automaticamente.

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
sudo mv /tmp/app.db /var/lib/opencontabil/app.db
sudo chown opencontabil:opencontabil /var/lib/opencontabil/app.db
sudo chmod 640 /var/lib/opencontabil/app.db
```

O banco do seu computador tem o usuário de desenvolvimento **admin/admin**. Em produção, o servidor **se recusa a iniciar** enquanto ele existir. Crie o seu usuário e remova o `admin` (a senha é digitada no terminal, mínimo 10 caracteres):

```bash
cd /opt/opencontabil/backend
sudo -u opencontabil .venv/bin/flask user add seu@email.com.br
sudo -u opencontabil .venv/bin/flask user remove admin
sudo -u opencontabil .venv/bin/flask user list
```

### Opção B: instalação nova, sem dados

As tabelas são criadas pelas migrations do Alembic, que a equipe gera e aplica manualmente. O servidor nunca as aplica sozinho.

- **Migrations:** ficam em `backend/migrations/` (a baseline e as seguintes).
- **Comandos:**

```bash
cd /opt/opencontabil/backend
sudo -u opencontabil .venv/bin/flask db upgrade
sudo -u opencontabil .venv/bin/flask user add seu@email.com.br
```

## 5. Serviços (systemd)

```bash
cd /opt/opencontabil/deploy
sudo cp opencontabil-api.service \
        opencontabil-intel.service opencontabil-intel.timer \
        opencontabil-reforma.service opencontabil-reforma.timer \
        opencontabil-backup.service opencontabil-backup.timer \
        /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now opencontabil-api
sudo systemctl enable --now opencontabil-intel.timer opencontabil-reforma.timer opencontabil-backup.timer
```

| Unidade | Função |
|---|---|
| `opencontabil-api` | Backend (gunicorn: 1 processo, 8 threads) |
| `opencontabil-intel.timer` | A cada 5 min, verifica se a coleta diária está na hora. Recupera coleta perdida e repete falhas até 3 vezes no dia |
| `opencontabil-reforma.timer` | A cada 5 min, verifica se a sincronização diária do Calendário está na hora (`REFORMA_RUN_TIME`, padrão 07:00). Mesmas regras de recuperação e nova tentativa |
| `opencontabil-backup.timer` | Cópia do banco às 03:00, ou ao ligar a VPS se ela estava desligada nesse horário |

Verifique:

```bash
sudo systemctl status opencontabil-api
curl -s http://127.0.0.1:8080/healthz
systemctl list-timers | grep opencontabil
```

Mensagens que pedem ação (no log: `sudo journalctl -u opencontabil-api -n 30`):

| Mensagem | O que fazer |
|---|---|
| `não tem as tabelas do sistema` | Banco sem tabelas: use a opção A ou B do passo 4 |
| `Nenhum usuário no banco` | Crie um usuário (passo 4) |
| `O usuário de desenvolvimento admin/admin existe neste banco` | Crie o seu usuário e remova o `admin` (passo 4, opção A) |
| Aviso de **fuso horário** | Confira `TZ=America/Sao_Paulo` no `.env` |

## 6. Nginx + HTTPS

1. Aponte o DNS do domínio (registro A) para o IP da VPS.
2. Crie a zona de limite de login e os dois snippets (`opencontabil-proxy.conf` e `opencontabil-security.conf`), conforme os comentários no fim de `deploy/nginx.conf`.
3. Copie o site, troque `seu-dominio.com.br` no arquivo e, **antes do certificado**, comente o bloco `server { listen 443 ... }`:

```bash
sudo cp /opt/opencontabil/deploy/nginx.conf /etc/nginx/sites-available/opencontabil
sudo ln -s /etc/nginx/sites-available/opencontabil /etc/nginx/sites-enabled/
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
cd /opt/opencontabil/backend
sudo -u opencontabil .venv/bin/flask user list
sudo -u opencontabil .venv/bin/flask user add maria@exemplo.com
sudo -u opencontabil .venv/bin/flask user passwd maria@exemplo.com
sudo -u opencontabil .venv/bin/flask user rename maria@exemplo.com maria.souza@exemplo.com
sudo -u opencontabil .venv/bin/flask user remove maria@exemplo.com
```

Trocar a senha ou remover um usuário encerra as sessões abertas dele na hora. Remover um usuário também remove os favoritos dele. Trocar o nome (`rename`) mantém sessões, favoritos e registros, que passam para o novo nome. O login é o e-mail da pessoa (use letras minúsculas). Cada usuário também pode trocar o próprio nome, e-mail e senha na tela, em **Meu perfil** (menu do usuário).

## 8. Confirmar as fontes oficiais a partir da VPS

```bash
cd /opt/opencontabil/backend
sudo -u opencontabil .venv/bin/flask intel check
```

Esperado: `12 de 12 fontes acessíveis`. Se alguma falhar (ex.: bloqueio de IP), ela aparece com o erro; as demais continuam funcionando normalmente.

Coleta manual pelo terminal: `sudo -u opencontabil .venv/bin/flask intel run`. Depois do horário configurado (padrão 06:00), confira a coleta automática:

```bash
sudo journalctl -u opencontabil-intel -n 20
```

## 9. Backup e restauração

**Automático:** uma cópia consistente do banco por dia (feita mesmo com o sistema em uso) em `/var/lib/opencontabil/backups/`, guardando as últimas 7 (`BACKUP_KEEP`).

**Manual (antes de mudanças importantes):**

```bash
cd /opt/opencontabil/backend
sudo -u opencontabil .venv/bin/flask db-backup
```

**Fora da VPS:** se a VPS for perdida, os backups dela vão junto. Copie-os periodicamente para outro lugar, por exemplo do seu computador:

```bash
scp "usuario@ip-da-vps:/var/lib/opencontabil/backups/*.db" ./backups-vps/
```

**Restaurar uma cópia:**

```bash
sudo systemctl stop opencontabil-api
cd /var/lib/opencontabil
sudo -u opencontabil cp app.db app.db.antes-da-restauracao
sudo -u opencontabil cp backups/app-AAAA-MM-DD_HHMMSS.db app.db
sudo rm -f app.db-wal app.db-shm
sudo systemctl start opencontabil-api
```

## 10. Atualizar a aplicação

```bash
cd /opt/opencontabil/backend
sudo -u opencontabil .venv/bin/flask db-backup
cd ..
sudo git pull
sudo backend/.venv/bin/pip install -r backend/requirements.txt
cd frontend && sudo npm ci && sudo npm run build && cd ..
sudo chown -R root:opencontabil /opt/opencontabil
sudo systemctl restart opencontabil-api
curl -s http://127.0.0.1:8080/healthz
```

**Migrations novas do Alembic:** se houver, aplique-as antes do `restart`, sempre manualmente:

```bash
cd /opt/opencontabil/backend
sudo -u opencontabil .venv/bin/flask db upgrade
```

**Ao reiniciar:**
- **Sessões:** ficam no banco, então os usuários **continuam logados**.
- **Coleta em andamento:** o serviço espera até 25 s para ela terminar.

## Instalação por IP e porta (sem domínio)

Para acessar por `http://IP-da-VPS:8082`, sem domínio, numa VPS que já roda outros sistemas.

**O que o script faz:**
- **Código:** baixa do GitHub para `/opt/opencontabil`.
- **Tela:** gera o build com um Node.js 24 próprio, em `/opt/opencontabil/.tools/node` (ignorado pelo git), sem trocar o Node do sistema.
- **Backend:** sobe só em `127.0.0.1:8090`; o Nginx atende na porta 8082 e repassa `/api`.
- **Isolamento:** não mexe em outras portas, outros sites do Nginx nem no Node do sistema. Se o Nginx não estava instalado, ele não é ligado na porta 80.
- **Firewall da VPS:** libera a porta 8082 no `ufw` (se ativo) e no `iptables` das imagens da Oracle Cloud.

> **Sem HTTPS**, o login e os dados trafegam sem criptografia, e o `.env` usa `COOKIE_SECURE=false`. Quando houver um domínio, passe para HTTPS como em [Passar para domínio com HTTPS](#passar-para-domínio-com-https).

**1. No seu computador, gere o pacote de dados** (banco e PDFs do Calendário). Na pasta `backend`:

```bash
.venv\Scripts\flask db-backup        # Linux/macOS: .venv/bin/flask db-backup
```

Copie o arquivo criado para uma pasta vazia com o nome `app.db`, junto com a pasta `data/reforma-files`, e compacte as duas (`tar -czf opencontabil-dados.tar.gz app.db reforma-files`). Envie para a VPS:

```bash
scp opencontabil-dados.tar.gz ubuntu@IP-da-VPS:/tmp/
```

**2. Na VPS, baixe o código e rode a instalação:**

```bash
sudo apt-get install -y git
sudo git clone https://github.com/FeliipeSantos/opencontabil.git /opt/opencontabil
sudo bash /opt/opencontabil/deploy/vps-install.sh /tmp/opencontabil-dados.tar.gz
```

O script pergunta o seu e-mail de login e a senha (mínimo 10 caracteres), remove o `admin/admin` do banco copiado e mostra o endereço no fim. Sem o arquivo de dados, o banco começa vazio.

**3. Libere a porta 8082 no firewall do provedor.** Na Oracle Cloud: *VCN > Security Lists > Add Ingress Rule*, origem `0.0.0.0/0`, protocolo TCP, porta `8082`.

**Atualizar** com o que estiver no GitHub (backup, código, tela, migrations e reinício):

```bash
sudo bash /opt/opencontabil/deploy/vps-update.sh
```

Outras portas: `sudo PUBLIC_PORT=8083 API_PORT=8091 bash .../vps-install.sh`.

### Passar para domínio com HTTPS

Com um domínio apontando para a VPS (registro A), a mesma instalação passa a atender por `https://seu-dominio`, nas portas 80 e 443. O `vps-update.sh` decide pelo `.env`: com `PUBLIC_DOMAIN`, grava o site do Nginx a partir do `deploy/nginx-domain.conf` (HTTPS, com HSTS); sem ele, continua no `deploy/nginx-ip.conf`. Assim as atualizações não desfazem o HTTPS.

1. Libere as portas 80 e 443 no firewall do provedor (na Oracle Cloud, como no passo 3).
2. Instale o certbot e informe o domínio no `.env`:

   ```bash
   sudo apt-get install -y certbot
   echo 'PUBLIC_DOMAIN=seu-dominio.com.br' | sudo tee -a /opt/opencontabil/.env
   ```

3. Rode a atualização. Sem certificado, ela grava só a porta 80 e para, mostrando o comando do certbot:

   ```bash
   sudo bash /opt/opencontabil/deploy/vps-update.sh
   sudo certbot certonly --webroot -w /var/www/certbot -d seu-dominio.com.br
   ```

4. Rode a atualização de novo. Agora ela grava o HTTPS, desliga o `COOKIE_SECURE=false` do `.env` e reinicia:

   ```bash
   sudo bash /opt/opencontabil/deploy/vps-update.sh
   ```

5. Quando `https://seu-dominio.com.br` estiver funcionando, feche a porta 8082 no firewall do provedor: o site do Nginx deixa de usá-la.

Se o certificado já foi gerado antes com `certbot --nginx`, pule o passo 3: o certificado continua em `/etc/letsencrypt/live/seu-dominio.com.br/` e a renovação automática segue funcionando.

## Troca de nome para opencontabil

O sistema se chamava **project-accounting**. Uma VPS instalada com esse nome (pasta `/opt/project-accounting`, serviços `project-accounting-*`) passa para os nomes novos uma única vez, com o `deploy/vps-rename.sh`:

| Antes | Depois |
|---|---|
| `/opt/project-accounting` | `/opt/opencontabil` |
| `/var/lib/project-accounting` (banco, PDFs e backups) | `/var/lib/opencontabil` |
| usuário e grupo `project-accounting` | `opencontabil` (mesmo UID: os arquivos continuam dele) |
| serviços e timers `project-accounting-*` | `opencontabil-*` |
| site do Nginx `project-accounting-ip` | `opencontabil-ip` (mesma porta) |
| repositório `FeliipeSantos/accounting` | `FeliipeSantos/opencontabil` |

1. **No GitHub**, renomeie o repositório para `opencontabil` (Settings > General > Repository name). O endereço antigo continua redirecionando para o novo.
2. **Na VPS**, baixe a versão com a migração e rode-a:
   ```bash
   sudo git -C /opt/project-accounting pull
   sudo bash /opt/project-accounting/deploy/vps-rename.sh
   ```
   O script faz uma cópia do banco, para os serviços antigos, renomeia usuário e pastas, ajusta os caminhos do `.env`, aponta o repositório para o endereço novo, recria o ambiente Python (que guarda o caminho da pasta) e termina rodando o `vps-update.sh`, que instala os serviços e o site do Nginx com os nomes novos. O sistema fica fora do ar por alguns minutos.
3. **Depois**, as atualizações seguem pelo caminho novo: `sudo bash /opt/opencontabil/deploy/vps-update.sh`.

Rodar de novo não faz nada: o script avisa que a troca já foi feita.

## Vindo da versão Node

Para uma VPS que ainda roda a versão anterior em Node (`project-accounting.service` rodando `node server.js`, tudo com o nome antigo `project-accounting`). O banco é o mesmo, e os dados não mudam de formato.

1. **Migre para o Flask com o código anterior à troca de nome**, que ainda usa os nomes `project-accounting`: em `/opt/project-accounting`, rode `sudo git checkout 07d862a` e siga a seção "Vindo da versão Node" do `DEPLOY.md` dessa versão (backup, `.env`, troca das unidades, Nginx e Alembic, com o caminho de volta para o Node).
2. **Depois, troque o nome para opencontabil:** volte para a versão atual (`sudo git checkout main && sudo git pull`) e siga [Troca de nome para opencontabil](#troca-de-nome-para-opencontabil).

## Referência: variáveis do `.env`

| Variável | Produção | Descrição |
|---|---|---|
| `APP_ENV` | `production` | Exige usuário real no banco e cookie `Secure` (`NODE_ENV` ainda é aceito) |
| `HOST` | `127.0.0.1` | Só o Nginx acessa o backend |
| `PORT` | `8080` | Porta interna do backend |
| `TRUST_PROXY` | `true` | Usa o IP real (do Nginx) no limite de tentativas de login |
| `TZ` | `America/Sao_Paulo` | Fuso da coleta diária |
| `DB_PATH` | `/var/lib/opencontabil/app.db` | Banco único do sistema |
| `BACKUP_DIR` | (vazio) | Pasta dos backups (padrão: `backups/` ao lado do banco) |
| `BACKUP_KEEP` | `7` | Quantos backups manter |
| `SESSION_TTL_HOURS` | `8` | Sessão expira após esse tempo sem uso |
| `INTEL_SCHEDULER` | (vazio) | `off` desliga a coleta automática |
| `COOKIE_SECURE` | (vazio) | Só `false` para testar produção sem HTTPS |
| `PUBLIC_DOMAIN` | (vazio) | Só na instalação por script: com um domínio, o `vps-update.sh` configura o Nginx com HTTPS |
