// Manual run endpoints (POST /runs, GET /status), tested in-process with a stub
// monitor so no request reaches the official sites.
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createIntelligenceHandler, MANUAL_RUN_COOLDOWN_MS } = require('../intelligence/routes');
const { createStore } = require('../intelligence/store');

let tmpDir;
let store;
let server;
let port;
let monitor;

function call(method, route, headers = { 'X-User': 'admin' }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: `/api/intelligence${route}`, headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, json: body ? JSON.parse(body) : null }));
    });
    req.on('error', reject);
    req.end();
  });
}

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intel-manual-'));
  store = createStore(path.join(tmpDir, 'intelligence-db.json'));
  monitor = {
    calls: [],
    running: false,
    isRunning() {
      return this.running;
    },
    async runMonitoring(options) {
      this.calls.push(options);
    },
  };
  const handler = createIntelligenceHandler({ store, monitor });
  // simula o server.js: o usuário vem da sessão já validada (aqui, do cabeçalho de teste)
  server = http.createServer((req, res) => {
    req.authUser = req.headers['x-user'];
    handler(req, res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

afterEach(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('manual run', () => {
  test('starts a run in the background tagged with the user', async () => {
    const res = await call('POST', '/runs');
    assert.equal(res.status, 202);
    assert.deepEqual(res.json, { started: true });
    assert.equal(monitor.calls.length, 1);
    assert.equal(monitor.calls[0].trigger, 'manual');
    assert.equal(monitor.calls[0].requestedBy, 'admin');
  });

  test('requires the session user', async () => {
    assert.equal((await call('POST', '/runs', {})).status, 401);
    assert.equal(monitor.calls.length, 0);
  });

  test('refuses while a run is active (in this process or recorded by another)', async () => {
    monitor.running = true;
    assert.equal((await call('POST', '/runs')).status, 409);
    monitor.running = false;

    store.update((data) => {
      data.runs.push({ id: 'run-cli', trigger: 'cli', status: 'running', startedAt: new Date().toISOString(), sources: [] });
    });
    const res = await call('POST', '/runs');
    assert.equal(res.status, 409);
    assert.match(res.json.error, /em andamento/);
    assert.equal(monitor.calls.length, 0);
  });

  test('enforces a cooldown after the previous manual run', async () => {
    store.update((data) => {
      data.runs.push({ id: 'run-1', trigger: 'manual', status: 'success', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), sources: [] });
    });
    const res = await call('POST', '/runs');
    assert.equal(res.status, 429);
    assert.match(res.json.error, /Aguarde \d+ s/);

    store.update((data) => {
      data.runs[0].finishedAt = new Date(Date.now() - MANUAL_RUN_COOLDOWN_MS - 1000).toISOString();
    });
    assert.equal((await call('POST', '/runs')).status, 202);
  });

  test('scheduled or CLI runs do not trigger the manual cooldown', async () => {
    store.update((data) => {
      data.runs.push({ id: 'run-cli', trigger: 'cli', status: 'success', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), sources: [] });
    });
    assert.equal((await call('POST', '/runs')).status, 202);
  });

  test('status reports running state and the last run', async () => {
    let res = await call('GET', '/status');
    assert.equal(res.json.running, false);
    assert.equal(res.json.lastRun, null);
    assert.equal(typeof res.json.schedulerEnabled, 'boolean');
    if (res.json.schedulerEnabled) assert.ok(!Number.isNaN(Date.parse(res.json.nextRunAt)));

    store.update((data) => {
      data.runs.push({ id: 'run-2', trigger: 'manual', status: 'running', startedAt: new Date().toISOString(), sources: [] });
    });
    res = await call('GET', '/status');
    assert.equal(res.json.running, true);
    assert.equal(res.json.lastRun.id, 'run-2');
  });

  test('a run stuck as "running" for over 15 minutes no longer blocks', async () => {
    store.update((data) => {
      data.runs.push({ id: 'run-old', trigger: 'manual', status: 'running', startedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(), sources: [] });
    });
    assert.equal((await call('GET', '/status')).json.running, false);
    assert.equal((await call('POST', '/runs')).status, 202);
  });
});
