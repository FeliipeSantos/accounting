// Integration tests for the Inteligência Contábil module API and static protections.
// Publications below are test fixtures written to a temporary DB only.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { startServer, request } = require('./helpers/server');

// usuários de teste logados pelo helper (sessão real por cookie)
const USER = 'admin';
const OTHER_USER = 'outro.usuario';

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const FIXTURE_PUBLICATIONS = [
  {
    id: 'pub-a',
    sourceId: 'dou',
    title: 'Fixture A — Reforma',
    url: 'https://www.in.gov.br/web/dou/-/fixture-a',
    publishedAt: daysAgo(1),
    collectedAt: new Date().toISOString(),
    excerpt: 'Trecho A sobre IBS',
    subjects: ['reforma-tributaria', 'ibs-cbs'],
    relevance: 'critica',
  },
  {
    id: 'pub-b',
    sourceId: 'esocial',
    title: 'Fixture B — eSocial',
    url: 'https://www.gov.br/esocial/pt-br/noticias/fixture-b',
    publishedAt: daysAgo(30),
    collectedAt: new Date().toISOString(),
    excerpt: 'Trecho B',
    subjects: ['esocial'],
    relevance: 'media',
  },
];

/**
 * Calls the module API as a logged-in test user (or anonymously when `as` is null).
 */
const api = (srv, method, path, body, as = USER) =>
  request(srv.port, method, `/api/intelligence${path}`, body && JSON.stringify(body), {
    'Content-Type': 'application/json',
    ...(as ? { Cookie: srv.cookie(as) } : {}),
  }).then((res) => ({
    ...res,
    json: res.body ? JSON.parse(res.body) : null,
  }));

describe('intelligence API — fresh database', () => {
  let srv;
  before(async () => {
    srv = await startServer({ seed: [] });
  });
  after(() => srv.stop());

  test('requires a session', async () => {
    const res = await api(srv, 'GET', '/summary', undefined, null);
    assert.equal(res.status, 401);
  });

  test('a forged X-User header is not accepted as identity', async () => {
    const res = await request(srv.port, 'GET', '/api/intelligence/summary', undefined, { 'X-User': 'admin' });
    assert.equal(res.status, 401);
  });

  test('creates its own DB file with defaults and does not touch db.json', async () => {
    const res = await api(srv, 'GET', '/summary');
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.totals, { publications: 0, critical: 0, recent: 0, reform: 0 });
    assert.equal(res.json.lastRun, null);
    assert.ok(fs.existsSync(srv.intelDbFile));
    assert.deepEqual(JSON.parse(fs.readFileSync(srv.dbFile, 'utf8')), []);
  });

  test('lists the 9 sources (all collectable, all enabled) and the 17 subjects', async () => {
    const sources = (await api(srv, 'GET', '/sources')).json;
    assert.equal(sources.length, 9);
    const collectable = sources.filter((s) => s.collectable).map((s) => s.id).sort();
    assert.deepEqual(collectable, ['camara', 'confaz', 'dou', 'esocial', 'fazenda', 'legislacao', 'receita', 'simples', 'sped']);
    assert.ok(sources.every((s) => s.enabled));
    assert.equal(sources.find((s) => s.id === 'legislacao').method, 'api');

    const subjects = (await api(srv, 'GET', '/subjects')).json;
    assert.equal(subjects.length, 17);
    assert.ok(subjects.every((s) => s.enabled));
  });

  test('settings: validates and persists changes', async () => {
    const bad = await api(srv, 'PUT', '/settings', { runTime: '25:00' });
    assert.equal(bad.status, 400);
    const unknown = await api(srv, 'PUT', '/settings', { enabledSources: ['planalto'] });
    assert.equal(unknown.status, 400, 'unknown sources cannot be enabled');

    const ok = await api(srv, 'PUT', '/settings', { runTime: '07:30', enabledSubjects: ['icms'] });
    assert.equal(ok.status, 200);
    const saved = (await api(srv, 'GET', '/settings')).json;
    assert.equal(saved.runTime, '07:30');
    assert.deepEqual(saved.enabledSubjects, ['icms']);
    assert.equal(saved.knownSources, undefined, 'internal field is not exposed');
  });

  test('settings: a disabled source stays disabled after reload', async () => {
    await api(srv, 'PUT', '/settings', { enabledSources: ['dou'] });
    const saved = (await api(srv, 'GET', '/settings')).json;
    assert.deepEqual(saved.enabledSources, ['dou']);
  });

  test('rejects invalid JSON bodies', async () => {
    const res = await request(srv.port, 'PUT', '/api/intelligence/settings', '{not json', { Cookie: srv.cookie(USER) });
    assert.equal(res.status, 400);
  });

  test('unknown routes return 404', async () => {
    const res = await api(srv, 'GET', '/nope');
    assert.equal(res.status, 404);
  });
});

describe('intelligence API — publications, filters and favorites', () => {
  let srv;
  before(async () => {
    srv = await startServer({ seed: [], intelSeed: { publications: FIXTURE_PUBLICATIONS } });
  });
  after(() => srv.stop());

  test('summary counts totals, critical, recent and reform items', async () => {
    const { totals, byCategory, recentItems } = (await api(srv, 'GET', '/summary')).json;
    assert.deepEqual(totals, { publications: 2, critical: 1, recent: 1, reform: 1 });
    assert.equal(byCategory.find((c) => c.id === 'esocial').count, 1);
    assert.deepEqual(recentItems.map((p) => p.id), ['pub-a']);
  });

  test('lists newest first and filters by subject, relevance, period and text', async () => {
    const all = (await api(srv, 'GET', '/publications')).json;
    assert.equal(all.total, 2);
    assert.deepEqual(all.items.map((p) => p.id), ['pub-a', 'pub-b']);

    const bySubject = (await api(srv, 'GET', '/publications?subject=esocial')).json;
    assert.deepEqual(bySubject.items.map((p) => p.id), ['pub-b']);

    const byRelevance = (await api(srv, 'GET', '/publications?relevance=critica')).json;
    assert.deepEqual(byRelevance.items.map((p) => p.id), ['pub-a']);

    const byPeriod = (await api(srv, 'GET', `/publications?from=${daysAgo(7)}`)).json;
    assert.deepEqual(byPeriod.items.map((p) => p.id), ['pub-a']);

    const byText = (await api(srv, 'GET', '/publications?q=ibs')).json;
    assert.deepEqual(byText.items.map((p) => p.id), ['pub-a']);
  });

  test('subject accepts a list (any of), search ignores accents, and source filters', async () => {
    const group = (await api(srv, 'GET', '/publications?subject=imposto-seletivo,ibs-cbs')).json;
    assert.deepEqual(group.items.map((p) => p.id), ['pub-a']);

    const accentless = (await api(srv, 'GET', '/publications?q=REFORMA')).json;
    assert.deepEqual(accentless.items.map((p) => p.id), ['pub-a']);
    const accented = (await api(srv, 'GET', `/publications?q=${encodeURIComponent('eSocial')}`)).json;
    assert.deepEqual(accented.items.map((p) => p.id), ['pub-b']);

    const bySource = (await api(srv, 'GET', '/publications?source=esocial')).json;
    assert.deepEqual(bySource.items.map((p) => p.id), ['pub-b']);
  });

  test('paginates with limit and offset', async () => {
    const first = (await api(srv, 'GET', '/publications?limit=1')).json;
    const second = (await api(srv, 'GET', '/publications?limit=1&offset=1')).json;
    assert.equal(first.total, 2);
    assert.deepEqual([...first.items, ...second.items].map((p) => p.id), ['pub-a', 'pub-b']);
  });

  test('rejects invalid filters', async () => {
    assert.equal((await api(srv, 'GET', '/publications?subject=icms,xyz')).status, 400);
    assert.equal((await api(srv, 'GET', '/publications?run=run-inexistente')).status, 400);
    assert.equal((await api(srv, 'GET', '/publications?subject=xyz')).status, 400);
    assert.equal((await api(srv, 'GET', '/publications?from=01/01/2026')).status, 400);
    assert.equal((await api(srv, 'GET', '/publications?relevance=urgente')).status, 400);
  });

  test('returns publication detail and 404 for unknown ids', async () => {
    const res = await api(srv, 'GET', '/publications/pub-b');
    assert.equal(res.status, 200);
    assert.equal(res.json.title, 'Fixture B — eSocial');
    assert.equal((await api(srv, 'GET', '/publications/missing')).status, 404);
  });

  test('favorites are scoped to the user and idempotent', async () => {
    assert.equal((await api(srv, 'POST', '/favorites', { publicationId: 'missing' })).status, 404);
    assert.equal((await api(srv, 'POST', '/favorites', { publicationId: 'pub-b' })).status, 201);
    assert.equal((await api(srv, 'POST', '/favorites', { publicationId: 'pub-b' })).status, 200);

    const mine = (await api(srv, 'GET', '/favorites')).json;
    assert.deepEqual(mine.map((p) => p.id), ['pub-b']);
    assert.ok(mine[0].favoritedAt);

    const theirs = (await api(srv, 'GET', '/favorites', undefined, OTHER_USER)).json;
    assert.deepEqual(theirs, []);

    const list = (await api(srv, 'GET', '/publications')).json;
    assert.equal(list.items.find((p) => p.id === 'pub-b').favorite, true);
    const otherList = (await api(srv, 'GET', '/publications', undefined, OTHER_USER)).json;
    assert.equal(otherList.items.find((p) => p.id === 'pub-b').favorite, false);

    assert.equal((await api(srv, 'DELETE', '/favorites/pub-b')).status, 200);
    assert.deepEqual((await api(srv, 'GET', '/favorites')).json, []);
  });
});

describe('intelligence API — publications of a given run', () => {
  let srv;
  before(async () => {
    srv = await startServer({
      seed: [],
      intelSeed: {
        publications: [
          { ...FIXTURE_PUBLICATIONS[0], collectedAt: '2026-11-06T09:00:30.000Z' },
          { ...FIXTURE_PUBLICATIONS[1], collectedAt: '2026-11-05T09:00:30.000Z' },
        ],
        runs: [
          { id: 'run-05', trigger: 'scheduled', status: 'success', startedAt: '2026-11-05T09:00:00.000Z', finishedAt: '2026-11-05T09:01:00.000Z', newCount: 1, sources: [] },
          { id: 'run-06', trigger: 'manual', status: 'success', startedAt: '2026-11-06T09:00:00.000Z', finishedAt: '2026-11-06T09:01:00.000Z', newCount: 1, sources: [] },
        ],
      },
    });
  });
  after(() => srv.stop());

  test('returns only what each run collected', async () => {
    assert.deepEqual((await api(srv, 'GET', '/publications?run=run-06')).json.items.map((p) => p.id), ['pub-a']);
    assert.deepEqual((await api(srv, 'GET', '/publications?run=run-05')).json.items.map((p) => p.id), ['pub-b']);
  });
});

describe('intelligence API — catalog upgrade of an existing database', () => {
  let srv;
  before(async () => {
    // Settings saved by the previous catalog: no knownSources, without the 3 new sources,
    // and with "fazenda" deliberately disabled by the user.
    srv = await startServer({
      seed: [],
      intelSeed: { settings: { runTime: '06:00', enabledSources: ['dou', 'receita', 'confaz', 'sped', 'esocial'] } },
    });
  });
  after(() => srv.stop());

  test('enables sources that became collectable and keeps user choices', async () => {
    const { enabledSources } = (await api(srv, 'GET', '/settings')).json;
    assert.deepEqual(enabledSources.sort(), ['camara', 'confaz', 'dou', 'esocial', 'legislacao', 'receita', 'simples', 'sped']);
  });
});

describe('static file protection', () => {
  let srv;
  before(async () => {
    srv = await startServer({ seed: [] });
  });
  after(() => srv.stop());

  for (const blocked of ['/.gitignore', '/.env', '/intelligence/routes.js', '/intelligence/catalog.js', '/tests/server.test.js', '/intelligence-db.json']) {
    test(`blocks ${blocked}`, async () => {
      const res = await request(srv.port, 'GET', blocked);
      assert.equal(res.status, 403);
    });
  }

  test('still serves the module frontend file', async () => {
    const res = await request(srv.port, 'GET', '/intelligence-ui.js');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/javascript/);
  });
});
