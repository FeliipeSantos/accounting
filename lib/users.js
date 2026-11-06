// User accounts stored in the database (table core_users).
const crypto = require('crypto');

const SCRYPT_KEYLEN = 64;
const USER_PATTERN = /^[\w.@-]{1,64}$/;
const MIN_PASSWORD_LENGTH = 10;

/**
 * Hashes a password as "scrypt$<salt>$<hash>" (base64url).
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

/**
 * Constant-time check of a password against a stored hash.
 */
function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'base64url');
  const expected = Buffer.from(parts[2], 'base64url');
  const actual = crypto.scryptSync(String(password), salt, expected.length || SCRYPT_KEYLEN);
  return expected.length > 0 && crypto.timingSafeEqual(actual, expected);
}

function assertValidUsername(username) {
  if (typeof username !== 'string' || !USER_PATTERN.test(username)) {
    throw new Error('Usuário inválido: use até 64 caracteres entre letras, números, ".", "_", "-" e "@".');
  }
}

function assertStrongPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Senha muito curta: use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
}

function countUsers(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM core_users').get().n;
}

function listUsers(db) {
  return db.prepare('SELECT username, created_at, updated_at FROM core_users ORDER BY username').all();
}

/** @returns {string|null} Stored password hash, or null when the user does not exist. */
function getPasswordHash(db, username) {
  const row = db.prepare('SELECT password_hash FROM core_users WHERE username = ?').get(username);
  return row ? row.password_hash : null;
}

/**
 * Creates a user (weak passwords only for the development admin).
 * @param {{ password: string, allowWeakPassword?: boolean }} credentials
 */
function createUser(db, username, { password, allowWeakPassword = false }) {
  assertValidUsername(username);
  if (!allowWeakPassword) assertStrongPassword(password);
  if (getPasswordHash(db, username)) throw new Error(`O usuário "${username}" já existe.`);
  const now = new Date().toISOString();
  db.prepare('INSERT INTO core_users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    username,
    hashPassword(password),
    now,
    now
  );
}

/**
 * Changes the password and ends every open session of the user.
 */
function setPassword(db, username, password) {
  assertStrongPassword(password);
  const result = db.prepare('UPDATE core_users SET password_hash = ?, updated_at = ? WHERE username = ?').run(hashPassword(password), new Date().toISOString(), username);
  if (!result.changes) throw new Error(`O usuário "${username}" não existe.`);
  db.prepare('DELETE FROM core_sessions WHERE username = ?').run(username);
}

/**
 * Removes the user; their sessions go with them (ON DELETE CASCADE).
 */
function removeUser(db, username) {
  const result = db.prepare('DELETE FROM core_users WHERE username = ?').run(username);
  if (!result.changes) throw new Error(`O usuário "${username}" não existe.`);
}

/**
 * Guarantees at least one user: development gets admin/admin, production refuses
 * to start (and also refuses a database that still has the development admin/admin).
 * @returns {string} What was done, for the startup log.
 */
function ensureUsers(db, env = process.env, log = console) {
  if (countUsers(db)) {
    // banco copiado do desenvolvimento: o admin/admin local não pode ir para produção
    if (env.NODE_ENV === 'production' && verifyPassword('admin', getPasswordHash(db, 'admin'))) {
      throw new Error('O usuário de desenvolvimento admin/admin existe neste banco. Crie seu usuário (npm run user -- add <usuario>) e remova-o: npm run user -- remove admin');
    }
    return 'existing';
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('Nenhum usuário no banco. Crie o primeiro com: npm run user -- add <usuario>');
  }
  createUser(db, 'admin', { password: 'admin', allowWeakPassword: true });
  log.warn('[auth] banco sem usuários: criado admin/admin apenas para desenvolvimento local.');
  return 'dev-admin';
}

module.exports = {
  hashPassword,
  verifyPassword,
  countUsers,
  listUsers,
  getPasswordHash,
  createUser,
  setPassword,
  removeUser,
  ensureUsers,
  MIN_PASSWORD_LENGTH,
};
