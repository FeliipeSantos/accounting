// Single SQLite database for the whole system (node:sqlite, no dependencies).
// Each module owns its tables (prefix "<module>_") and its own ordered migrations,
// registered in lib/migrations/index.js. Applied migrations are tracked in
// schema_migrations, so adding a module never touches the others.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DEFAULT_PATH = path.join(__dirname, '..', 'data', 'app.db');

/**
 * Opens (creating if needed) the database file with the project defaults.
 * @param {string} [file]
 * @returns {DatabaseSync}
 */
function openDatabase(file = process.env.DB_PATH || DEFAULT_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  // WAL: leituras e gravações simultâneas (servidor + comandos de terminal)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = NORMAL;
  `);
  db.filePath = file;
  return db;
}

/**
 * Runs fn inside a transaction (all or nothing). Nested calls join the outer one.
 * @template T
 * @param {DatabaseSync} db
 * @param {() => T} fn
 * @returns {T}
 */
function transaction(db, fn) {
  if (db.isTransaction) return fn();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Applies pending migrations of every module, each one in its own transaction.
 * @param {DatabaseSync} db
 * @param {{ name: string, migrations: { version: number, name: string, up: (db: DatabaseSync) => void }[] }[]} modules
 * @returns {string[]} Migrations applied now, as "module@version name".
 */
function migrate(db, modules) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      module     TEXT    NOT NULL,
      version    INTEGER NOT NULL,
      name       TEXT    NOT NULL,
      applied_at TEXT    NOT NULL,
      PRIMARY KEY (module, version)
    )
  `);
  const applied = [];
  for (const mod of modules) {
    const versions = mod.migrations.map((m) => m.version);
    if (new Set(versions).size !== versions.length) throw new Error(`Migrations duplicadas no módulo ${mod.name}`);
    const done = new Set(db.prepare('SELECT version FROM schema_migrations WHERE module = ?').all(mod.name).map((r) => r.version));
    for (const migration of [...mod.migrations].sort((a, b) => a.version - b.version)) {
      if (done.has(migration.version)) continue;
      transaction(db, () => {
        migration.up(db);
        db.prepare('INSERT INTO schema_migrations (module, version, name, applied_at) VALUES (?, ?, ?, ?)').run(
          mod.name,
          migration.version,
          migration.name,
          new Date().toISOString()
        );
      });
      applied.push(`${mod.name}@${migration.version} ${migration.name}`);
    }
  }
  return applied;
}

let shared = null;

/**
 * The process-wide database, opened and migrated on first use.
 * @returns {DatabaseSync}
 */
function getDatabase() {
  if (!shared) {
    shared = openDatabase();
    const applied = migrate(shared, require('./migrations').MODULES);
    if (applied.length) console.log(`[db] migrations aplicadas: ${applied.join(', ')}`);
  }
  return shared;
}

module.exports = { openDatabase, transaction, migrate, getDatabase };
