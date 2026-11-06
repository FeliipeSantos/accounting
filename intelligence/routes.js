// HTTP routes of the Inteligência Contábil module, mounted at /api/intelligence.
const { SOURCES, SUBJECTS, RELEVANCE_LEVELS } = require('./catalog');
const { RULES_DESCRIPTION } = require('./classifier');
const repo = require('./repository');
const monitor = require('./monitor');
const scheduler = require('./scheduler');
const { getDatabase } = require('../lib/db');

const PREFIX = '/api/intelligence';
const MAX_BODY_BYTES = 100 * 1024;
const USER_PATTERN = /^[\w.@-]{1,64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
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

/**
 * Validates list filters from the query string.
 * @param {URLSearchParams} query subject (one id or comma-separated list, any of), relevance,
 *   source, from/to (yyyy-mm-dd), run (run id), q (text, accent-insensitive).
 * @returns {{ error?: string, filters?: object }}
 */
function parseFilters(db, query) {
  const subjects = (query.get('subject') || '').split(',').filter(Boolean);
  const relevance = query.get('relevance');
  const source = query.get('source');
  const from = query.get('from');
  const to = query.get('to');
  const runId = query.get('run');
  const text = (query.get('q') || '').trim();

  if (subjects.some((id) => !SUBJECTS.some((s) => s.id === id))) return { error: 'Assunto inválido' };
  if (relevance && !RELEVANCE_LEVELS.includes(relevance)) return { error: 'Relevância inválida' };
  if (source && !SOURCES.some((s) => s.id === source)) return { error: 'Fonte inválida' };
  if ((from && !DATE_PATTERN.test(from)) || (to && !DATE_PATTERN.test(to))) return { error: 'Período inválido' };
  if (runId && !repo.getRun(db, runId)) return { error: 'Execução não encontrada' };
  return { filters: { subjects, relevance, source, from, to, runId, text } };
}

function parsePaging(query) {
  const limit = Math.min(Math.max(parseInt(query.get('limit'), 10) || 50, 1), 200);
  const offset = Math.max(parseInt(query.get('offset'), 10) || 0, 0);
  return { limit, offset };
}

/** Next automatic run, or null when the scheduler is turned off. */
function scheduleInfo(db) {
  const enabled = scheduler.isSchedulerEnabled();
  return { schedulerEnabled: enabled, nextRunAt: enabled ? scheduler.computeNextRunAt(repo.scheduleData(db)) : null };
}

function buildSummary(db, user) {
  const recentFrom = isoDaysAgo(RECENT_DAYS);
  const counts = repo.countBySubject(db);
  return {
    totals: repo.totals(db, recentFrom),
    recentDays: RECENT_DAYS,
    byCategory: SUBJECTS.map((s) => ({ id: s.id, name: s.name, count: counts[s.id] || 0 })),
    recentItems: repo.listPublications(db, { from: recentFrom }, { limit: 6, offset: 0, user }).items,
    lastRun: repo.lastRun(db),
    ...scheduleInfo(db),
  };
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

/**
 * Builds the /api/intelligence request handler.
 * @param {{ db: import('node:sqlite').DatabaseSync, monitor: { runMonitoring: Function, isRunning: Function } }} deps
 */
function createIntelligenceHandler({ db, monitor: mon }) {
  return (req, res) => handle(req, res, db, mon);
}

async function handle(req, res, db, mon) {
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
      sendJson(res, 200, buildSummary(db, user));
      return;
    }

    if (req.method === 'GET' && route === '/publications') {
      const { error, filters } = parseFilters(db, url.searchParams);
      if (error) {
        sendJson(res, 400, { error });
        return;
      }
      sendJson(res, 200, repo.listPublications(db, filters, { ...parsePaging(url.searchParams), user }));
      return;
    }

    const detailMatch = route.match(/^\/publications\/([\w-]{1,128})$/);
    if (req.method === 'GET' && detailMatch) {
      const pub = repo.getPublication(db, detailMatch[1], user);
      if (!pub) {
        sendJson(res, 404, { error: 'Publicação não encontrada' });
        return;
      }
      sendJson(res, 200, pub);
      return;
    }

    if (req.method === 'GET' && route === '/subjects') {
      const settings = repo.getSettings(db);
      const counts = repo.countBySubject(db);
      sendJson(
        res,
        200,
        SUBJECTS.map((s) => ({ id: s.id, name: s.name, keywords: s.keywords, enabled: settings.enabledSubjects.includes(s.id), count: counts[s.id] || 0 }))
      );
      return;
    }

    if (req.method === 'GET' && route === '/sources') {
      const settings = repo.getSettings(db);
      const status = repo.getSourceStatus(db);
      const counts = repo.countBySource(db);
      sendJson(
        res,
        200,
        SOURCES.map((s) => ({ ...s, enabled: settings.enabledSources.includes(s.id), status: status[s.id] || null, count: counts[s.id] || 0 }))
      );
      return;
    }

    if (req.method === 'GET' && route === '/rules') {
      sendJson(res, 200, RULES_DESCRIPTION);
      return;
    }

    if (req.method === 'GET' && route === '/status') {
      sendJson(res, 200, { running: mon.isRunning() || repo.hasActiveRun(db), lastRun: repo.lastRun(db), ...scheduleInfo(db) });
      return;
    }

    if (req.method === 'POST' && route === '/runs') {
      if (mon.isRunning() || repo.hasActiveRun(db)) {
        sendJson(res, 409, { error: 'Já existe uma coleta em andamento' });
        return;
      }
      const wait = repo.lastManualRunEnd(db) + MANUAL_RUN_COOLDOWN_MS - Date.now();
      if (wait > 0) {
        sendJson(res, 429, { error: `Aguarde ${Math.ceil(wait / 1000)} s para executar novamente` });
        return;
      }
      // roda em segundo plano; a tela acompanha pelo GET /status
      mon.runMonitoring({ trigger: 'manual', db, requestedBy: user }).catch((err) => {
        console.error('[intelligence] falha na execução manual:', err.message);
      });
      sendJson(res, 202, { started: true });
      return;
    }

    if (req.method === 'GET' && route === '/runs') {
      sendJson(res, 200, repo.listRuns(db, 50));
      return;
    }

    if (route === '/settings') {
      if (req.method === 'GET') {
        sendJson(res, 200, publicSettings(repo.getSettings(db)));
        return;
      }
      if (req.method === 'PUT') {
        const body = await readJsonBody(req);
        const { error, settings } = validateSettings(body);
        if (error) {
          sendJson(res, 400, { error });
          return;
        }
        sendJson(res, 200, publicSettings(repo.saveSettings(db, settings)));
        return;
      }
    }

    if (route === '/favorites') {
      if (req.method === 'GET') {
        sendJson(res, 200, repo.listFavorites(db, user));
        return;
      }
      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        const publicationId = typeof body.publicationId === 'string' ? body.publicationId : '';
        const result = repo.addFavorite(db, user, publicationId);
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
      repo.removeFavorite(db, user, favMatch[1]);
      sendJson(res, 200, { publicationId: favMatch[1], favorite: false });
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

let defaultHandler = null;

/** Handler bound to the process database (created on first request). */
function handleIntelligenceRequest(req, res) {
  if (!defaultHandler) defaultHandler = createIntelligenceHandler({ db: getDatabase(), monitor });
  return defaultHandler(req, res);
}

module.exports = { PREFIX, handleIntelligenceRequest, createIntelligenceHandler, MANUAL_RUN_COOLDOWN_MS };
