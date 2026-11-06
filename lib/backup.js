// Database backups: consistent copies taken with the system running (VACUUM INTO),
// one per day automatically, keeping the most recent ones.
//   npm run db:backup   -> takes a backup now
const fs = require('fs');
const path = require('path');

const FILE_PATTERN = /^app-(\d{4}-\d{2}-\d{2})_\d{6}\.db$/;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function backupDir(db, env = process.env) {
  return env.BACKUP_DIR || path.join(path.dirname(db.filePath), 'backups');
}

function keepCount(env = process.env) {
  return Math.max(Number(env.BACKUP_KEEP) || 7, 1);
}

function localStamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return {
    day: `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`,
    time: `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`,
  };
}

/** Backup files, oldest first. */
function listBackups(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => FILE_PATTERN.test(f))
    .sort();
}

/**
 * Writes a consistent copy of the database and removes the oldest beyond the limit.
 * @returns {string} Path of the new backup.
 */
function createBackup(db, { dir = backupDir(db), keep = keepCount(), now = new Date() } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const { day, time } = localStamp(now);
  const file = path.join(dir, `app-${day}_${time}.db`);
  db.prepare('VACUUM INTO ?').run(file);
  const all = listBackups(dir);
  all.slice(0, Math.max(all.length - keep, 0)).forEach((f) => fs.rmSync(path.join(dir, f)));
  return file;
}

/**
 * Takes one backup per day (on start and hourly checks). Returns a handle to stop it.
 */
function startBackupSchedule(db, { dir = backupDir(db), keep = keepCount(), log = console } = {}) {
  function check() {
    try {
      const today = localStamp().day;
      if (listBackups(dir).some((f) => f.startsWith(`app-${today}_`))) return;
      const file = createBackup(db, { dir, keep });
      log.log(`[backup] cópia do banco criada: ${file}`);
    } catch (err) {
      log.error(`[backup] falha ao criar cópia do banco: ${err.message}`);
    }
  }
  check();
  const timer = setInterval(check, CHECK_INTERVAL_MS);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}

module.exports = { createBackup, startBackupSchedule, listBackups, backupDir };

if (require.main === module) {
  const { getDatabase } = require('./db');
  try {
    console.log(`Cópia criada: ${createBackup(getDatabase())}`);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
