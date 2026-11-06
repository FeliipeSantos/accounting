// Production configuration: required users, bind address, health check, file
// exposure and graceful shutdown.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT, startServer, request } = require('./helpers/server');

describe('production settings', () => {
  test('refuses to start in production without configured users', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-nousers-'));
    try {
      const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
        cwd: ROOT,
        env: { ...process.env, NODE_ENV: 'production', AUTH_USERS: '', PORT: '0', DB_FILE: path.join(tmpDir, 'db.json'), INTEL_DB_FILE: path.join(tmpDir, 'i.json'), INTEL_SCHEDULER: 'off' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      child.stdout.on('data', (c) => (output += c));
      child.stderr.on('data', (c) => (output += c));
      const code = await new Promise((resolve) => child.on('exit', resolve));
      assert.notEqual(code, 0);
      assert.match(output, /Nenhum usuário configurado/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('binds to HOST and answers the health check without login', async () => {
    const srv = await startServer({ seed: [], env: { HOST: '127.0.0.1', TZ: 'America/Sao_Paulo' } });
    try {
      const res = await request(srv.port, 'GET', '/healthz');
      assert.equal(res.status, 200);
      assert.deepEqual(JSON.parse(res.body), { status: 'ok' });
    } finally {
      await srv.stop();
    }
  });

  test('does not serve deploy files, docs or folders', async () => {
    const srv = await startServer({ seed: [] });
    try {
      for (const p of ['/DEPLOY.md', '/deploy/nginx.conf', '/.env.example', '/intelligence/SOURCES.md']) {
        assert.equal((await request(srv.port, 'GET', p)).status, 403, p);
      }
      const dir = await request(srv.port, 'GET', '/tests');
      assert.equal(dir.status, 404, 'a folder answers 404 without server details');
      assert.doesNotMatch(dir.body, /EISDIR/);
    } finally {
      await srv.stop();
    }
  });

  test('stops cleanly on SIGTERM', { skip: process.platform === 'win32' && 'POSIX signals are emulated on Windows' }, async () => {
    const srv = await startServer({ seed: [] });
    // stop() envia SIGTERM; o processo deve sair em poucos segundos com código 0
    const started = Date.now();
    await srv.stop();
    assert.ok(Date.now() - started < 5000);
  });
});

describe('environment template', () => {
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  test('documents the production essentials', () => {
    for (const key of ['NODE_ENV=production', 'HOST=127.0.0.1', 'TRUST_PROXY=true', 'TZ=America/Sao_Paulo', 'AUTH_USERS=', 'DB_FILE=', 'INTEL_DB_FILE=']) {
      assert.ok(example.includes(key), `missing ${key}`);
    }
  });

  test('ships no real credentials', () => {
    assert.match(example, /^AUTH_USERS=$/m);
  });

  test('.env stays out of git', () => {
    assert.match(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8'), /^\.env$/m);
  });
});
