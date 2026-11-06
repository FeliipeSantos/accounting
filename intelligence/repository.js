// Data access of the Inteligência Contábil module (tables intel_*).
// Every function takes the database handle, so callers (routes, monitor,
// scheduler, CLI, tests) share the same queries.
const { SOURCES, SUBJECTS } = require('./catalog');
const { normalizeForMatch } = require('./text');
const { transaction } = require('../lib/db');

const REFORM_SUBJECTS = ['reforma-tributaria', 'ibs-cbs', 'imposto-seletivo'];
const MAX_RUNS_KEPT = 200;
// Uma execução "em andamento" mais antiga que isso é considerada interrompida
const RUNNING_STALE_MS = 15 * 60 * 1000;

const collectableIds = () => SOURCES.filter((s) => s.collectable).map((s) => s.id);

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function defaultSettings() {
  const collectable = collectableIds();
  return {
    runTime: '06:00',
    enabledSources: collectable,
    // fontes já vistas: uma fonte coletável fora desta lista é nova no catálogo e entra ativa
    knownSources: collectable,
    enabledSubjects: SUBJECTS.map((s) => s.id),
  };
}

/**
 * Module settings with defaults, sources added to the catalog enabled and
 * sources removed from it dropped.
 */
function getSettings(db) {
  const saved = Object.fromEntries(db.prepare('SELECT key, value FROM intel_settings').all().map((r) => [r.key, JSON.parse(r.value)]));
  const settings = { ...defaultSettings(), ...saved };
  const collectable = collectableIds();
  const known = new Set(saved.knownSources || collectable);
  const added = collectable.filter((id) => !known.has(id));
  if (added.length && saved.enabledSources) settings.enabledSources = [...new Set([...saved.enabledSources, ...added])];
  settings.knownSources = collectable;
  settings.enabledSources = settings.enabledSources.filter((id) => collectable.includes(id));
  return settings;
}

/**
 * Saves the given settings (merged over the current ones) and returns the result.
 */
function saveSettings(db, partial) {
  return transaction(db, () => {
    const next = { ...getSettings(db), ...partial };
    const upsert = db.prepare('INSERT INTO intel_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value');
    for (const key of ['runTime', 'enabledSources', 'knownSources', 'enabledSubjects']) upsert.run(key, JSON.stringify(next[key]));
    return getSettings(db);
  });
}

// ---------------------------------------------------------------------------
// Source status
// ---------------------------------------------------------------------------

/** @returns {Record<string, { lastSuccessAt: string|null, lastError: string|null, lastErrorAt: string|null }>} */
function getSourceStatus(db) {
  return Object.fromEntries(
    db
      .prepare('SELECT source_id, last_success_at, last_error, last_error_at FROM intel_source_status')
      .all()
      .map((r) => [r.source_id, { lastSuccessAt: r.last_success_at, lastError: r.last_error, lastErrorAt: r.last_error_at }])
  );
}

function recordSourceSuccess(db, sourceId, at) {
  db.prepare(
    `INSERT INTO intel_source_status (source_id, last_success_at, last_error) VALUES (?, ?, NULL)
     ON CONFLICT (source_id) DO UPDATE SET last_success_at = excluded.last_success_at, last_error = NULL`
  ).run(sourceId, at);
}

function recordSourceError(db, sourceId, error, at) {
  db.prepare(
    `INSERT INTO intel_source_status (source_id, last_error, last_error_at) VALUES (?, ?, ?)
     ON CONFLICT (source_id) DO UPDATE SET last_error = excluded.last_error, last_error_at = excluded.last_error_at`
  ).run(sourceId, error, at);
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

function rowToRun(r) {
  return {
    id: r.id,
    trigger: r.trigger,
    requestedBy: r.requested_by,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status,
    newCount: r.new_count,
    duplicateCount: r.duplicate_count,
    error: r.error,
    sources: JSON.parse(r.sources),
  };
}

/** Inserts a full run record (used by the monitor, the JSON import and tests). */
function insertRun(db, run) {
  db.prepare(
    `INSERT INTO intel_runs (id, trigger, requested_by, started_at, finished_at, status, new_count, duplicate_count, error, sources)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    run.id,
    run.trigger || 'manual',
    run.requestedBy || null,
    run.startedAt,
    run.finishedAt || null,
    run.status,
    run.newCount || 0,
    run.duplicateCount || 0,
    run.error || null,
    JSON.stringify(run.sources || [])
  );
}

/** True when a run is marked as running and started less than 15 minutes ago (any process). */
function hasActiveRun(db, now = Date.now()) {
  const since = new Date(now - RUNNING_STALE_MS).toISOString();
  return Boolean(db.prepare("SELECT 1 FROM intel_runs WHERE status = 'running' AND started_at > ? LIMIT 1").get(since));
}

/**
 * Atomically checks that no run is active, closes runs left "running" by a
 * restart and records the new run. Returns false when another run is active.
 */
function startRun(db, run) {
  return transaction(db, () => {
    if (hasActiveRun(db)) return false;
    db.prepare(
      `UPDATE intel_runs SET status = 'failed', finished_at = COALESCE(finished_at, ?), error = 'Execução interrompida (servidor reiniciado)'
       WHERE status = 'running'`
    ).run(run.startedAt);
    insertRun(db, { ...run, status: 'running' });
    return true;
  });
}

function finishRun(db, runId, { finishedAt, status, newCount, duplicateCount, sources }) {
  db.prepare('UPDATE intel_runs SET finished_at = ?, status = ?, new_count = ?, duplicate_count = ?, sources = ? WHERE id = ?').run(
    finishedAt,
    status,
    newCount,
    duplicateCount,
    JSON.stringify(sources),
    runId
  );
  db.prepare('DELETE FROM intel_runs WHERE id NOT IN (SELECT id FROM intel_runs ORDER BY started_at DESC LIMIT ?)').run(MAX_RUNS_KEPT);
  return getRun(db, runId);
}

function getRun(db, runId) {
  const row = db.prepare('SELECT * FROM intel_runs WHERE id = ?').get(runId);
  return row ? rowToRun(row) : null;
}

/** Newest first. */
function listRuns(db, limit = 50) {
  return db.prepare('SELECT * FROM intel_runs ORDER BY started_at DESC LIMIT ?').all(limit).map(rowToRun);
}

function lastRun(db) {
  return listRuns(db, 1)[0] || null;
}

/** End time (ms) of the latest finished manual run, or 0. */
function lastManualRunEnd(db) {
  const row = db.prepare("SELECT MAX(finished_at) AS at FROM intel_runs WHERE trigger = 'manual' AND finished_at IS NOT NULL").get();
  return row.at ? new Date(row.at).getTime() : 0;
}

/** Data the scheduler needs: settings and the runs of the last two days, oldest first. */
function scheduleData(db, now = new Date()) {
  const since = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const runs = db.prepare('SELECT * FROM intel_runs WHERE started_at >= ? ORDER BY started_at').all(since).map(rowToRun);
  return { settings: getSettings(db), runs };
}

// ---------------------------------------------------------------------------
// Publications
// ---------------------------------------------------------------------------

function searchText(pub) {
  return normalizeForMatch(`${pub.title} ${pub.excerpt || ''} ${pub.organ || ''}`);
}

function rowToPublication(r) {
  const pub = {
    id: r.id,
    sourceId: r.source_id,
    externalId: r.external_id,
    hash: r.hash,
    title: r.title,
    url: r.url,
    publishedAt: r.published_at,
    publishedTime: r.published_time,
    excerpt: r.excerpt,
    actType: r.act_type,
    organ: r.organ,
    subjects: JSON.parse(r.subjects),
    relevance: r.relevance,
    normType: r.norm_type,
    effectiveDate: r.effective_date,
    collectedAt: r.collected_at,
    runId: r.run_id,
  };
  if (r.classification_reason) pub.classificationReason = JSON.parse(r.classification_reason);
  if (r.favorite !== undefined) pub.favorite = Boolean(r.favorite);
  if (r.favorited_at) pub.favoritedAt = r.favorited_at;
  return pub;
}

function replaceSubjects(db, publicationId, subjects) {
  db.prepare('DELETE FROM intel_publication_subjects WHERE publication_id = ?').run(publicationId);
  const insert = db.prepare('INSERT OR IGNORE INTO intel_publication_subjects (publication_id, subject_id) VALUES (?, ?)');
  for (const subject of subjects || []) insert.run(publicationId, subject);
}

/**
 * Inserts publications, ignoring any already stored for the same source + external id.
 * @returns {number} How many were inserted.
 */
function insertPublications(db, publications) {
  // ON CONFLICT ignora só duplicatas (mesma fonte + id externo); campos obrigatórios
  // ausentes geram erro em vez de sumirem em silêncio (o que OR IGNORE faria)
  const insert = db.prepare(
    `INSERT INTO intel_publications
      (id, source_id, external_id, hash, title, url, published_at, published_time, excerpt, act_type, organ,
       subjects, relevance, norm_type, effective_date, classification_reason, collected_at, run_id, search_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT DO NOTHING`
  );
  return transaction(db, () => {
    let inserted = 0;
    for (const p of publications) {
      const result = insert.run(
        p.id,
        p.sourceId,
        p.externalId,
        p.hash || null,
        p.title,
        p.url,
        p.publishedAt || null,
        p.publishedTime || null,
        p.excerpt || '',
        p.actType || '',
        p.organ || '',
        JSON.stringify(p.subjects || []),
        p.relevance,
        p.normType || null,
        p.effectiveDate || null,
        p.classificationReason ? JSON.stringify(p.classificationReason) : null,
        p.collectedAt,
        p.runId || null,
        searchText(p)
      );
      if (result.changes) {
        replaceSubjects(db, p.id, p.subjects);
        inserted++;
      }
    }
    return inserted;
  });
}

/** Keys ("source:externalId") and content hashes of every stored publication, for de-duplication. */
function knownPublicationKeys(db) {
  const rows = db.prepare('SELECT source_id, external_id, hash FROM intel_publications').all();
  return {
    keys: new Set(rows.map((r) => `${r.source_id}:${r.external_id}`)),
    hashes: new Set(rows.map((r) => r.hash).filter(Boolean)),
  };
}

const ORDER_BY = "COALESCE(p.published_at, '') DESC, COALESCE(p.published_time, '') DESC, p.collected_at DESC";

/**
 * Filtered, paginated list (filters already validated by the caller).
 * @param {{ subjects?: string[], relevance?: string, source?: string, from?: string, to?: string, runId?: string, text?: string }} filters
 * @param {{ limit: number, offset: number, user?: string }} options
 * @returns {{ total: number, items: object[] }}
 */
function listPublications(db, filters, { limit, offset, user = null }) {
  const where = [];
  const params = [];
  if (filters.subjects && filters.subjects.length) {
    where.push(`EXISTS (SELECT 1 FROM intel_publication_subjects s WHERE s.publication_id = p.id AND s.subject_id IN (${filters.subjects.map(() => '?').join(', ')}))`);
    params.push(...filters.subjects);
  }
  if (filters.relevance) {
    where.push('p.relevance = ?');
    params.push(filters.relevance);
  }
  if (filters.source) {
    where.push('p.source_id = ?');
    params.push(filters.source);
  }
  // sem data de publicação: fica fora do filtro "de" e dentro do filtro "até"
  if (filters.from) {
    where.push('p.published_at >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    where.push("COALESCE(p.published_at, '') <= ?");
    params.push(filters.to);
  }
  if (filters.runId) {
    where.push('p.run_id = ?');
    params.push(filters.runId);
  }
  if (filters.text) {
    where.push("p.search_text LIKE ? ESCAPE '\\'");
    params.push(`%${normalizeForMatch(filters.text).replace(/[\\%_]/g, '\\$&')}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM intel_publications p ${whereSql}`).get(...params).n;
  const rows = db
    .prepare(
      `SELECT p.*, (f.username IS NOT NULL) AS favorite
       FROM intel_publications p
       LEFT JOIN intel_favorites f ON f.publication_id = p.id AND f.username = ?
       ${whereSql}
       ORDER BY ${ORDER_BY}
       LIMIT ? OFFSET ?`
    )
    .all(user, ...params, limit, offset);
  return { total, items: rows.map(rowToPublication) };
}

function getPublication(db, id, user = null) {
  const row = db
    .prepare(
      `SELECT p.*, (f.username IS NOT NULL) AS favorite FROM intel_publications p
       LEFT JOIN intel_favorites f ON f.publication_id = p.id AND f.username = ?
       WHERE p.id = ?`
    )
    .get(user, id);
  return row ? rowToPublication(row) : null;
}

/** Counts per subject id. */
function countBySubject(db) {
  return Object.fromEntries(db.prepare('SELECT subject_id, COUNT(*) AS n FROM intel_publication_subjects GROUP BY subject_id').all().map((r) => [r.subject_id, r.n]));
}

/** Counts per source id. */
function countBySource(db) {
  return Object.fromEntries(db.prepare('SELECT source_id, COUNT(*) AS n FROM intel_publications GROUP BY source_id').all().map((r) => [r.source_id, r.n]));
}

/** Dashboard totals. */
function totals(db, recentFrom) {
  return {
    publications: db.prepare('SELECT COUNT(*) AS n FROM intel_publications').get().n,
    critical: db.prepare("SELECT COUNT(*) AS n FROM intel_publications WHERE relevance = 'critica'").get().n,
    recent: db.prepare('SELECT COUNT(*) AS n FROM intel_publications WHERE published_at >= ?').get(recentFrom).n,
    reform: db
      .prepare(`SELECT COUNT(DISTINCT publication_id) AS n FROM intel_publication_subjects WHERE subject_id IN (${REFORM_SUBJECTS.map(() => '?').join(', ')})`)
      .get(...REFORM_SUBJECTS).n,
  };
}

/**
 * Re-applies a classification function to every stored publication. Items no
 * longer relevant are removed unless someone saved them as favorite.
 * @param {(pub: object) => { relevant: boolean }} classifyFn
 */
function reclassifyPublications(db, classifyFn) {
  return transaction(db, () => {
    const favorited = new Set(db.prepare('SELECT DISTINCT publication_id FROM intel_favorites').all().map((r) => r.publication_id));
    const update = db.prepare(
      'UPDATE intel_publications SET subjects = ?, relevance = ?, norm_type = ?, effective_date = ?, classification_reason = ? WHERE id = ?'
    );
    const remove = db.prepare('DELETE FROM intel_publications WHERE id = ?');
    const result = { updated: 0, removed: 0, keptFavorites: 0 };
    for (const row of db.prepare('SELECT * FROM intel_publications').all()) {
      const pub = rowToPublication(row);
      const { relevant, ...fields } = classifyFn(pub);
      if (!relevant && !favorited.has(pub.id)) {
        remove.run(pub.id);
        result.removed++;
        continue;
      }
      if (!relevant) result.keptFavorites++;
      update.run(JSON.stringify(fields.subjects), fields.relevance, fields.normType || null, fields.effectiveDate || null, JSON.stringify(fields.classificationReason || null), pub.id);
      replaceSubjects(db, pub.id, fields.subjects);
      result.updated++;
    }
    return result;
  });
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

/** User favorites, newest first. */
function listFavorites(db, user) {
  return db
    .prepare(
      `SELECT p.*, 1 AS favorite, f.created_at AS favorited_at
       FROM intel_favorites f JOIN intel_publications p ON p.id = f.publication_id
       WHERE f.username = ? ORDER BY f.created_at DESC`
    )
    .all(user)
    .map(rowToPublication);
}

/** @returns {'created'|'exists'|'missing'} */
function addFavorite(db, user, publicationId, createdAt = new Date().toISOString()) {
  if (!db.prepare('SELECT 1 FROM intel_publications WHERE id = ?').get(publicationId)) return 'missing';
  const result = db.prepare('INSERT OR IGNORE INTO intel_favorites (username, publication_id, created_at) VALUES (?, ?, ?)').run(user, publicationId, createdAt);
  return result.changes ? 'created' : 'exists';
}

function removeFavorite(db, user, publicationId) {
  db.prepare('DELETE FROM intel_favorites WHERE username = ? AND publication_id = ?').run(user, publicationId);
}

module.exports = {
  REFORM_SUBJECTS,
  getSettings,
  saveSettings,
  getSourceStatus,
  recordSourceSuccess,
  recordSourceError,
  insertRun,
  hasActiveRun,
  startRun,
  finishRun,
  getRun,
  listRuns,
  lastRun,
  lastManualRunEnd,
  scheduleData,
  insertPublications,
  knownPublicationKeys,
  listPublications,
  getPublication,
  countBySubject,
  countBySource,
  totals,
  reclassifyPublications,
  listFavorites,
  addFavorite,
  removeFavorite,
};
