"""Serves the screen files in development (python run.py), as Nginx does in production.

Closed list of files, same as deploy/nginx-flask.conf; never registered by wsgi.py.
"""

from flask import Flask, Response, send_from_directory

from app.config import PROJECT_ROOT

FRONTEND_FILES = {
    "index.html": "text/html",
    "app.js": "text/javascript",
    "intelligence-ui.js": "text/javascript",
    "styles.css": "text/css",
}


def register_dev_frontend(app: Flask) -> None:
    def serve(filename: str) -> Response:
        response = send_from_directory(PROJECT_ROOT, filename, mimetype=FRONTEND_FILES[filename], max_age=0)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response

    app.add_url_rule("/", "dev_frontend_index", lambda: serve("index.html"))
    for filename in FRONTEND_FILES:
        app.add_url_rule(f"/{filename}", f"dev_frontend_{filename}", lambda filename=filename: serve(filename))
