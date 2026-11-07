"""Production entry point: gunicorn -c gunicorn.conf.py wsgi:app

Refuses to start (exit code 1) when the schema is missing or there is no valid user.
"""

import logging
import sys

from app import StartupError, check_startup, create_app

logging.basicConfig(level=logging.INFO, format="%(message)s")
logging.getLogger("alembic").setLevel(logging.WARNING)

app = create_app()

try:
    check_startup(app)
except StartupError as err:
    print(err, file=sys.stderr, flush=True)
    sys.exit(1)
