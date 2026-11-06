// Regression tests for the existing server behavior (Portal de Projetos).
// They pin the current contract so new modules cannot silently break it.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, startServer, request } = require('./helpers/server');

const SEED = [
  {
    name: 'Projeto de Teste',
    reportDate: '01/01/2026',
    activities: [{ id: 1, name: 'Atividade', progress: 50, status: 'Em andamento', subActivities: [] }],
  },
];

describe('projects API', () => {
  let srv;
  let auth;
  before(async () => {
    srv = await startServer({ seed: SEED });
    auth = { Cookie: srv.cookie() };
  });
  after(() => srv.stop());

  test('GET /api/projects returns the DB file content', async () => {
    const res = await request(srv.port, 'GET', '/api/projects', undefined, auth);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.deepEqual(JSON.parse(res.body), SEED);
  });

  test('POST /api/projects overwrites the DB and is read back by GET', async () => {
    const updated = [...SEED, { name: 'Segundo Projeto', activities: [] }];
    const post = await request(srv.port, 'POST', '/api/projects', JSON.stringify(updated), auth);
    assert.equal(post.status, 200);
    assert.deepEqual(JSON.parse(post.body), { success: true });

    assert.deepEqual(JSON.parse(fs.readFileSync(srv.dbFile, 'utf8')), updated);
    const get = await request(srv.port, 'GET', '/api/projects', undefined, auth);
    assert.deepEqual(JSON.parse(get.body), updated);
  });

  test('requires a valid session to read or write', async () => {
    assert.equal((await request(srv.port, 'GET', '/api/projects')).status, 401);
    assert.equal((await request(srv.port, 'POST', '/api/projects', '[]')).status, 401);
    assert.equal((await request(srv.port, 'GET', '/api/projects', undefined, { Cookie: 'sid=forjado' })).status, 401);
    assert.equal((await request(srv.port, 'GET', '/api/projects', undefined, { 'X-User': 'admin' })).status, 401, 'X-User header is not a session');
  });

  test('rejects invalid content without touching the DB', async () => {
    const before = fs.readFileSync(srv.dbFile, 'utf8');
    const cases = ['{not json', '{"name":"objeto em vez de lista"}', '[{"name":""}]', '[{"activities":[]}]', '[{"name":"x","activities":"nao-e-lista"}]', '[null]'];
    for (const body of cases) {
      const res = await request(srv.port, 'POST', '/api/projects', body, auth);
      assert.equal(res.status, 400, `should reject: ${body}`);
    }
    assert.equal(fs.readFileSync(srv.dbFile, 'utf8'), before, 'DB unchanged');
  });

  test('requires JSON content type on writes (CSRF protection)', async () => {
    const res = await request(srv.port, 'POST', '/api/projects', '[]', { ...auth, 'Content-Type': 'text/plain' });
    assert.equal(res.status, 415);
  });

  test('OPTIONS no longer opens CORS to other sites', async () => {
    const res = await request(srv.port, 'OPTIONS', '/api/projects');
    assert.equal(res.status, 204);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });
});

describe('DB bootstrap', () => {
  test('creates an empty DB file when it does not exist', async () => {
    const srv = await startServer();
    try {
      assert.deepEqual(JSON.parse(fs.readFileSync(srv.dbFile, 'utf8')), []);
      const res = await request(srv.port, 'GET', '/api/projects', undefined, { Cookie: srv.cookie() });
      assert.deepEqual(JSON.parse(res.body), []);
    } finally {
      await srv.stop();
    }
  });
});

describe('static files', () => {
  let srv;
  before(async () => {
    srv = await startServer({ seed: [] });
  });
  after(() => srv.stop());

  test('GET / serves index.html without cache', async () => {
    const res = await request(srv.port, 'GET', '/');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.equal(res.headers['cache-control'], 'no-cache, no-store, must-revalidate');
    assert.equal(res.body, fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
  });

  test('serves JS and CSS with the right content types', async () => {
    const js = await request(srv.port, 'GET', '/app.js');
    assert.equal(js.status, 200);
    assert.match(js.headers['content-type'], /text\/javascript/);

    const css = await request(srv.port, 'GET', '/styles.css');
    assert.equal(css.status, 200);
    assert.match(css.headers['content-type'], /text\/css/);
  });

  test('ignores the query string', async () => {
    const res = await request(srv.port, 'GET', '/index.html?v=123');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
  });

  test('returns 404 for missing files', async () => {
    const res = await request(srv.port, 'GET', '/does-not-exist.js');
    assert.equal(res.status, 404);
  });

  test('blocks directory traversal outside the app folder', async () => {
    const res = await request(srv.port, 'GET', '/../package.json');
    assert.equal(res.status, 403);
  });

  for (const blocked of ['/db.json', '/server.js', '/package.json', '/lib/auth.js']) {
    test(`does not serve ${blocked}`, async () => {
      assert.equal((await request(srv.port, 'GET', blocked)).status, 403);
    });
  }

  test('sends security headers', async () => {
    const res = await request(srv.port, 'GET', '/');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.match(res.headers['content-security-policy'], /script-src 'self'/);
  });

  test('the login screen no longer reveals credentials', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.doesNotMatch(html, /admin \/ admin|placeholder="admin"/);
    assert.doesNotMatch(app, /password === 'admin'/);
  });
});

describe('frontend shell structure', () => {
  // Static checks on the HTML ids that app.js binds at startup;
  // a missing id would throw on DOMContentLoaded and break the whole app.
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = ['app.js', 'intelligence-ui.js'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

  test('every id bound with getElementById in the frontend scripts exists in index.html', () => {
    const ids = [...scripts.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
    // ids created at runtime by app.js (guarded before use)
    const dynamicIds = new Set(['print-only-details-container']);
    const missing = [...new Set(ids)].filter((id) => !dynamicIds.has(id) && !html.includes(`id="${id}"`));
    assert.deepEqual(missing, []);
  });

  test('sidebar exposes the Portal de Projetos and Inteligência Contábil modules', () => {
    assert.match(html, /id="side-nav"/);
    assert.match(html, /data-module="projects"/);
    assert.match(html, /data-module="intelligence"/);
    assert.match(html, /<script src="intelligence-ui\.js"><\/script>/);
  });
});
