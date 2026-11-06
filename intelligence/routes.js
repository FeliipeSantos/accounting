// HTTP routes of the Inteligência Contábil module, mounted at /api/intelligence.
const { SOURCES, SUBJECTS, RELEVANCE_LEVELS } = require('./catalog');
const { createStore } = require('./store');
const { RULES_DESCRIPTION } = require('./classifier');
const monitor = require('./monitor');
const scheduler = require('./scheduler');
const { normalizeForMatch } = require('./text');

const PREFIX = '/api/intelligence';
const MAX_BODY_BYTES = 100 * 1024;
const USER_PATTERN = /^[\w.@-]{1,64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const REFORM_SUBJECTS = ['reforma-tributaria', 'ibs-cbs', 'imposto-seletivo'];
const RECENT_DAYS = 7;
// Intervalo mínimo entre execuções manuais (evita sobrecarregar os sites oficiais)
const MANUAL_RUN_COOLDOWN_MS = 60 * 1000;

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = '';
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload muito grande'), { status: 413 }));
        req.destroy();
        return;
      }
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(Object.assign(new Error('JSON inválido'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/**
 * User of the server-side session, set by server.js after validating the session
 * cookie. Never taken from request headers (those can be forged).
 */
function getUser(req) {
  const user = req.authUser;
  return typeof user === 'string' && USER_PATTERN.test(user) ? user : null;
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function sortByDateDesc(items) {
  return [...items].sort(
    (a, b) =>
      (b.publishedAt || '').localeCompare(a.publishedAt || '') ||
      (b.publishedTime || '').localeCompare(a.publishedTime || '') ||
      (b.collectedAt || '').localeCompare(a.collectedAt || '')
  );
}

function favoriteIdsFor(data, user) {
  if (!user) return new Set();
  return new Set(data.favorites.filter((f) => f.userId === user).map((f) => f.publicationId));
}

function withFavoriteFlag(items, favoriteIds) {
  return items.map((p) => ({ ...p, favorite: favoriteIds.has(p.id) }));
}

/**
 * Validates and applies list filters from the query string.
 * @returns {{ error?: string, items?: object[] }}
 */
/**
 * Collection window of a run: publications stored by it have collectedAt inside it.
 */
function runWindow(run) {
  const start = new Date(run.startedAt).getTime();
  const end = new Date(run.finishedAt || Date.now()).getTime() + 1000;
  return (p) => {
    const t = new Date(p.collectedAt).getTime();
    return t >= start && t <= end;
  };
}

/**
 * @param {object[]} publications
 * @param {URLSearchParams} query subject (one id or comma-separated list, any of), relevance,
 *   source, from/to (yyyy-mm-dd), run (run id), q (text, accent-insensitive).
 * @param {object[]} runs
 */
function filterPublications(publications, query, runs = []) {
  const subjects = (query.get('subject') || '').split(',').filter(Boolean);
  const relevance = query.get('relevance');
  const source = query.get('source');
  const from = query.get('from');
  const to = query.get('to');
  const runId = query.get('run');
  const text = normalizeForMatch((query.get('q') || '').trim());

  if (subjects.some((id) => !SUBJECTS.some((s) => s.id === id))) return { error: 'Assunto inválido' };
  if (relevance && !RELEVANCE_LEVELS.includes(relevance)) return { error: 'Relevância inválida' };
  if (source && !SOURCES.some((s) => s.id === source)) return { error: 'Fonte inválida' };
  if ((from && !DATE_PATTERN.test(from)) || (to && !DATE_PATTERN.test(to))) return { error: 'Período inválido' };
  const run = runId ? runs.find((r) => r.id === runId) : null;
  if (runId && !run) return { error: 'Execução não encontrada' };
  const inRun = run ? runWindow(run) : null;

  const items = publications.filter((p) => {
    if (subjects.length && !subjects.some((id) => (p.subjects || []).includes(id))) return false;
    if (relevance && p.relevance !== relevance) return false;
    if (source && p.sourceId !== source) return false;
    if (from && (p.publishedAt || '') < from) return false;
    if (to && (p.publishedAt || '') > to) return false;
    if (inRun && !inRun(p)) return false;
    if (text && !normalizeForMatch(`${p.title} ${p.excerpt || ''} ${p.organ || ''}`).includes(text)) return false;
    return true;
  });
  return { items };
}

function parsePaging(query) {
  const limit = Math.min(Math.max(parseInt(query.get('limit'), 10) || 50, 1), 200);
  const offset = Math.max(parseInt(query.get('offset'), 10) || 0, 0);
  return { limit, offset };
}

function buildSummary(data, user) {
  const pubs = data.publications;
  const recentFrom = isoDaysAgo(RECENT_DAYS);
  const recent = sortByDateDesc(pubs.filter((p) => (p.publishedAt || '') >= recentFrom));
  const byCategory = SUBJECTS.map((s) => ({
    id: s.id,
    name: s.name,
    count: pubs.filter((p) => (p.subjects || []).includes(s.id)).length,
  }));

  return {
    totals: {
      publications: pubs.length,
      critical: pubs.filter((p) => p.relevance === 'critica').length,
      recent: recent.length,
      reform: pubs.filter((p) => (p.subjects || []).some((s) => REFORM_SUBJECTS.includes(s))).length,
    },
    recentDays: RECENT_DAYS,
    byCategory,
    recentItems: withFavoriteFlag(recent.slice(0, 6), favoriteIdsFor(data, user)),
    lastRun: data.runs.length ? data.runs[data.runs.length - 1] : null,
    ...scheduleInfo(data),
  };
}

/** Next automatic run, or null when the scheduler is turned off. */
function scheduleInfo(data) {
  const enabled = scheduler.isSchedulerEnabled();
  return { schedulerEnabled: enabled, nextRunAt: enabled ? scheduler.computeNextRunAt(data) : null };
}

/** Hides internal bookkeeping fields from API responses. */
function publicSettings({ knownSources, ...settings }) {
  return settings;
}

function validateSettings(body) {
  const collectable = new Set(SOURCES.filter((s) => s.collectable).map((s) => s.id));
  const subjects = new Set(SUBJECTS.map((s) => s.id));
  const next = {};

  if (body.runTime !== undefined) {
    if (typeof body.runTime !== 'string' || !TIME_PATTERN.test(body.runTime)) return { error: 'Horário inválido (use HH:MM)' };
    next.runTime = body.runTime;
  }
  if (body.enabledSources !== undefined) {
    if (!Array.isArray(body.enabledSources) || !body.enabledSources.every((id) => collectable.has(id))) {
      return { error: 'Lista de fontes inválida' };
    }
    next.enabledSources = [...new Set(body.enabledSources)];
  }
  if (body.enabledSubjects !== undefined) {
    if (!Array.isArray(body.enabledSubjects) || !body.enabledSubjects.every((id) => subjects.has(id))) {
      return { error: 'Lista de assuntos inválida' };
    }
    next.enabledSubjects = [...new Set(body.enabledSubjects)];
  }
  return { settings: next };
}

function lastManualRunEnd(runs) {
  const manual = runs.filter((r) => r.trigger === 'manual' && r.finishedAt);
  return manual.length ? new Date(manual[manual.length - 1].finishedAt).getTime() : 0;
}

/**
 * Builds the /api/intelligence request handler.
 * @param {{ store: ReturnType<typeof createStore>, monitor: { runMonitoring: Function, isRunning: Function } }} deps
 */
function createIntelligenceHandler({ store, monitor: mon }) {
  return (req, res) => handle(req, res, store, mon);
}

async function handle(req, res, store, mon) {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname.slice(PREFIX.length) || '/';
  const user = getUser(req);

  try {
    // Toda rota do módulo exige o usuário da sessão atual
    if (!user) {
      sendJson(res, 401, { error: 'Usuário não identificado' });
      return;
    }

    if (req.method === 'GET' && route === '/summary') {
      sendJson(res, 200, buildSummary(store.read(), user));
      return;
    }

    if (req.method === 'GET' && route === '/publications') {
      const data = store.read();
      const { error, items } = filterPublications(data.publications, url.searchParams, data.runs);
      if (error) {
        sendJson(res, 400, { error });
        return;
      }
      const { limit, offset } = parsePaging(url.searchParams);
      const sorted = sortByDateDesc(items);
      sendJson(res, 200, {
        total: sorted.length,
        items: withFavoriteFlag(sorted.slice(offset, offset + limit), favoriteIdsFor(data, user)),
      });
      return;
    }

    const detailMatch = route.match(/^\/publications\/([\w-]{1,128})$/);
    if (req.method === 'GET' && detailMatch) {
      const data = store.read();
      const pub = data.publications.find((p) => p.id === detailMatch[1]);
      if (!pub) {
        sendJson(res, 404, { error: 'Publicação não encontrada' });
        return;
      }
      sendJson(res, 200, withFavoriteFlag([pub], favoriteIdsFor(data, user))[0]);
      return;
    }

    if (req.method === 'GET' && route === '/subjects') {
      const data = store.read();
      sendJson(
        res,
        200,
        SUBJECTS.map((s) => ({
          id: s.id,
          name: s.name,
          keywords: s.keywords,
          enabled: data.settings.enabledSubjects.includes(s.id),
          count: data.publications.filter((p) => (p.subjects || []).includes(s.id)).length,
        }))
      );
      return;
    }

    if (req.method === 'GET' && route === '/sources') {
      const data = store.read();
      sendJson(
        res,
        200,
        SOURCES.map((s) => ({
          ...s,
          enabled: data.settings.enabledSources.includes(s.id),
          status: data.sourceStatus[s.id] || null,
          count: data.publications.filter((p) => p.sourceId === s.id).length,
        }))
      );
      return;
    }

    if (req.method === 'GET' && route === '/rules') {
      sendJson(res, 200, RULES_DESCRIPTION);
      return;
    }

    if (req.method === 'GET' && route === '/status') {
      const data = store.read();
      const runs = data.runs;
      sendJson(res, 200, { running: mon.isRunning() || monitor.hasActiveRun(runs), lastRun: runs.length ? runs[runs.length - 1] : null, ...scheduleInfo(data) });
      return;
    }

    if (req.method === 'POST' && route === '/runs') {
      const runs = store.read().runs;
      if (mon.isRunning() || monitor.hasActiveRun(runs)) {
        sendJson(res, 409, { error: 'Já existe uma coleta em andamento' });
        return;
      }
      const wait = lastManualRunEnd(runs) + MANUAL_RUN_COOLDOWN_MS - Date.now();
      if (wait > 0) {
        sendJson(res, 429, { error: `Aguarde ${Math.ceil(wait / 1000)} s para executar novamente` });
        return;
      }
      // roda em segundo plano; a tela acompanha pelo GET /status
      mon.runMonitoring({ trigger: 'manual', store, requestedBy: user }).catch((err) => {
        console.error('[intelligence] falha na execução manual:', err.message);
      });
      sendJson(res, 202, { started: true });
      return;
    }

    if (req.method === 'GET' && route === '/runs') {
      const runs = store.read().runs;
      sendJson(res, 200, runs.slice(-50).reverse());
      return;
    }

    if (route === '/settings') {
      if (req.method === 'GET') {
        sendJson(res, 200, publicSettings(store.read().settings));
        return;
      }
      if (req.method === 'PUT') {
        const body = await readJsonBody(req);
        const { error, settings } = validateSettings(body);
        if (error) {
          sendJson(res, 400, { error });
          return;
        }
        const saved = store.update((data) => {
          data.settings = { ...data.settings, ...settings };
          return data.settings;
        });
        sendJson(res, 200, publicSettings(saved));
        return;
      }
    }

    if (route === '/favorites') {
      if (req.method === 'GET') {
        const data = store.read();
        const mine = data.favorites.filter((f) => f.userId === user);
        const byId = new Map(data.publications.map((p) => [p.id, p]));
        const items = mine
          .filter((f) => byId.has(f.publicationId))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((f) => ({ ...byId.get(f.publicationId), favorite: true, favoritedAt: f.createdAt }));
        sendJson(res, 200, items);
        return;
      }
      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const publicationId = typeof body.publicationId === 'string' ? body.publicationId : '';
        const result = store.update((data) => {
          if (!data.publications.some((p) => p.id === publicationId)) return 'missing';
          if (data.favorites.some((f) => f.userId === user && f.publicationId === publicationId)) return 'exists';
          data.favorites.push({ userId: user, publicationId, createdAt: new Date().toISOString() });
          return 'created';
        });
        if (result === 'missing') {
          sendJson(res, 404, { error: 'Publicação não encontrada' });
          return;
        }
        sendJson(res, result === 'created' ? 201 : 200, { publicationId, favorite: true });
        return;
      }
    }

    const favMatch = route.match(/^\/favorites\/([\w-]{1,128})$/);
    if (req.method === 'DELETE' && favMatch) {
      const publicationId = favMatch[1];
      store.update((data) => {
        data.favorites = data.favorites.filter((f) => !(f.userId === user && f.publicationId === publicationId));
      });
      sendJson(res, 200, { publicationId, favorite: false });
      return;
    }

    sendJson(res, 404, { error: 'Rota não encontrada' });
  } catch (err) {
    if (err.status) {
      sendJson(res, err.status, { error: err.message });
      return;
    }
    console.error('[intelligence] erro na rota', req.method, url.pathname, err);
    sendJson(res, 500, { error: 'Erro interno do módulo Inteligência Contábil' });
  }
}

const handleIntelligenceRequest = createIntelligenceHandler({ store: createStore(), monitor });

module.exports = { PREFIX, handleIntelligenceRequest, createIntelligenceHandler, MANUAL_RUN_COOLDOWN_MS };
