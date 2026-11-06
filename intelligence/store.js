// JSON file store for the Inteligência Contábil module.
// Kept apart from db.json because POST /api/projects overwrites that whole file.
const fs = require('fs');
const path = require('path');
const { SOURCES, SUBJECTS } = require('./catalog');

const DEFAULT_FILE = path.join(__dirname, '..', 'intelligence-db.json');

// Collectable sources of the first catalog, which saved settings without knownSources.
const LEGACY_KNOWN_SOURCES = ['dou', 'receita', 'fazenda', 'confaz', 'sped', 'esocial'];

/**
 * Builds the initial content of a fresh module database.
 */
function getDefaultData() {
  const collectable = SOURCES.filter((s) => s.collectable).map((s) => s.id);
  return {
    version: 1,
    settings: {
      runTime: '06:00',
      enabledSources: collectable,
      // Sources the user has already seen; any collectable source outside this
      // list was added to the catalog later and starts enabled.
      knownSources: collectable,
      enabledSubjects: SUBJECTS.map((s) => s.id),
    },
    sourceStatus: {},
    publications: [],
    favorites: [],
    runs: [],
  };
}

/**
 * Fills keys missing from an older or partial file with defaults.
 */
function normalize(data) {
  const defaults = getDefaultData();
  const result = { ...defaults, ...data };
  result.settings = { ...defaults.settings, ...(data.settings || {}) };

  // Fontes que viraram coletáveis depois do último salvamento entram ativas
  const saved = data.settings || {};
  const known = new Set(saved.knownSources || LEGACY_KNOWN_SOURCES);
  const collectable = SOURCES.filter((s) => s.collectable).map((s) => s.id);
  const added = collectable.filter((id) => !known.has(id));
  if (added.length && saved.enabledSources) {
    result.settings.enabledSources = [...new Set([...saved.enabledSources, ...added])];
  }
  result.settings.knownSources = collectable;
  // remove fontes que deixaram de existir ou de ser coletáveis
  result.settings.enabledSources = result.settings.enabledSources.filter((id) => collectable.includes(id));
  for (const key of ['publications', 'favorites', 'runs']) {
    if (!Array.isArray(result[key])) result[key] = [];
  }
  if (!result.sourceStatus || typeof result.sourceStatus !== 'object') result.sourceStatus = {};
  return result;
}

/**
 * Creates a store bound to a JSON file. All IO is synchronous, so each
 * read-modify-write runs atomically inside the single Node process.
 *
 * @param {string} [filePath]
 */
function createStore(filePath = process.env.INTEL_DB_FILE || DEFAULT_FILE) {
  function read() {
    if (!fs.existsSync(filePath)) {
      const initial = getDefaultData();
      write(initial);
      return initial;
    }
    return normalize(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  }

  function write(data) {
    // Escrita atômica: grava em arquivo temporário e renomeia
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  }

  /**
   * Applies a mutation and persists it.
   * @template T
   * @param {(data: ReturnType<typeof getDefaultData>) => T} mutator
   * @returns {T}
   */
  function update(mutator) {
    const data = read();
    const result = mutator(data);
    write(data);
    return result;
  }

  return { filePath, read, update };
}

module.exports = { createStore, getDefaultData };
