const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const { hashPassword } = require('../../lib/auth');

const ROOT = path.join(__dirname, '..', '..');

// Usuários de teste (só existem nos servidores temporários dos testes)
const TEST_USERS = { admin: 'senha-de-teste-123', 'outro.usuario': 'outra-senha-456' };
const TEST_AUTH_USERS = Object.entries(TEST_USERS)
  .map(([name, password]) => `${name}:${hashPassword(password)}`)
  .join(',');

/**
 * Starts server.js as a child process on a free port with an isolated DB file.
 * The real db.json is never touched. Every test user is logged in, and
 * `cookie(name)` returns its session cookie.
 *
 * @param {{ seed?: unknown, intelSeed?: unknown, env?: object }} [options] Initial content of db.json and of the
 *   Inteligência Contábil DB (omit to let the server create them) and extra environment variables.
 * @returns {Promise<{ port: number, dbFile: string, intelDbFile: string, cookie: (user?: string) => string, stop: () => Promise<void> }>}
 */
async function startServer(options = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-accounting-test-'));
  const dbFile = path.join(tmpDir, 'db.json');
  const intelDbFile = path.join(tmpDir, 'intelligence-db.json');
  if (options.seed !== undefined) {
    fs.writeFileSync(dbFile, JSON.stringify(options.seed, null, 2));
  }
  if (options.intelSeed !== undefined) {
    fs.writeFileSync(intelDbFile, JSON.stringify(options.intelSeed, null, 2));
  }

  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    // agendador desligado: os testes nunca acessam os sites oficiais
    env: { ...process.env, PORT: '0', DB_FILE: dbFile, INTEL_DB_FILE: intelDbFile, INTEL_SCHEDULER: 'off', AUTH_USERS: TEST_AUTH_USERS, ...(options.env || {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Server did not start:\n${output}`)), 10000);
    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/localhost:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited early (code ${code}):\n${output}`));
    });
  });

  const stop = () =>
    new Promise((resolve) => {
      if (child.exitCode !== null) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        resolve();
        return;
      }
      child.once('exit', () => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        resolve();
      });
      child.kill();
    });

  const cookies = {};
  for (const [name, password] of Object.entries(TEST_USERS)) {
    const res = await request(port, 'POST', '/api/auth/login', JSON.stringify({ username: name, password }));
    if (res.status !== 200) throw new Error(`Login de teste falhou para ${name}: ${res.status} ${res.body}`);
    cookies[name] = res.headers['set-cookie'][0].split(';')[0];
  }

  return { port, dbFile, intelDbFile, cookie: (user = 'admin') => cookies[user], stop };
}

/**
 * Sends a raw HTTP request (path is sent verbatim, without URL normalization).
 *
 * @returns {Promise<{ status: number, headers: http.IncomingHttpHeaders, body: string }>}
 */
function request(port, method, urlPath, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path: urlPath, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = { ROOT, startServer, request, TEST_USERS };
