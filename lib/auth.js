// Server-side authentication for the existing login screen. Users and sessions
// live in the database (core_users / core_sessions), so logins survive restarts.
// Failed attempts per client IP are a short-lived in-memory throttle.
const crypto = require('crypto');
const { verifyPassword, hashPassword, getPasswordHash } = require('./users');

const COOKIE_NAME = 'sid';
const MAX_FAILED_ATTEMPTS = 5;
const FAILED_WINDOW_MS = 15 * 60 * 1000;
// Renova a expiração no banco no máximo uma vez por minuto por sessão
const RENEW_AFTER_MS = 60 * 1000;

// Hash usado para gastar o mesmo tempo quando o usuário não existe
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

function parseCookies(header) {
  const cookies = {};
  String(header || '')
    .split(';')
    .forEach((part) => {
      const i = part.indexOf('=');
      if (i > 0) cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    });
  return cookies;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates the auth service on top of the database.
 * @param {{ db: import('node:sqlite').DatabaseSync, env?: object, now?: () => number }} options
 */
function createAuth({ db, env = process.env, now = Date.now }) {
  const sessionTtlMs = (Number(env.SESSION_TTL_HOURS) || 8) * 60 * 60 * 1000;
  const secureCookie = env.COOKIE_SECURE === 'true' || (env.NODE_ENV === 'production' && env.COOKIE_SECURE !== 'false');
  const trustProxy = env.TRUST_PROXY === 'true';
  const failures = new Map();

  const findSession = db.prepare('SELECT username, expires_at FROM core_sessions WHERE token_hash = ?');
  const renewSession = db.prepare('UPDATE core_sessions SET expires_at = ? WHERE token_hash = ?');
  const deleteSession = db.prepare('DELETE FROM core_sessions WHERE token_hash = ?');
  const insertSession = db.prepare('INSERT INTO core_sessions (token_hash, username, created_at, expires_at) VALUES (?, ?, ?, ?)');
  const deleteExpired = db.prepare('DELETE FROM core_sessions WHERE expires_at <= ?');

  function clientIp(req) {
    // atrás do Nginx, o IP real vem no X-Forwarded-For (só se TRUST_PROXY=true)
    if (trustProxy && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
    return req.socket.remoteAddress || 'unknown';
  }

  function cookie(value, maxAgeSeconds) {
    return `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${secureCookie ? '; Secure' : ''}`;
  }

  /**
   * Returns the user of a valid session (renewing its expiry) or null.
   */
  function getSessionUser(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!token) return null;
    const hash = tokenHash(token);
    const session = findSession.get(hash);
    if (!session) return null;
    if (session.expires_at <= now()) {
      deleteSession.run(hash);
      return null;
    }
    const expiresAt = now() + sessionTtlMs;
    if (expiresAt - session.expires_at >= RENEW_AFTER_MS) renewSession.run(expiresAt, hash);
    return session.username;
  }

  /**
   * Seconds until the IP may try again, or 0 when not blocked.
   */
  function blockedFor(ip) {
    const entry = failures.get(ip);
    if (!entry) return 0;
    if (now() - entry.firstAt > FAILED_WINDOW_MS) {
      failures.delete(ip);
      return 0;
    }
    return entry.count >= MAX_FAILED_ATTEMPTS ? Math.ceil((entry.firstAt + FAILED_WINDOW_MS - now()) / 1000) : 0;
  }

  function registerFailure(ip) {
    const entry = failures.get(ip);
    if (!entry || now() - entry.firstAt > FAILED_WINDOW_MS) failures.set(ip, { count: 1, firstAt: now() });
    else entry.count++;
  }

  /**
   * Checks credentials and opens a session.
   * @returns {{ status: 200, user: string, setCookie: string } | { status: 401|429, error: string }}
   */
  function login(req, username, password) {
    const ip = clientIp(req);
    const wait = blockedFor(ip);
    if (wait) return { status: 429, error: `Muitas tentativas. Tente novamente em ${Math.ceil(wait / 60)} min.` };

    const name = typeof username === 'string' ? username.trim() : '';
    const stored = name ? getPasswordHash(db, name) : null;
    const ok = verifyPassword(typeof password === 'string' ? password : '', stored || DUMMY_HASH) && Boolean(stored);
    if (!ok) {
      registerFailure(ip);
      return { status: 401, error: 'Usuário ou senha incorretos.' };
    }

    failures.delete(ip);
    const token = crypto.randomBytes(32).toString('base64url');
    insertSession.run(tokenHash(token), name, now(), now() + sessionTtlMs);
    return { status: 200, user: name, setCookie: cookie(token, Math.floor(sessionTtlMs / 1000)) };
  }

  function logout(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (token) deleteSession.run(tokenHash(token));
    return cookie('', 0);
  }

  // limpeza periódica de sessões expiradas (não segura o processo aberto)
  const sweeper = setInterval(() => deleteExpired.run(now()), 10 * 60 * 1000);
  sweeper.unref();

  return { getSessionUser, login, logout };
}

module.exports = { createAuth, MAX_FAILED_ATTEMPTS };
