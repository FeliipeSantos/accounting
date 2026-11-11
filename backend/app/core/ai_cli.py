"""AI through the person's own subscription, using the official, unmodified CLIs as subprocesses:

    claude   Claude Code (@anthropic-ai/claude-code), Claude Pro/Max subscription
    codex    Codex (@openai/codex), ChatGPT Plus/Pro subscription

There is no API key and the app never reads, stores or forwards credentials: each CLI signs in
with its own official flow (a link plus a code) and keeps its login in its own folder
(CLAUDE_CONFIG_DIR / CODEX_HOME under AI_HOMES_DIR, by default "ai-homes" next to the database).
Usage counts against the subscription's plan limits. Meant for one person using their own
subscription: never connect someone's subscription for other people to use.

Each run gets an allowlisted environment (no API keys or app secrets), an empty temporary working
folder, no tools, no MCP servers and no session history.
"""

import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from flask import current_app

logger = logging.getLogger(__name__)

STATUS_TIMEOUT_SECONDS = 30
LOGIN_TIMEOUT_SECONDS = 15 * 60
GENERATE_TIMEOUT_SECONDS = 300
STATUS_CACHE_SECONDS = 30
MAX_OUTPUT_KEPT = 20_000
# linha de comando curta e sem quebras: as instruções e a publicação vão pelo stdin
# (no Windows, o atalho .cmd dos CLIs corta argumentos na primeira quebra de linha)
SHORT_PROMPT = "Siga as instruções recebidas pela entrada padrão e responda só no formato JSON combinado."

_ANSI = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07")
_URL = re.compile(r"https://[^\s\"'<>\x1b]+")
_DEVICE_CODE = re.compile(r"\b[A-Z0-9]{4}-[A-Z0-9]{4,6}\b")

# variáveis do servidor que os CLIs podem ver; nada de chaves de API nem segredos da instalação
_ENV_ALLOWLIST = (
    "PATH",
    "LANG",
    "LC_ALL",
    "TZ",
    "TMPDIR",
    "TEMP",
    "TMP",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "NO_PROXY",
    "https_proxy",
    "http_proxy",
    "no_proxy",
    "SSL_CERT_FILE",
    "NODE_EXTRA_CA_CERTS",
    # Windows (desenvolvimento)
    "SYSTEMROOT",
    "WINDIR",
    "COMSPEC",
    "PATHEXT",
    "APPDATA",
    "LOCALAPPDATA",
    "PROGRAMDATA",
)

# Codex: login só pela conta do ChatGPT, sem métricas nem busca de atualização
_CODEX_OVERRIDES = [
    "-c",
    'forced_login_method="chatgpt"',
    "-c",
    'cli_auth_credentials_store="file"',
    "-c",
    "analytics.enabled=false",
    "-c",
    "check_for_update_on_startup=false",
]


class AiError(Exception):
    """AI request that could not be done; the message is shown on the screen."""


@dataclass(frozen=True)
class Provider:
    id: str
    name: str
    plan: str
    binary: str
    bin_env: str
    model_env: str
    default_model: str | None


PROVIDERS = {
    p.id: p
    for p in (
        Provider("claude", "Claude", "Claude Pro ou Max", "claude", "AI_CLAUDE_BIN", "AI_CLAUDE_MODEL", "sonnet"),
        Provider("codex", "ChatGPT", "ChatGPT Plus ou Pro", "codex", "AI_CODEX_BIN", "AI_CODEX_MODEL", None),
    )
}


def binary_path(provider: Provider) -> str | None:
    """Executable of the CLI (AI_CLAUDE_BIN / AI_CODEX_BIN, or found on PATH), or None when not installed."""
    configured = os.environ.get(provider.bin_env)
    if configured:
        return configured if Path(configured).exists() else None
    return shutil.which(provider.binary)


def model_of(provider: Provider) -> str | None:
    return os.environ.get(provider.model_env) or provider.default_model


def homes_dir() -> Path:
    configured = os.environ.get("AI_HOMES_DIR")
    if configured:
        return Path(configured)
    return current_app.config["SETTINGS"].db_path.parent / "ai-homes"


def home_of(provider: Provider) -> Path:
    home = homes_dir() / provider.id
    home.mkdir(parents=True, exist_ok=True)
    return home


def cli_env(provider: Provider) -> dict[str, str]:
    """Allowlisted environment of a CLI run: only what it needs, its own home and no telemetry."""
    env = {key: value for key, value in os.environ.items() if key in _ENV_ALLOWLIST}
    home = str(home_of(provider))
    env["HOME"] = home
    if provider.id == "claude":
        env.update(
            CLAUDE_CONFIG_DIR=home,
            DISABLE_TELEMETRY="1",
            DISABLE_ERROR_REPORTING="1",
            DISABLE_AUTOUPDATER="1",
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1",
            CLAUDE_CODE_SKIP_PROMPT_HISTORY="1",
        )
    else:
        env["CODEX_HOME"] = home
    return env


def clean_output(text: str) -> str:
    return _ANSI.sub("", text).replace("\r", "")


def _last_lines(text: str, count: int = 4) -> str:
    lines = [line.strip() for line in clean_output(text).splitlines() if line.strip() and not line.startswith("WARNING:")]
    return " ".join(lines[-count:])[:500]


def _run(provider: Provider, args: list[str], *, timeout: int, input_text: str | None = None, cwd: Path | None = None):
    binary = binary_path(provider)
    if binary is None:
        raise AiError(f"A ferramenta do {provider.name} não está instalada neste servidor.")
    try:
        return subprocess.run(
            [binary, *args],
            input=input_text,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            cwd=str(cwd or home_of(provider)),
            env=cli_env(provider),
        )
    except subprocess.TimeoutExpired as err:
        raise AiError(f"O {provider.name} demorou demais para responder. Tente de novo.") from err
    except OSError as err:
        raise AiError(f"Não foi possível iniciar a ferramenta do {provider.name}.") from err


# --- situação da conexão ---------------------------------------------------------------------

_status_cache: dict[str, tuple[float, dict]] = {}
_status_lock = threading.Lock()


def forget_status(provider_id: str | None = None) -> None:
    with _status_lock:
        if provider_id:
            _status_cache.pop(provider_id, None)
        else:
            _status_cache.clear()


def _check(provider: Provider) -> dict:
    status = {"installed": binary_path(provider) is not None, "connected": False, "account": None, "error": None}
    if not status["installed"]:
        return status
    try:
        if provider.id == "claude":
            result = _run(provider, ["auth", "status", "--json"], timeout=STATUS_TIMEOUT_SECONDS)
            try:
                data = json.loads(result.stdout)
            except ValueError:
                data = {}
            # só a assinatura: um login por chave de API ou console não conta
            status["connected"] = bool(data.get("loggedIn")) and data.get("authMethod") in ("claude.ai", "oauth_token")
            account = data.get("email")
            if not account and isinstance(data.get("account"), dict):
                account = data["account"].get("email")
            plan = data.get("subscriptionType")
            status["account"] = " · ".join(str(part) for part in (account, plan) if part) or None
        else:
            result = _run(provider, ["login", "status", *_CODEX_OVERRIDES], timeout=STATUS_TIMEOUT_SECONDS)
            text = clean_output(result.stdout + "\n" + result.stderr).lower()
            status["connected"] = "logged in" in text and "not logged in" not in text and "chatgpt" in text
    except AiError as err:
        status["error"] = str(err)
    return status


def connection(provider_id: str, *, fresh: bool = False) -> dict:
    """{installed, connected, account, error} of a provider, cached for a few seconds."""
    provider = PROVIDERS[provider_id]
    now = time.monotonic()
    with _status_lock:
        cached = _status_cache.get(provider_id)
    if cached and not fresh and now - cached[0] < STATUS_CACHE_SECONDS:
        return cached[1]
    status = _check(provider)
    with _status_lock:
        _status_cache[provider_id] = (time.monotonic(), status)
    return status


def logout(provider_id: str) -> None:
    """Signs the CLI out and removes its folder (nothing of the login stays on the server)."""
    provider = PROVIDERS[provider_id]
    cancel_login(provider_id)
    try:
        if provider.id == "claude":
            _run(provider, ["auth", "logout"], timeout=STATUS_TIMEOUT_SECONDS)
        else:
            _run(provider, ["logout", *_CODEX_OVERRIDES], timeout=STATUS_TIMEOUT_SECONDS)
    except AiError as err:
        logger.warning("[ia] logout do %s: %s", provider.id, err)
    shutil.rmtree(homes_dir() / provider.id, ignore_errors=True)
    forget_status(provider_id)


# --- login pelo fluxo oficial (link + código) ------------------------------------------------


@dataclass
class LoginSession:
    provider: Provider
    process: subprocess.Popen
    started_at: float = field(default_factory=time.monotonic)
    output: str = ""
    state: str = "starting"  # starting | waiting | checking | success | failed | canceled
    url: str | None = None
    code: str | None = None
    code_sent: bool = False
    message: str | None = None

    def public(self) -> dict:
        return {
            "provider": self.provider.id,
            "state": self.state,
            "url": self.url,
            # Codex: código que a pessoa digita na página; Claude: a página mostra um código para colar aqui
            "code": self.code,
            "needsCode": self.provider.id == "claude" and self.url is not None and not self.code_sent and self.state == "waiting",
            "message": self.message,
        }


_sessions: dict[str, LoginSession] = {}
_sessions_lock = threading.Lock()


def _login_args(provider: Provider) -> list[str]:
    if provider.id == "claude":
        return ["auth", "login", "--claudeai"]
    return ["login", "--device-auth", *_CODEX_OVERRIDES]


def _read_output(session: LoginSession) -> None:
    stream = session.process.stdout
    while True:
        chunk = stream.read1(4096) if hasattr(stream, "read1") else stream.read(4096)
        if not chunk:
            return
        text = chunk.decode("utf-8", errors="replace")
        with _sessions_lock:
            session.output = (session.output + text)[-MAX_OUTPUT_KEPT:]
            cleaned = clean_output(session.output)
            if session.url is None and (url := _URL.search(cleaned)):
                session.url = url.group(0).rstrip(".,)")
            if session.provider.id == "codex" and session.code is None and (code := _DEVICE_CODE.search(cleaned)):
                session.code = code.group(0)
            ready = session.url is not None and (session.provider.id == "claude" or session.code is not None)
            if ready and session.state == "starting":
                session.state = "waiting"


def _wait_login(session: LoginSession, app) -> None:
    try:
        returncode = session.process.wait(timeout=LOGIN_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        session.process.kill()
        with _sessions_lock:
            session.state, session.message = "failed", "O tempo para concluir o login acabou. Comece de novo."
        return
    with _sessions_lock:
        if session.state == "canceled":
            return
        session.state = "checking"
    with app.app_context():
        forget_status(session.provider.id)
        connected = returncode == 0 and connection(session.provider.id, fresh=True)["connected"]
    with _sessions_lock:
        if connected:
            session.state, session.message = "success", f"{session.provider.name} conectado."
        else:
            detail = _last_lines(session.output)
            session.state = "failed"
            session.message = f"O login não foi concluído.{' ' + detail if detail else ''}"


def start_login(provider_id: str) -> dict:
    """Starts the official login of the CLI and returns the session (link, code). One per provider."""
    provider = PROVIDERS[provider_id]
    binary = binary_path(provider)
    if binary is None:
        raise AiError(f"A ferramenta do {provider.name} não está instalada neste servidor.")
    with _sessions_lock:
        current = _sessions.get(provider_id)
        if current and current.state in ("starting", "waiting", "checking"):
            return current.public()
    try:
        process = subprocess.Popen(
            [binary, *_login_args(provider)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=str(home_of(provider)),
            env=cli_env(provider),
        )
    except OSError as err:
        raise AiError(f"Não foi possível iniciar o login do {provider.name}.") from err
    session = LoginSession(provider=provider, process=process)
    with _sessions_lock:
        _sessions[provider_id] = session
    app = current_app._get_current_object()
    threading.Thread(target=_read_output, args=(session,), daemon=True).start()
    threading.Thread(target=_wait_login, args=(session, app), daemon=True).start()
    # espera o link aparecer, para a tela já recebê-lo na resposta
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        with _sessions_lock:
            if session.state != "starting":
                break
        time.sleep(0.2)
    return login_state(provider_id)


def login_state(provider_id: str) -> dict | None:
    with _sessions_lock:
        session = _sessions.get(provider_id)
        return session.public() if session else None


def submit_code(provider_id: str, code: str) -> dict:
    """Claude: sends the code shown by the browser to the waiting login."""
    with _sessions_lock:
        session = _sessions.get(provider_id)
        if session is None or session.state != "waiting":
            raise AiError("Não há login esperando um código. Comece de novo.")
        try:
            session.process.stdin.write((code.strip() + "\n").encode("utf-8"))
            session.process.stdin.flush()
        except (OSError, ValueError) as err:
            raise AiError("O login foi encerrado antes de receber o código. Comece de novo.") from err
        session.code_sent = True
        session.message = "Código enviado. Conferindo o login..."
        return session.public()


def cancel_login(provider_id: str) -> None:
    with _sessions_lock:
        session = _sessions.pop(provider_id, None)
    if session and session.process.poll() is None:
        session.state = "canceled"
        session.process.kill()


# --- geração ---------------------------------------------------------------------------------


def _claude_generate(provider: Provider, instruction: str, data: str, schema: dict, workdir: Path) -> dict:
    args = [
        "-p",
        SHORT_PROMPT,
        "--output-format",
        "json",
        "--json-schema",
        json.dumps(schema, ensure_ascii=False),
        "--tools",
        "",
        "--disallowedTools",
        "mcp__*",
        "--strict-mcp-config",
        "--disable-slash-commands",
        "--no-session-persistence",
        "--max-turns",
        "4",
    ]
    if model := model_of(provider):
        args += ["--model", model]
    result = _run(provider, args, timeout=GENERATE_TIMEOUT_SECONDS, input_text=f"{instruction}\n\n{data}", cwd=workdir)
    payload = None
    for line in reversed(result.stdout.strip().splitlines()):
        try:
            payload = json.loads(line)
            break
        except ValueError:
            continue
    if not isinstance(payload, dict):
        raise AiError(f"O Claude não respondeu como esperado. {_last_lines(result.stdout + result.stderr)}".strip())
    if payload.get("is_error") or result.returncode != 0:
        raise AiError(f"O Claude não concluiu o pedido: {str(payload.get('result') or payload.get('subtype') or 'erro')[:300]}")
    structured = payload.get("structured_output")
    if isinstance(structured, dict):
        return structured
    try:
        parsed = json.loads(payload.get("result") or "")
    except (TypeError, ValueError) as err:
        raise AiError("O Claude respondeu fora do formato combinado. Tente de novo.") from err
    if not isinstance(parsed, dict):
        raise AiError("O Claude respondeu fora do formato combinado. Tente de novo.")
    return parsed


def _codex_generate(provider: Provider, instruction: str, data: str, schema: dict, workdir: Path) -> dict:
    schema_path = workdir / "schema.json"
    schema_path.write_text(json.dumps(schema, ensure_ascii=False), encoding="utf-8")
    out_path = workdir / "resposta.json"
    args = [
        "exec",
        *_CODEX_OVERRIDES,
        "-c",
        'approval_policy="never"',
        "-c",
        'web_search="disabled"',
        "--skip-git-repo-check",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--sandbox",
        "read-only",
        "--output-schema",
        str(schema_path),
        "--output-last-message",
        str(out_path),
        "--cd",
        str(workdir),
    ]
    if model := model_of(provider):
        args += ["--model", model]
    args.append("-")
    result = _run(provider, args, timeout=GENERATE_TIMEOUT_SECONDS, input_text=f"{instruction}\n\n{data}", cwd=workdir)
    if result.returncode != 0 or not out_path.exists():
        raise AiError(f"O ChatGPT não concluiu o pedido. {_last_lines(result.stderr + result.stdout)}".strip())
    try:
        parsed = json.loads(out_path.read_text(encoding="utf-8"))
    except ValueError as err:
        raise AiError("O ChatGPT respondeu fora do formato combinado. Tente de novo.") from err
    if not isinstance(parsed, dict):
        raise AiError("O ChatGPT respondeu fora do formato combinado. Tente de novo.")
    return parsed


def generate(provider_id: str, instruction: str, data: str, schema: dict) -> dict:
    """Runs one request on the subscription and returns the JSON answer that follows `schema`.
    The instruction and `data` (the publication) go on stdin; the run happens in an empty temporary folder."""
    provider = PROVIDERS[provider_id]
    workdir = Path(tempfile.mkdtemp(prefix="opencontabil-ia-"))
    try:
        if provider.id == "claude":
            return _claude_generate(provider, instruction, data, schema, workdir)
        return _codex_generate(provider, instruction, data, schema, workdir)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
