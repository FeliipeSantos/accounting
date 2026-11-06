// Runner tests with stub collectors and a temporary store (no network).
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runMonitoring, reclassifyAll, sanitize } = require('../intelligence/monitor');
const { createStore } = require('../intelligence/store');

const item = (id, extra = {}) => ({
  externalId: id,
  title: `Instrução Normativa ${id} sobre a ECF`,
  url: `https://www.in.gov.br/web/dou/-/${id}`,
  publishedAt: '2026-11-05',
  excerpt: 'Altera a ECF.',
  actType: 'Instrução Normativa',
  organ: 'Ministério da Fazenda',
  ...extra,
});

let tmpDir;
let store;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intel-monitor-'));
  store = createStore(path.join(tmpDir, 'intelligence-db.json'));
  // apenas duas fontes ativas para os testes
  store.update((data) => {
    data.settings.enabledSources = ['dou', 'sped'];
  });
});

afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

const now = new Date('2026-11-06T12:00:00');

describe('runMonitoring', () => {
  test('a failing source does not stop the others and is logged', async () => {
    const collectors = {
      dou: { collect: async () => [item('a'), item('b')] },
      sped: { collect: async () => { throw new Error('HTTP 500'); } },
    };
    const run = await runMonitoring({ store, collectors, now, trigger: 'manual' });

    assert.equal(run.status, 'partial');
    assert.equal(run.newCount, 2);
    const spedResult = run.sources.find((s) => s.sourceId === 'sped');
    assert.equal(spedResult.status, 'error');
    assert.equal(spedResult.error, 'HTTP 500');

    const data = store.read();
    assert.equal(data.publications.length, 2);
    assert.ok(data.sourceStatus.dou.lastSuccessAt);
    assert.equal(data.sourceStatus.sped.lastError, 'HTTP 500');
    assert.equal(data.runs.length, 1);
    assert.equal(data.runs[0].status, 'partial');
  });

  test('does not store duplicates across runs or within a run', async () => {
    const collectors = { dou: { collect: async () => [item('a'), item('a')] }, sped: { collect: async () => [] } };
    const first = await runMonitoring({ store, collectors, now });
    assert.equal(first.newCount, 1);
    assert.equal(first.duplicateCount, 1);

    const second = await runMonitoring({ store, collectors, now });
    assert.equal(second.newCount, 0);
    assert.equal(second.duplicateCount, 2);
    assert.equal(store.read().publications.length, 1);
  });

  test('stores classification and skips irrelevant or invalid items', async () => {
    const collectors = {
      dou: {
        collect: async () => [
          item('ok'),
          item('lottery', { title: 'Portaria sobre loteria', excerpt: 'Prorroga loteria', actType: 'Portaria' }),
          item('evil', { url: 'https://example.com/phishing' }),
        ],
      },
      sped: { collect: async () => [] },
    };
    const run = await runMonitoring({ store, collectors, now });
    const dou = run.sources.find((s) => s.sourceId === 'dou');
    assert.equal(dou.fetched, 3);
    assert.equal(dou.invalid, 1, 'non-official URL is rejected');
    assert.equal(dou.relevant, 1);

    const [pub] = store.read().publications;
    assert.equal(pub.externalId, 'ok');
    assert.deepEqual(pub.subjects, ['obrigacoes-acessorias']);
    assert.equal(pub.relevance, 'media');
    assert.match(pub.id, /^pub-[0-9a-f]{16}$/);
  });

  test('first run looks back 30 days; later runs resume from the last success', async () => {
    const seen = [];
    const collectors = { dou: { collect: async ({ since }) => (seen.push(since), []) }, sped: { collect: async () => [] } };
    await runMonitoring({ store, collectors, now });
    await runMonitoring({ store, collectors, now });
    assert.equal(seen[0], '2026-10-07');
    assert.ok(seen[1] >= '2026-11-05', `resumes near the last success (got ${seen[1]})`);
  });

  test('only one run at a time', async () => {
    let release;
    const collectors = { dou: { collect: () => new Promise((r) => (release = () => r([]))) }, sped: { collect: async () => [] } };
    const first = runMonitoring({ store, collectors, now });
    await new Promise((r) => setImmediate(r));
    await assert.rejects(runMonitoring({ store, collectors, now }), /em andamento/);
    release();
    await first;
  });

  test('refuses to start while another process has a recent run in progress', async () => {
    store.update((data) => {
      data.runs.push({ id: 'run-cli', trigger: 'cli', status: 'running', startedAt: new Date().toISOString(), sources: [] });
    });
    await assert.rejects(runMonitoring({ store, collectors: { dou: { collect: async () => [] }, sped: { collect: async () => [] } }, now }), /em andamento/);
    assert.equal(store.read().runs.length, 1, 'nothing recorded for the refused run');
  });

  test('records who requested a manual run', async () => {
    const run = await runMonitoring({ store, collectors: { dou: { collect: async () => [] }, sped: { collect: async () => [] } }, now, trigger: 'manual', requestedBy: 'admin' });
    assert.equal(run.requestedBy, 'admin');
  });

  test('closes runs left "running" by a restart', async () => {
    store.update((data) => {
      data.runs.push({ id: 'run-old', status: 'running', startedAt: '2026-11-01T06:00:00.000Z', sources: [] });
    });
    await runMonitoring({ store, collectors: { dou: { collect: async () => [] }, sped: { collect: async () => [] } }, now });
    const old = store.read().runs.find((r) => r.id === 'run-old');
    assert.equal(old.status, 'failed');
    assert.match(old.error, /interrompida/);
  });
});

describe('reclassifyAll', () => {
  test('updates fields, drops items without subjects but keeps favorites', () => {
    store.update((data) => {
      data.publications.push(
        { id: 'pub-keep', sourceId: 'dou', externalId: 'k', title: 'IN sobre a ECF', excerpt: '', actType: 'Instrução Normativa', subjects: [], relevance: 'baixa' },
        { id: 'pub-drop', sourceId: 'dou', externalId: 'd', title: 'Portaria PREVIC', excerpt: 'previdência complementar', actType: 'Portaria', subjects: ['previdenciaria'] },
        { id: 'pub-fav', sourceId: 'dou', externalId: 'f', title: 'Portaria PREVIC 2', excerpt: 'previdência complementar', actType: 'Portaria', subjects: ['previdenciaria'] }
      );
      data.favorites.push({ userId: 'admin', publicationId: 'pub-fav', createdAt: '2026-11-06T00:00:00.000Z' });
    });
    const result = reclassifyAll(store);
    assert.deepEqual(result, { updated: 2, removed: 1, keptFavorites: 1 });
    const pubs = store.read().publications;
    assert.deepEqual(pubs.map((p) => p.id), ['pub-keep', 'pub-fav']);
    assert.deepEqual(pubs[0].subjects, ['obrigacoes-acessorias']);
    assert.equal(pubs[0].relevance, 'media');
  });
});

describe('sanitize', () => {
  test('rejects items without title or with non-official links, and invalid dates', () => {
    assert.equal(sanitize(item('x', { title: '   ' }), 'dou'), null);
    assert.equal(sanitize(item('x', { url: 'javascript:alert(1)' }), 'dou'), null);
    assert.equal(sanitize(item('x', { publishedAt: '05/11/2026' }), 'dou').publishedAt, null);
  });

  test('keeps a valid publication time only when there is a date', () => {
    assert.equal(sanitize(item('x', { publishedTime: '14:20' }), 'dou').publishedTime, '14:20');
    assert.equal(sanitize(item('x', { publishedTime: '25:00' }), 'dou').publishedTime, null);
    assert.equal(sanitize(item('x', { publishedTime: '14:20', publishedAt: null }), 'dou').publishedTime, null);
    assert.equal(sanitize(item('x'), 'dou').publishedTime, null);
  });
});
