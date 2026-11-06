const http = require('http');
const fs = require('fs');
const path = require('path');
const intelligence = require('./intelligence/routes');
const intelligenceScheduler = require('./intelligence/scheduler');
const { createAuth } = require('./lib/auth');

// Configuração por variáveis de ambiente (arquivo .env; veja .env.example)
const PORT = process.env.PORT !== undefined ? Number(process.env.PORT) : 8080;
// Em produção use HOST=127.0.0.1 (só o Nginx acessa); sem HOST, escuta em todas as interfaces
const HOST = process.env.HOST || undefined;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'db.json');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const EXPECTED_TIMEZONE = 'America/Sao_Paulo';

// Files and folders that must never be served as static content
// (secrets, data files and server-side code).
const BLOCKED_STATIC_FILES = new Set(['intelligence-db.json', 'db.json', 'server.js', 'package.json', 'package-lock.json']);
const BLOCKED_STATIC_DIRS = new Set(['intelligence', 'lib', 'tests', 'deploy', 'node_modules']);
// documentação (DEPLOY.md etc.) descreve a infraestrutura: não é servida
const BLOCKED_STATIC_EXTENSIONS = new Set(['.md']);

const MAX_PROJECTS_BODY_BYTES = 5 * 1024 * 1024;
const MAX_AUTH_BODY_BYTES = 4 * 1024;

const auth = createAuth();

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  // estilos inline são usados pelo app; scripts só do próprio servidor;
  // a fonte Inter vem do Google Fonts (folha de estilo + arquivos da fonte)
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(payload));
}

/**
 * Reads a request body up to a size limit.
 * @returns {Promise<string>}
 */
function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Conteúdo muito grande'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Validates the full projects list sent by the Portal de Projetos.
 * @returns {string|null} Error message, or null when valid.
 */
function validateProjects(list) {
  if (!Array.isArray(list)) return 'O conteúdo deve ser uma lista de projetos';
  if (list.length > 1000) return 'Quantidade de projetos acima do limite';
  for (const [i, project] of list.entries()) {
    if (!project || typeof project !== 'object' || Array.isArray(project)) return `Projeto ${i + 1} inválido`;
    if (typeof project.name !== 'string' || !project.name.trim() || project.name.length > 300) return `Projeto ${i + 1} sem nome válido`;
    if (project.activities !== undefined && !Array.isArray(project.activities)) return `Projeto ${i + 1} com atividades inválidas`;
  }
  return null;
}

/**
 * Writes the file atomically (temp file + rename) so a crash never leaves it half written.
 */
function writeFileAtomic(file, content) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * Login, logout and session check: /api/auth/*
 */
async function handleAuthRoute(req, res, route) {
  if (route === '/session' && req.method === 'GET') {
    const user = auth.getSessionUser(req);
    if (user) sendJson(res, 200, { user });
    else sendJson(res, 401, { error: 'Sessão expirada ou inexistente' });
    return;
  }
  if (route === '/login' && req.method === 'POST') {
    let credentials;
    try {
      credentials = JSON.parse(await readBody(req, MAX_AUTH_BODY_BYTES));
    } catch (err) {
      sendJson(res, err.status || 400, { error: err.status ? err.message : 'Requisição inválida' });
      return;
    }
    const result = auth.login(req, credentials && credentials.username, credentials && credentials.password);
    if (result.status === 200) sendJson(res, 200, { user: result.user }, { 'Set-Cookie': result.setCookie });
    else sendJson(res, result.status, { error: result.error });
    return;
  }
  if (route === '/logout' && req.method === 'POST') {
    sendJson(res, 200, { success: true }, { 'Set-Cookie': auth.logout(req) });
    return;
  }
  sendJson(res, 404, { error: 'Rota não encontrada' });
}

/**
 * Returns true when a resolved path inside the app folder must not be served.
 */
function isBlockedStaticPath(filePath) {
  const segments = path.relative(__dirname, filePath).split(path.sep);
  if (segments.some((s) => s.startsWith('.'))) return true; // .env, .git, .claude...
  if (BLOCKED_STATIC_DIRS.has(segments[0]) && segments.length > 1) return true;
  if (BLOCKED_STATIC_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return true;
  return BLOCKED_STATIC_FILES.has(segments[segments.length - 1]);
}

// Ensure db.json exists on disk
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
}

const server = http.createServer(async (req, res) => {
  Object.entries(SECURITY_HEADERS).forEach(([name, value]) => res.setHeader(name, value));

  // Sem CORS: o app é servido pelo mesmo endereço da API
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const pathname = req.url.split('?')[0];

  // Verificação de saúde para monitoramento (sem dados, sem login)
  if (pathname === '/healthz' && req.method === 'GET') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (pathname.startsWith('/api/')) {
    try {
      if (pathname.startsWith('/api/auth/')) {
        await handleAuthRoute(req, res, pathname.slice('/api/auth'.length));
        return;
      }

      // Toda API (exceto login) exige sessão válida
      const user = auth.getSessionUser(req);
      if (!user) {
        sendJson(res, 401, { error: 'Sessão expirada ou inexistente' });
        return;
      }
      req.authUser = user;

      // Escritas só com JSON: formulários de outros sites não conseguem enviar (proteção CSRF)
      if (['POST', 'PUT', 'DELETE'].includes(req.method) && !String(req.headers['content-type'] || '').startsWith('application/json')) {
        sendJson(res, 415, { error: 'Envie o conteúdo como application/json' });
        return;
      }

      // API Route - Get Projects
      if (pathname === '/api/projects' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(fs.readFileSync(DB_FILE, 'utf8'));
        return;
      }

      // API Route - Save Projects (lista completa, validada antes de gravar)
      if (pathname === '/api/projects' && req.method === 'POST') {
        let list;
        try {
          list = JSON.parse(await readBody(req, MAX_PROJECTS_BODY_BYTES));
        } catch (err) {
          sendJson(res, err.status || 400, { error: err.status ? err.message : 'JSON inválido' });
          return;
        }
        const error = validateProjects(list);
        if (error) {
          sendJson(res, 400, { error });
          return;
        }
        writeFileAtomic(DB_FILE, JSON.stringify(list));
        sendJson(res, 200, { success: true });
        return;
      }

      // Módulo Inteligência Contábil
      if (pathname === intelligence.PREFIX || pathname.startsWith(`${intelligence.PREFIX}/`)) {
        await intelligence.handleIntelligenceRequest(req, res);
        return;
      }

      sendJson(res, 404, { error: 'Rota não encontrada' });
    } catch (err) {
      console.error('[server] erro na API', req.method, pathname, err);
      if (!res.headersSent) sendJson(res, 500, { error: 'Erro interno do servidor' });
    }
    return;
  }

  // Static files serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  
  // Safe directory check to prevent directory traversal outside workspace
  if (!filePath.startsWith(__dirname) || isBlockedStaticPath(filePath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const extname = path.extname(filePath);
  let contentType = 'text/html';
  
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
    case '.jpeg':
      contentType = 'image/jpeg';
      break;
    case '.svg':
      contentType = 'image/svg+xml';
      break;
    case '.ico':
      contentType = 'image/x-icon';
      break;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      // pasta (EISDIR) também responde 404, sem expor detalhes do servidor
      if (err.code === 'ENOENT' || err.code === 'EISDIR') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Arquivo nao encontrado');
      } else {
        console.error('[server] erro ao ler arquivo estático', filePath, err.code);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Erro do servidor');
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content);
    }
  });
});

let scheduler = null;

server.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://localhost:${server.address().port}${HOST ? ` (escutando em ${HOST})` : ''}`);

  // O agendador usa a hora local: na VPS, configure TZ=America/Sao_Paulo
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timezone !== EXPECTED_TIMEZONE) {
    console.warn(`[server] fuso horário do processo é "${timezone}"; a coleta diária usará esse fuso. Defina TZ=${EXPECTED_TIMEZONE}.`);
  }
  if (IS_PRODUCTION && !HOST) {
    console.warn('[server] produção sem HOST definido: o Node está aceitando conexões de qualquer interface. Use HOST=127.0.0.1 atrás do Nginx.');
  }

  // Monitoramento diário do módulo Inteligência Contábil (desligável com INTEL_SCHEDULER=off)
  if (intelligenceScheduler.isSchedulerEnabled()) {
    scheduler = intelligenceScheduler.startScheduler();
  }
});

/**
 * Graceful stop (systemd sends SIGTERM): stops accepting requests and the scheduler,
 * and waits for a collection in progress before exiting.
 */
function shutdown(signal) {
  console.log(`[server] ${signal} recebido: encerrando...`);
  if (scheduler) scheduler.stop();
  server.close();
  const { isRunning } = require('./intelligence/monitor');
  const startedAt = Date.now();
  const waitForRun = setInterval(() => {
    // até 25 s para a coleta em andamento terminar (o systemd espera 30 s)
    if (!isRunning() || Date.now() - startedAt > 25000) {
      clearInterval(waitForRun);
      process.exit(0);
    }
  }, 250);
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
