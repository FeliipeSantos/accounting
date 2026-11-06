// Server-side authentication: login, sessions, logout, attempt limit and configuration.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, request, TEST_USERS } = require('./helpers/server');
const { hashPassword, verifyPassword, loadUsers, createAuth, MAX_FAILED_ATTEMPTS } = require('../lib/auth');

const login = (srv, username, password, headers) => request(srv.port, 'POST', '/api/auth/login', JSON.stringify({ username, password }), headers);

describe('password hashing', () => {
  test('verifies the right password only', () => {
    const hash = hashPassword('uma-senha-forte');
    assert.match(hash, /^scrypt\$[\w-]+\$[\w-]+$/);
    assert.equal(verifyPassword('uma-senha-forte', hash), true);
    assert.equal(verifyPassword('outra', hash), false);
    assert.notEqual(hashPassword('uma-senha-forte'), hash, 'random salt');
    assert.equal(verifyPassword('x', 'texto-qualquer'), false);
  });
});

describe('user configuration', () => {
  const silent = { warn: () => {} };

  test('reads several users from AUTH_USERS', () => {
    const users = loadUsers({ AUTH_USERS: `ana:${hashPassword('a')},bruno:${hashPassword('b')}` }, silent);
    assert.deepEqual([...users.keys()], ['ana', 'bruno']);
  });

  test('development falls back to admin/admin with a warning', () => {
    const warnings = [];
    const users = loadUsers({}, { warn: (m) => warnings.push(m) });
    assert.ok(verifyPassword('admin', users.get('admin')));
    assert.equal(warnings.length, 1);
  });

  test('production refuses to start without configured users', () => {
    assert.throws(() => loadUsers({ NODE_ENV: 'production' }, silent), /Nenhum usuário configurado/);
  });

  test('rejects malformed entries', () => {
    assert.throws(() => loadUsers({ AUTH_USERS: 'ana:senha-sem-hash' }, silent), /inválido/);
  });

  test('marks the cookie Secure in production', () => {
    const auth = createAuth({ env: { NODE_ENV: 'production', AUTH_USERS: `ana:${hashPassword('senha-boa')}` } });
    const result = auth.login({ headers: {}, socket: { remoteAddress: '1.1.1.1' } }, 'ana', 'senha-boa');
    assert.match(result.setCookie, /; Secure/);
    assert.match(result.setCookie, /HttpOnly; SameSite=Strict/);
  });
});

describe('login and sessions', () => {
  let srv;
  before(async () => {
    srv = await startServer({ seed: [] });
  });
  after(() => srv.stop());

  test('valid login returns the user and an HttpOnly session cookie', async () => {
    const res = await login(srv, 'admin', TEST_USERS.admin);
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body), { user: 'admin' });
    assert.match(res.headers['set-cookie'][0], /^sid=[\w-]{20,};.*HttpOnly; SameSite=Strict/);

    const cookie = res.headers['set-cookie'][0].split(';')[0];
    const session = await request(srv.port, 'GET', '/api/auth/session', undefined, { Cookie: cookie });
    assert.deepEqual(JSON.parse(session.body), { user: 'admin' });
  });

  test('wrong password or unknown user get the same 401 message', async () => {
    const wrong = await login(srv, 'admin', 'errada', { 'X-Forwarded-For': '10.0.0.1' });
    const unknown = await login(srv, 'ninguem', 'qualquer');
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(JSON.parse(wrong.body).error, JSON.parse(unknown.body).error);
    assert.equal(wrong.headers['set-cookie'], undefined);
  });

  test('session endpoint answers 401 without a session', async () => {
    assert.equal((await request(srv.port, 'GET', '/api/auth/session')).status, 401);
  });

  test('logout closes the session on the server', async () => {
    const res = await login(srv, 'outro.usuario', TEST_USERS['outro.usuario']);
    const cookie = res.headers['set-cookie'][0].split(';')[0];
    const out = await request(srv.port, 'POST', '/api/auth/logout', '{}', { Cookie: cookie });
    assert.match(out.headers['set-cookie'][0], /Max-Age=0/);
    assert.equal((await request(srv.port, 'GET', '/api/projects', undefined, { Cookie: cookie })).status, 401);
  });
});

describe('failed attempt limit', () => {
  let srv;
  before(async () => {
    srv = await startServer({ seed: [] });
  });
  after(() => srv.stop());

  test(`blocks the IP after ${MAX_FAILED_ATTEMPTS} failures, even with the right password`, async () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      assert.equal((await login(srv, 'admin', `errada-${i}`)).status, 401);
    }
    const blocked = await login(srv, 'admin', TEST_USERS.admin);
    assert.equal(blocked.status, 429);
    assert.match(JSON.parse(blocked.body).error, /Muitas tentativas/);
  });

  test('X-Forwarded-For is ignored unless TRUST_PROXY=true (cannot be used to dodge the limit)', async () => {
    const res = await login(srv, 'admin', TEST_USERS.admin, { 'X-Forwarded-For': '203.0.113.9' });
    assert.equal(res.status, 429);
  });
});
