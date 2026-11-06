// Monitoring run: collects every enabled source in isolation, validates,
// classifies, de-duplicates and stores new publications, logging the run.
const crypto = require('crypto');
const { SOURCES } = require('./catalog');
const { classify } = require('./classifier');
const defaultCollectors = require('./collectors');
const http = require('./http');
const { createStore } = require('./store');
const { cleanText, localIsoDate, addDays } = require('./text');

// Janela da primeira coleta de cada fonte
const BACKFILL_DAYS = 30;
const MAX_RUNS_KEPT = 200;
// Uma execução "em andamento" mais antiga que isso é considerada interrompida
const RUNNING_STALE_MS = 15 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

let currentRun = null;

class MonitorBusyError extends Error {}

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

function publicationKey(sourceId, externalId) {
  return `${sourceId}:${externalId}`;
}

function contentHash(sourceId, title, publishedAt) {
  return sha1(`${sourceId}|${title.toLowerCase()}|${publishedAt || ''}`);
}

/**
 * Validates and normalizes a raw collector item; returns null when unusable.
 */
function sanitize(raw, sourceId) {
  if (!raw || typeof raw !== 'object') return null;
  const externalId = cleanText(raw.externalId, 300);
  const title = cleanText(raw.title, 500);
  const url = String(raw.url || '');
  if (!externalId || !title || !http.isOfficialUrl(url)) return null;
  const publishedAt = ISO_DATE.test(raw.publishedAt || '') ? raw.publishedAt : null;
  // horário só quando a fonte informa e há data
  const publishedTime = publishedAt && TIME.test(raw.publishedTime || '') ? raw.publishedTime : null;
  return {
    sourceId,
    externalId,
    title,
    url,
    publishedAt,
    publishedTime,
    excerpt: cleanText(raw.excerpt, 2000),
    actType: cleanText(raw.actType, 120),
    organ: cleanText(raw.organ, 300),
  };
}

function sinceFor(status, today) {
  if (status && status.lastSuccessAt) {
    // um dia de sobreposição para não perder publicações do dia da última coleta
    return addDays(localIsoDate(new Date(status.lastSuccessAt)), -1);
  }
  return addDays(today, -BACKFILL_DAYS);
}

async function collectSource(source, ctx) {
  const started = Date.now();
  const result = { sourceId: source.id, status: 'success', fetched: 0, invalid: 0, relevant: 0, newCount: 0, duplicateCount: 0, error: null, durationMs: 0 };
  const fresh = [];
  try {
    const collector = ctx.collectors[source.id];
    if (!collector) throw new Error('Coletor não implementado');
    const rawItems = await collector.collect({
      fetchText: ctx.fetchText,
      fetchJson: ctx.fetchJson,
      today: ctx.today,
      since: sinceFor(ctx.sourceStatus[source.id], ctx.today),
      isKnown: (externalId) => ctx.knownKeys.has(publicationKey(source.id, externalId)),
    });
    result.fetched = rawItems.length;

    for (const raw of rawItems) {
      const item = sanitize(raw, source.id);
      if (!item) {
        result.invalid++;
        continue;
      }
      const classification = classify(item, ctx.enabledSubjects);
      if (!classification.relevant) continue;
      result.relevant++;

      const key = publicationKey(source.id, item.externalId);
      const hash = contentHash(source.id, item.title, item.publishedAt);
      if (ctx.knownKeys.has(key) || ctx.knownHashes.has(hash)) {
        result.duplicateCount++;
        continue;
      }
      ctx.knownKeys.add(key);
      ctx.knownHashes.add(hash);
      const { relevant, ...fields } = classification;
      fresh.push({ id: `pub-${sha1(key).slice(0, 16)}`, ...item, ...fields, hash, collectedAt: new Date().toISOString() });
    }
    result.newCount = fresh.length;
  } catch (err) {
    result.status = 'error';
    result.error = cleanText(err.message, 300) || 'Erro desconhecido';
  }
  result.durationMs = Date.now() - started;
  return { result, fresh };
}

/**
 * Runs one monitoring cycle. Only one cycle runs at a time.
 * @param {{ trigger?: 'manual'|'scheduled'|'cli', requestedBy?: string, store?: object, collectors?: object,
 *   fetchText?: Function, fetchJson?: Function, now?: Date }} [options]
 * @returns {Promise<object>} The finished run record.
 */
async function runMonitoring(options = {}) {
  if (currentRun) throw new MonitorBusyError('Já existe uma execução do monitoramento em andamento');

  const store = options.store || createStore();
  const runId = `run-${Date.now()}`;
  currentRun = runId;
  try {
    const startedAt = new Date().toISOString();
    const snapshot = store.update((data) => {
      // outra execução recente (ex.: `npm run intel:run` em outro processo) ainda em andamento
      if (hasActiveRun(data.runs)) throw new MonitorBusyError('Já existe uma execução do monitoramento em andamento');

      // execuções que ficaram "em execução" (servidor reiniciado no meio) são encerradas como falha
      data.runs.forEach((run) => {
        if (run.status === 'running') {
          run.status = 'failed';
          run.finishedAt = run.finishedAt || startedAt;
          run.error = 'Execução interrompida (servidor reiniciado)';
        }
      });
      data.runs.push({ id: runId, trigger: options.trigger || 'manual', requestedBy: options.requestedBy || null, startedAt, finishedAt: null, status: 'running', newCount: 0, duplicateCount: 0, sources: [] });
      return JSON.parse(JSON.stringify(data));
    });

    const ctx = {
      collectors: options.collectors || defaultCollectors,
      fetchText: options.fetchText || http.fetchText,
      fetchJson: options.fetchJson || http.fetchJson,
      today: localIsoDate(options.now || new Date()),
      sourceStatus: snapshot.sourceStatus,
      enabledSubjects: snapshot.settings.enabledSubjects,
      knownKeys: new Set(snapshot.publications.map((p) => publicationKey(p.sourceId, p.externalId))),
      knownHashes: new Set(snapshot.publications.map((p) => p.hash).filter(Boolean)),
    };

    const enabled = SOURCES.filter((s) => s.collectable && snapshot.settings.enabledSources.includes(s.id));
    // fontes em paralelo e isoladas: a falha de uma não interrompe as demais
    const outcomes = await Promise.all(enabled.map((source) => collectSource(source, ctx)));

    const finishedAt = new Date().toISOString();
    const results = outcomes.map((o) => o.result);
    const failures = results.filter((r) => r.status === 'error').length;
    const status = !results.length ? 'success' : failures === 0 ? 'success' : failures === results.length ? 'failed' : 'partial';

    const run = store.update((data) => {
      const existing = new Set(data.publications.map((p) => publicationKey(p.sourceId, p.externalId)));
      let inserted = 0;
      for (const { fresh } of outcomes) {
        for (const pub of fresh) {
          if (existing.has(publicationKey(pub.sourceId, pub.externalId))) continue;
          data.publications.push(pub);
          inserted++;
        }
      }
      for (const r of results) {
        const previous = data.sourceStatus[r.sourceId] || {};
        data.sourceStatus[r.sourceId] =
          r.status === 'success'
            ? { ...previous, lastSuccessAt: finishedAt, lastError: null, lastErrorAt: previous.lastErrorAt || null }
            : { ...previous, lastError: r.error, lastErrorAt: finishedAt };
      }
      const record = data.runs.find((x) => x.id === runId);
      Object.assign(record, {
        finishedAt,
        status,
        newCount: inserted,
        duplicateCount: results.reduce((sum, r) => sum + r.duplicateCount, 0),
        sources: results,
      });
      data.runs = data.runs.slice(-MAX_RUNS_KEPT);
      return { ...record };
    });

    console.log(`[intelligence] execução ${runId} (${run.trigger}): ${status}, ${run.newCount} nova(s), ${run.duplicateCount} duplicada(s)`);
    results
      .filter((r) => r.status === 'error')
      .forEach((r) => console.warn(`[intelligence] fonte ${r.sourceId} falhou: ${r.error}`));
    return run;
  } finally {
    currentRun = null;
  }
}

/**
 * Re-applies the current classification rules to stored publications.
 * Items that no longer match any monitored subject are removed, unless a user
 * saved them as favorite (those are kept with the updated fields).
 * @returns {{ updated: number, removed: number, keptFavorites: number }}
 */
function reclassifyAll(store = createStore()) {
  if (currentRun) throw new MonitorBusyError('Aguarde o fim da execução em andamento');
  return store.update((data) => {
    const favorited = new Set(data.favorites.map((f) => f.publicationId));
    const result = { updated: 0, removed: 0, keptFavorites: 0 };
    data.publications = data.publications.filter((pub) => {
      const { relevant, ...fields } = classify(pub, data.settings.enabledSubjects);
      if (!relevant && !favorited.has(pub.id)) {
        result.removed++;
        return false;
      }
      if (!relevant) result.keptFavorites++;
      Object.assign(pub, fields);
      result.updated++;
      return true;
    });
    return result;
  });
}

/**
 * True when the run list has a recent run still marked as running
 * (possibly started by another process, such as the CLI).
 */
function hasActiveRun(runs) {
  return runs.some((run) => run.status === 'running' && Date.now() - new Date(run.startedAt).getTime() < RUNNING_STALE_MS);
}

function isRunning() {
  return currentRun !== null;
}

module.exports = { runMonitoring, reclassifyAll, isRunning, hasActiveRun, MonitorBusyError, sanitize, BACKFILL_DAYS };
