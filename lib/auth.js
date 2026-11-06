// Server-side authentication for the existing login screen: password hashes from
// environment variables, in-memory sessions in an HttpOnly cookie, and a limit on
// failed login attempts per client IP.
const crypto = require('crypto');

const COOKIE_NAME = 'sid';
const SCRYPT_KEYLEN = 64;
const MAX_FAILED_ATTEMPTS = 5;
const FAILED_WINDOW_MS = 15 * 60 * 1000;
const USER_PATTERN = /^[\w.@-]{1,64}$/;

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

// Hash usado para gastar o mesmo tempo quando o usuário não existe
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

/**
 * Reads users from AUTH_USERS ("user:hash,user2:hash") or AUTH_USER + AUTH_PASSWORD_HASH.
 * Without configuration, development falls back to admin/admin; production refuses to start.
 * @returns {Map<string, string>} user name -> password hash
 */
function loadUsers(env = process.env, log = console) {
  const users = new Map();
  const add = (name, hash) => {
    if (!USER_PATTERN.test(name) || !String(hash).startsWith('scrypt$')) {
      throw new Error(`Usuário inválido na configuração: "${name}"`);
    }
    users.set(name, hash);
  };

  if (env.AUTH_USERS) {
    for (const entry of env.AUTH_USERS.split(',').map((s) => s.trim()).filter(Boolean)) {
      const sep = entry.indexOf(':');
      add(entry.slice(0, sep), entry.slice(sep + 1));
    }
  } else if (env.AUTH_USER && env.AUTH_PASSWORD_HASH) {
    add(env.AUTH_USER, env.AUTH_PASSWORD_HASH);
  }

  if (!users.size) {
    if (env.NODE_ENV === 'production') {
      throw new Error('Nenhum usuário configurado. Defina AUTH_USERS ou AUTH_USER + AUTH_PASSWORD_HASH (gere o hash com "npm run auth:hash").');
    }
    log.warn('[auth] nenhum usuário configurado: usando admin/admin apenas para desenvolvimento local.');
    users.set('admin', hashPassword('admin'));
  }
  return users;
}

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

/**
 * Creates the auth service.
 * @param {{ env?: object, now?: () => number, log?: Console }} [options]
 */
function createAuth(options = {}) {
  const env = options.env || process.env;
  const now = options.now || Date.now;
  const users = loadUsers(env, options.log || console);
  const sessionTtlMs = (Number(env.SESSION_TTL_HOURS) || 8) * 60 * 60 * 1000;
  const secureCookie = env.COOKIE_SECURE === 'true' || (env.NODE_ENV === 'production' && env.COOKIE_SECURE !== 'false');
  const trustProxy = env.TRUST_PROXY === 'true';
  const sessions = new Map();
  const failures = new Map();

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
    const session = sessions.get(token);
    if (!session || session.expiresAt <= now() || !users.has(session.user)) {
      sessions.delete(token);
      return null;
    }
    session.expiresAt = now() + sessionTtlMs;
    return session.user;
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
    const stored = users.get(name);
    const ok = verifyPassword(typeof password === 'string' ? password : '', stored || DUMMY_HASH) && Boolean(stored);
    if (!ok) {
      registerFailure(ip);
      return { status: 401, error: 'Usuário ou senha incorretos.' };
    }

    failures.delete(ip);
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(token, { user: name, expiresAt: now() + sessionTtlMs });
    return { status: 200, user: name, setCookie: cookie(token, Math.floor(sessionTtlMs / 1000)) };
  }

  function logout(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (token) sessions.delete(token);
    return cookie('', 0);
  }

  // limpeza periódica de sessões expiradas (não segura o processo aberto)
  const sweeper = setInterval(() => {
    for (const [token, session] of sessions) if (session.expiresAt <= now()) sessions.delete(token);
  }, 10 * 60 * 1000);
  sweeper.unref();

  return { getSessionUser, login, logout, users: () => [...users.keys()] };
}

module.exports = { createAuth, hashPassword, verifyPassword, loadUsers, MAX_FAILED_ATTEMPTS };
