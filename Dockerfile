# opencontabil em Docker — veja DOCKER.md
#
# Três alvos (targets), usados pelo docker-compose.yml:
#   api  backend Flask com gunicorn (também roda os comandos flask e o agendador) e as
#        ferramentas oficiais de IA (Claude Code e Codex), usadas com a assinatura da pessoa
#   web  Nginx com a tela (build do React) que repassa /api e /healthz à api

# --- Tela (React) -------------------------------------------------------------
FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- Backend (Flask + gunicorn) -----------------------------------------------
FROM python:3.12-slim-bookworm AS api
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONUTF8=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    FLASK_APP=app:create_app \
    APP_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    TZ=America/Sao_Paulo \
    DB_PATH=/data/app.db \
    AI_HOMES_DIR=/data/ai-homes \
    PATH=/opt/ai-clis/bin:$PATH

# tzdata: a coleta diária e o backup usam a hora de America/Sao_Paulo
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Ferramentas oficiais de IA, sem modificações e com versões fixas: o Resumo IA usa a assinatura
# da pessoa (Claude Pro/Max ou ChatGPT Plus/Pro), conectada em Ajustes > Integrações. Elas nunca
# se atualizam sozinhas; para trocar de versão, mude os ARG e reconstrua a imagem.
ARG CLAUDE_CODE_VERSION=2.1.312
ARG CODEX_VERSION=0.165.0
COPY --from=frontend /usr/local/bin/node /usr/local/bin/node
COPY --from=frontend /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && npm install --global --prefix /opt/ai-clis --no-audit --no-fund \
       "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" "@openai/codex@${CODEX_VERSION}" \
    && npm cache clean --force \
    && claude --version \
    && codex --version

WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./
COPY docker/entrypoint.sh docker/scheduler.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/entrypoint.sh /usr/local/bin/scheduler.sh \
    && useradd --system --uid 10001 --home-dir /app --shell /usr/sbin/nologin opencontabil \
    && mkdir -p /data \
    && chown opencontabil:opencontabil /data

USER opencontabil
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz', timeout=4)"

ENTRYPOINT ["entrypoint.sh"]
CMD ["gunicorn", "-c", "gunicorn.conf.py", "wsgi:app"]

# --- Nginx com a tela ---------------------------------------------------------
FROM nginx:1.27-alpine AS web
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/opencontabil-security.conf docker/nginx/opencontabil-proxy.conf /etc/nginx/snippets/
COPY --from=frontend /build/dist /usr/share/nginx/html
EXPOSE 80
