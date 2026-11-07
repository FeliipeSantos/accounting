"""Serves the React build (frontend/dist) in development (python run.py), as Nginx
does in production. Never registered by wsgi.py.

Only index.html and the files under assets/ are served, same as deploy/nginx.conf.
For live editing of the screens, use the Vite dev server instead (npm run dev in frontend/).
"""

from flask import Flask, Response, send_from_directory

from app.config import PROJECT_ROOT
from app.core.http import json_error

DIST = PROJECT_ROOT / "frontend" / "dist"
NOT_BUILT = "Tela não gerada: rode npm run build na pasta frontend/"


def register_dev_frontend(app: Flask) -> None:
    def index() -> Response:
        if not (DIST / "index.html").exists():
            return json_error(404, NOT_BUILT)
        response = send_from_directory(DIST, "index.html", max_age=0)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response

    def asset(filename: str) -> Response:
        # nomes com hash do conteúdo: podem ficar em cache
        return send_from_directory(DIST / "assets", filename, max_age=31536000)

    app.add_url_rule("/", "dev_frontend_index", index)
    app.add_url_rule("/assets/<path:filename>", "dev_frontend_asset", asset)
