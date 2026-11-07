"""Development and test server: python run.py

Reads PORT and HOST from the environment (PORT=0 picks a free port) and prints
"localhost:<port>" once listening, as the API contract requires. Also serves the
React build (frontend/dist), which Nginx serves in production (gunicorn runs wsgi.py).
"""

import logging
import sys

from werkzeug.serving import make_server

from app import StartupError, check_startup, create_app
from app.core.devfrontend import register_dev_frontend


def main() -> int:
    # no Windows a saída redirecionada usa cp1252; as mensagens têm acentos
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("alembic").setLevel(logging.WARNING)
    app = create_app()
    # em produção a tela vem do Nginx; aqui o próprio servidor a entrega
    register_dev_frontend(app)
    settings = app.config["SETTINGS"]
    try:
        check_startup(app)
    except StartupError as err:
        print(err, file=sys.stderr, flush=True)
        return 1

    server = make_server(settings.host or "0.0.0.0", settings.port, app, threaded=True)
    listening = f" (escutando em {settings.host})" if settings.host else ""
    print(f"Servidor rodando em http://localhost:{server.server_port}{listening}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
