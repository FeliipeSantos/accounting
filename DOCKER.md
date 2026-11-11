# opencontabil em Docker

Alternativa à instalação direta na VPS (DEPLOY.md). Precisa do Docker com o Compose v2.24 ou mais novo (`docker compose version`).

## Como fica

| Container | O que faz | Porta |
|---|---|---|
| `web` | Nginx com a tela (build do React); repassa `/api` e `/healthz` à `api` | `HTTP_PORT` da máquina (padrão `8080`) → 80 |
| `api` | Backend Flask com gunicorn | só na rede interna (8080) |
| `scheduler` | Faz o papel dos timers do systemd: coleta do Publicações e sincronização do Calendário (verificadas a cada 5 minutos, rodam no horário configurado) e cópia diária do banco às 03:00 | — |

- **Dados:** tudo fica no volume `opencontabil_data`, montado em `/data`: banco (`app.db`), cópias (`backups/`) e PDFs do Calendário (`reforma-files/`). Recriar ou atualizar os containers não apaga o volume.
- **Migrations:** a `api` e o `scheduler` rodam `flask db upgrade` antes de começar, então o banco sempre acompanha o código.
- **Fuso:** a imagem já usa `America/Sao_Paulo` (coletas e cópia do banco na hora de Brasília).
- **Segurança:** a `api` roda como usuário sem privilégios e não é publicada; só o `web` recebe conexões.

## 1. Configuração

Na pasta do projeto:

```bash
cp .env.docker.example .env.docker
```

Ajuste o `.env.docker` (o arquivo explica cada linha). O principal:

- **`COOKIE_SECURE=false`:** só se for acessar **sem HTTPS** (por exemplo, `http://IP-do-servidor:8080`). Em produção o cookie da sessão só vale em HTTPS; com HTTPS na frente, deixe comentado.

## 2. Primeiro usuário

O backend não sobe sem um usuário no banco. Crie o seu (o login é o e-mail; a senha é digitada no terminal, mínimo 10 caracteres):

```bash
docker compose run --rm api flask user add seu@email.com.br
```

Na primeira vez, esse comando também constrói a imagem e cria o banco.

**Trazendo os dados de uma instalação existente** (no lugar do passo acima): crie o volume, copie o banco e os PDFs do Calendário para ele e acerte o dono dos arquivos (o usuário da imagem é o `10001`):

```bash
docker compose create api
docker compose cp ./app.db api:/data/app.db
docker compose cp ./reforma-files api:/data/reforma-files
docker compose run --rm --user root --entrypoint chown api -R 10001:10001 /data
```

O banco precisa ser uma cópia consistente: na VPS, use a cópia feita com `flask db-backup` (pasta `backups`), não o `app.db` com o sistema rodando.

## 3. Subir

```bash
docker compose up -d --build
```

Acesse `http://localhost:8080` (ou `http://IP-do-servidor:8080`). Para outra porta, rode com `HTTP_PORT=80 docker compose up -d`.

Acompanhar:

```bash
docker compose ps
```

```bash
docker compose logs -f api scheduler
```

## 4. HTTPS

O container `web` fala HTTP. Para usar um domínio com HTTPS, coloque um proxy na frente que entregue o certificado e repasse para `http://127.0.0.1:8080`, por exemplo o Nginx da máquina com certbot (como em DEPLOY.md, trocando o `root` e os `location` por um único `proxy_pass http://127.0.0.1:8080;`), o Caddy ou um túnel da Cloudflare.

- O proxy deve enviar o IP do visitante em `X-Forwarded-For` (o Nginx do container confia nesse cabeçalho vindo de redes privadas e do próprio servidor).
- Com HTTPS funcionando, deixe `COOKIE_SECURE` comentado no `.env.docker`.
- Com o proxy na mesma máquina, publique o `web` só localmente: `HTTP_PORT=127.0.0.1:8080`.

## Assistente de IA (Resumo IA)

A imagem da `api` já traz as ferramentas oficiais **Claude Code** e **Codex**, com versões fixas (`CLAUDE_CODE_VERSION` e `CODEX_VERSION` no Dockerfile; elas nunca se atualizam sozinhas).

1. Em **Ajustes > Integrações**, escolha o tipo de IA e clique em **Conectar assinatura**.
2. **ChatGPT:** abra o link mostrado e digite o código (vale 15 minutos). Se a página recusar, ative o login por código de dispositivo nas configurações de segurança do ChatGPT.
3. **Claude:** abra o link, entre na conta e cole no opencontabil o código que a página mostra no fim.
4. Numa publicação, abra a aba **Resumo IA** e clique em **Gerar resumo com IA**.

- **Custo:** o uso conta no limite do seu plano; nada é cobrado à parte.
- **Uma pessoa:** conecte só a sua própria assinatura e não a use para outras pessoas.
- **Onde fica o login:** em `/data/ai-homes` (volume `opencontabil_data`), uma pasta por ferramenta. Ela é sensível como uma senha e não entra nas cópias do banco. **Desconectar** apaga a pasta.
- **Modelo:** o Claude usa `sonnet` e o ChatGPT o padrão da sua conta. Para trocar, defina `AI_CLAUDE_MODEL` ou `AI_CODEX_MODEL` no `.env.docker`.

## Comandos do dia a dia

Todos os comandos `flask` do DEPLOY.md funcionam com `docker compose run --rm api` na frente:

```bash
docker compose run --rm api flask user list
```

```bash
docker compose run --rm api flask user passwd seu@email.com.br
```

```bash
docker compose run --rm api flask db-backup
```

```bash
docker compose run --rm api flask intel run
```

**Atualizar para a versão nova do código:**

```bash
git pull
```

```bash
docker compose up -d --build
```

**Copiar as cópias do banco para fora do servidor:**

```bash
docker compose cp api:/data/backups ./backups-docker
```

**Parar** (os dados ficam no volume):

```bash
docker compose down
```

`docker compose down -v` também **apaga o volume com todos os dados**; só use para começar do zero.

## Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| `api` reiniciando, log `Nenhum usuário no banco` | Crie o usuário (passo 2) |
| `api` reiniciando, log `O usuário de desenvolvimento admin/admin existe neste banco` | O banco veio do desenvolvimento: crie o seu usuário e rode `docker compose run --rm api flask user remove admin` |
| Login volta para a tela de entrada | Acesso sem HTTPS: use `COOKIE_SECURE=false` no `.env.docker` e `docker compose up -d` |
| `Permission denied` em `/data` depois de copiar arquivos | Rode o `chown` do passo 2 |
