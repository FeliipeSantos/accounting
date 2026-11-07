# Troca para o backend Flask na VPS (etapa 4)

Guia para trocar o servidor Node pelo backend Flask numa VPS já instalada pelo `DEPLOY.md`. O banco é o mesmo: os dois servidores leem e gravam no mesmo formato. Por isso a volta para o Node é imediata, sem converter dados.

**Antes e depois:**

| | Node (hoje) | Flask (depois) |
|---|---|---|
| API | `project-accounting.service` (Node, porta 8080) | `project-accounting-api.service` (gunicorn, porta 8080) |
| Tela | servida pelo Node | servida pelo Nginx (só 4 arquivos) |
| Coleta diária | dentro do Node | `project-accounting-intel.timer` (verifica a cada 5 min) |
| Backup diário | dentro do Node | `project-accounting-backup.timer` (03:00) |

> Os arquivos de systemd, gunicorn e Nginx não puderam ser executados na máquina de desenvolvimento (Windows, sem Linux). Eles são testados pela primeira vez na VPS, por isso cada passo abaixo tem uma verificação.

---

## 1. Antes de começar

O código do backend precisa estar no GitHub: a pasta `backend/` (a `.venv` fica de fora pelo `.gitignore`), a pasta `deploy/` e este guia.

Na VPS, faça um backup com o servidor Node ainda no ar:

```bash
cd /opt/project-accounting
sudo -u project-accounting node --env-file=.env lib/backup.js
```

Anote o nome do arquivo criado (ex.: `/var/lib/project-accounting/backups/app-2026-11-07_090000.db`).

## 2. Atualizar o código e instalar o Python

```bash
cd /opt/project-accounting
sudo git pull
sudo apt install -y python3-venv
cd backend
sudo python3 -m venv .venv
sudo .venv/bin/pip install --upgrade pip
sudo .venv/bin/pip install -r requirements.txt
sudo chown -R root:project-accounting /opt/project-accounting/backend
```

## 3. Conferir o Flask antes da troca

O Node continua no ar. Estes comandos só **leem** o banco e as fontes oficiais. O `.env` da raiz é carregado automaticamente.

```bash
cd /opt/project-accounting/backend
sudo -u project-accounting .venv/bin/flask user list
sudo -u project-accounting .venv/bin/flask intel check
```

**Esperado:**
- **`user list`:** mostra os mesmos usuários do Node.
- **`intel check`:** termina com `9 de 9 fontes acessíveis`.

## 4. Instalar os serviços (ainda sem ligar)

```bash
cd /opt/project-accounting/deploy
sudo cp project-accounting-api.service project-accounting-intel.service project-accounting-intel.timer \
        project-accounting-backup.service project-accounting-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

## 5. Preparar o Nginx (ainda sem recarregar)

1. **Guarde a configuração atual**, para a volta:
   ```bash
   sudo cp /etc/nginx/sites-available/project-accounting /etc/nginx/sites-available/project-accounting.node
   ```
2. **Crie o snippet dos arquivos da tela**, com o conteúdo do item 3 no fim de `deploy/nginx-flask.conf`:
   ```bash
   sudo nano /etc/nginx/snippets/project-accounting-static.conf
   ```
3. **Acrescente o HSTS ao snippet do proxy:** inclua a última linha do item 2 no fim de `deploy/nginx-flask.conf` em `/etc/nginx/snippets/project-accounting-proxy.conf`. As outras linhas desse snippet não mudam.
4. **Instale a nova configuração do site.** Troque `seu-dominio.com.br` pelo seu domínio, nas 4 ocorrências:
   ```bash
   sudo cp deploy/nginx-flask.conf /etc/nginx/sites-available/project-accounting
   sudo nano /etc/nginx/sites-available/project-accounting
   sudo nginx -t
   ```
   O `nginx -t` precisa responder `syntax is ok` e `test is successful`. Ainda **não** recarregue.

## 6. Trocar

A troca leva poucos segundos:

```bash
sudo systemctl disable --now project-accounting
sudo systemctl enable --now project-accounting-api
curl -s http://127.0.0.1:8080/healthz
sudo systemctl reload nginx
sudo systemctl enable --now project-accounting-intel.timer project-accounting-backup.timer
```

O `curl` deve responder `{"status":"ok"}` **antes** do `reload` do Nginx. Se não responder, veja o log (passo 7) ou volte (passo 8).

## 7. Verificar

```bash
sudo systemctl status project-accounting-api
sudo journalctl -u project-accounting-api -n 30
systemctl list-timers | grep project-accounting
```

**Esperado:**
- **Status do serviço:** `active (running)`.
- **Log:** sem erros e com uma linha `Booting worker` do gunicorn.
- **Timers:** os dois aparecem, com o próximo disparo.

**No navegador** (`https://seu-dominio.com.br`):
- **Sessão:** quem estava logado continua logado, porque as sessões ficam no banco.
- **Portal de Projetos:** abra um projeto. Para testar alterações, use um projeto temporário e exclua-o depois.
- **Inteligência Contábil:**
  - percorra as abas;
  - abra uma publicação;
  - clique em "Atualizar agora": a coleta aparece no Histórico como "Manual".
- **Arquivos protegidos:** `https://seu-dominio.com.br/.env` e `/backend/wsgi.py` respondem **404**.

**Coleta automática:** no dia seguinte, depois do horário configurado (padrão 06:00), confira:

```bash
sudo journalctl -u project-accounting-intel -n 20
```

Deve aparecer `execução agendada iniciada` e o resumo das 9 fontes.

**Backup:** depois das 03:00, deve haver um arquivo novo:

```bash
ls -l /var/lib/project-accounting/backups/
```

## 8. Voltar para o Node (se algo der errado)

O banco continua compatível com o Node: projetos, publicações, favoritos e sessões gravados pelo Flask são lidos normalmente por ele.

```bash
sudo systemctl disable --now project-accounting-intel.timer project-accounting-backup.timer project-accounting-api
sudo cp /etc/nginx/sites-available/project-accounting.node /etc/nginx/sites-available/project-accounting
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl enable --now project-accounting
curl -s http://127.0.0.1:8080/healthz
```

Só se os dados tiverem sido danificados, restaure o backup do passo 1, seguindo a seção "Restaurar uma cópia" do `DEPLOY.md`.

## Comandos do dia a dia (com o Flask)

Rode na pasta `/opt/project-accounting/backend`:

| Tarefa | Comando |
|---|---|
| Usuários | `sudo -u project-accounting .venv/bin/flask user list` / `add <usuario>` / `passwd <usuario>` / `remove <usuario>` |
| Backup agora | `sudo -u project-accounting .venv/bin/flask db-backup` |
| Coleta agora | `sudo -u project-accounting .venv/bin/flask intel run` |
| Testar as fontes | `sudo -u project-accounting .venv/bin/flask intel check` |
| Log da API | `sudo journalctl -u project-accounting-api -f` |

**Atualizar a aplicação:**

```bash
cd /opt/project-accounting/backend
sudo -u project-accounting .venv/bin/flask db-backup
sudo git pull
sudo .venv/bin/pip install -r requirements.txt
sudo systemctl restart project-accounting-api
curl -s http://127.0.0.1:8080/healthz
```

Quando houver migrations do Alembic novas, aplique-as antes do `restart`:

```bash
cd backend
sudo -u project-accounting .venv/bin/flask db upgrade
```

O servidor nunca as aplica sozinho.

## Detalhes da configuração

- **Um processo do gunicorn com 8 threads** (`backend/gunicorn.conf.py`):
  - o limite de tentativas de login e o aviso de coleta em andamento ficam na memória do processo;
  - o SQLite aceita uma escrita por vez, então mais processos não trariam ganho.
- **Coleta em andamento ao parar:** ao parar ou reiniciar, o serviço espera até 25 s por uma coleta manual em andamento, como o Node fazia.
- **Coleta diária:** o `flask intel scheduled` só coleta quando está na hora. Se a VPS estava desligada no horário, recupera a coleta perdida, e repete falhas até 3 vezes no dia, com 1 hora entre elas.
- **Coleta automática desligada:** com `INTEL_SCHEDULER=off` no `.env`, o comando não coleta, mas o timer continua ativo.
