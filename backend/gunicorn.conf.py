"""gunicorn settings for production: gunicorn -c gunicorn.conf.py wsgi:app

One worker process with threads, on purpose:
- the failed-login limit and the "collection running" flag live in the process memory;
- SQLite accepts one writer at a time anyway, so more processes would not add capacity.
"""

import os
import time

bind = f"{os.environ.get('HOST') or '127.0.0.1'}:{os.environ.get('PORT') or '8080'}"
workers = 1
worker_class = "gthread"
threads = 8
# pedido mais longo esperado (salvar projeto grande); coletas rodam em segundo plano
timeout = 120
# ao parar (systemd envia SIGTERM), espera os pedidos em andamento
graceful_timeout = 25
# logs no journal do systemd
accesslog = None
errorlog = "-"
loglevel = "info"

# Coleta manual em andamento: espera até este tempo antes de o processo terminar
COLLECTION_WAIT_SECONDS = 25


def worker_exit(server, worker):
    """Waits for a manual collection in progress before the worker exits (as the Node server did)."""
    from app.modules.intelligence import monitor

    deadline = time.monotonic() + COLLECTION_WAIT_SECONDS
    if monitor.is_running():
        server.log.info("[server] aguardando a coleta em andamento terminar...")
    while monitor.is_running() and time.monotonic() < deadline:
        time.sleep(0.25)
