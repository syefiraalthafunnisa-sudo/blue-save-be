// Run after npm run build: node tests/endpoints-live.cjs
// Or test the running app: node tests/endpoints-live.cjs http://127.0.0.1:5000
// Uses .env and real MySQL; removes only its own fixtures and uploaded files.
require('dotenv').config();
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const results = [];
const users = [], newsIds = [], eventIds = [], files = new Set();
const tag = randomUUID().slice(0, 8);
const email = `qa-${tag}@example.com`, password = 'Password1!';
const uploadDir = path.resolve('uploads/reports');
const externalBase = process.argv[2];
let server, base, localAddress, clientGroup = 0;

async function stop() {
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGINT');
    await exited;
  }
}
async function start() {
  // Redis preserves limits across restarts; use a fresh test client each phase.
  localAddress = `127.${1 + parseInt(tag.slice(0, 2), 16) % 250}.${parseInt(tag.slice(2, 4), 16)}.${++clientGroup}`;
  if (externalBase) {
    assert.equal(new URL(externalBase).hostname, '127.0.0.1', 'External mode requires a local IPv4 server');
    base = externalBase;
    // Separate loopback clients test per-IP limits without blocking the user's IP.
    console.log(`Target ${base}; test client ${localAddress}`);
    return;
  }
  await stop();
  // Ask the OS for a free test port without occupying the user's server port.
  const net = require('node:net');
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['build/server.js'], {
    env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { server.kill('SIGINT'); reject(new Error('Startup timeout')); }, 10000);
    server.stdout.on('data', chunk => {
      if (chunk.toString().includes('Server running')) { clearTimeout(timeout); resolve(); }
    });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}`)); });
  });
}
async function request(method, route, body, token, raw = false) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  const options = {
    method, headers, body: body === undefined ? undefined : body instanceof FormData || raw ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  };
  const prepared = new Request(base + route, options);
  const bytes = Buffer.from(await prepared.arrayBuffer());
  const wireHeaders = Object.fromEntries(prepared.headers);
  if (bytes.length) wireHeaders['content-length'] = String(bytes.length);
  const response = await new Promise((resolve, reject) => {
    const req = http.request(prepared.url, { method, headers: wireHeaders, localAddress, signal: options.signal }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end(bytes);
  });
  const text = response.text;
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
}
const api = (method, route, body, token, raw) => request(method, '/api/v1' + route, body, token, raw);
async function check(name, run) {
  try { await run(); results.push({ name, pass: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, pass: false, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
}
async function status(name, method, route, expected, body, token) {
  await check(name, async () => {
    const result = await api(method, route, body, token);
    assert.equal(result.status, expected, JSON.stringify(result.data).slice(0, 250));
  });
}
function form(overrides = {}, file = true, filename = 'test.png', mime = 'image/png') {
  const body = new FormData();
  for (const [key, value] of Object.entries({ title: 'QA report', street: 'Jalan Test', province: 'Jawa Timur', country: 'Indonesia', description: 'Temporary endpoint test report', ...overrides })) body.append(key, value);
  if (file) body.append('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')], { type: mime }), filename);
  return body;
}
async function trackedUpload(body, token) {
  const before = new Set(fs.readdirSync(uploadDir));
  const result = await api('POST', '/reports', body, token);
  for (const name of fs.readdirSync(uploadDir)) if (!before.has(name)) files.add(name);
  return result;
}

async function main() {
  await start();
  await status('register invalid body', 'POST', '/auth/register', 400, {});
  let registration;
  await check('register success + signed JWT + hashed password + role protection', async () => {
    const result = await api('POST', '/auth/register', { email, password, role: 'ADMIN' });
    assert.equal(result.status, 201);
    registration = result.data;
    const user = await db.user.findUniqueOrThrow({ where: { email } }); users.push(user.id);
    assert.equal(user.role, 'USER'); assert.equal(await bcrypt.compare(password, user.password), true);
    assert.equal(jwt.verify(registration.accessToken, process.env.JWT_SECRET).id, user.id);
    assert.equal(jwt.verify(registration.refreshToken, process.env.JWT_REFRESH_SECRET).id, user.id);
  });
  if (!registration) throw new Error('Cannot continue without registration');
  await status('register duplicate email', 'POST', '/auth/register', 409, { email, password });
  await status('register rate limit', 'POST', '/auth/register', 429, { email, password });
  const token = registration.accessToken;
  await status('login invalid body', 'POST', '/auth/login', 400, {});
  await status('login incorrect password', 'POST', '/auth/login', 401, { email, password: 'WrongPass1!' });
  await status('login unknown email', 'POST', '/auth/login', 401, { email: `unknown-${tag}@example.com`, password });
  await check('login normal token lifetime', async () => {
    const r = await api('POST', '/auth/login', { email, password }); assert.equal(r.status, 200);
    const payload = jwt.decode(r.data.refreshToken); assert.equal(payload.exp - payload.iat, 7 * 86400);
  });
  await check('login rememberMe token lifetime', async () => {
    const r = await api('POST', '/auth/login', { email, password, rememberMe: true }); assert.equal(r.status, 200);
    const payload = jwt.decode(r.data.refreshToken); assert.equal(payload.exp - payload.iat, 30 * 86400);
  });
  await status('login rate limit', 'POST', '/auth/login', 429, { email, password });

  await start(); // New test server or a new client IP; database is preserved.
  await check('refresh rotation produces different token and rejects replay', async () => {
    const login = await api('POST', '/auth/login', { email, password });
    const old = login.data.refreshToken;
    const r = await api('POST', '/auth/refresh-token', { refreshToken: old }); assert.equal(r.status, 200);
    const replay = await api('POST', '/auth/refresh-token', { refreshToken: old });
    assert.notEqual(r.data.refreshToken, old, `Rotated token equals old token; replay HTTP ${replay.status}`);
    assert.equal(replay.status, 403);
  });
  await status('refresh missing token', 'POST', '/auth/refresh-token', 400, {});
  await status('refresh forged token', 'POST', '/auth/refresh-token', 403, { refreshToken: 'forged' });
  await check('refresh expired persisted token', async () => {
    const expired = jwt.sign({ id: users[0] }, process.env.JWT_REFRESH_SECRET, { expiresIn: -1, jwtid: randomUUID() });
    await db.refreshToken.create({ data: { token: expired, userId: users[0] } });
    assert.equal((await api('POST', '/auth/refresh-token', { refreshToken: expired })).status, 403);
  });
  await check('logout revokes refresh token', async () => {
    const r = await api('POST', '/auth/login', { email, password, rememberMe: true });
    assert.equal((await api('POST', '/auth/logout', { refreshToken: r.data.refreshToken })).status, 200);
    assert.equal((await api('POST', '/auth/refresh-token', { refreshToken: r.data.refreshToken })).status, 403);
  });
  await status('logout missing token', 'POST', '/auth/logout', 400, {});
  await status('logout invalid token', 'POST', '/auth/logout', 403, { refreshToken: 'forged' });
  await check('simultaneous refresh consumes token once and preserves rememberMe', async () => {
    const login = await api('POST', '/auth/login', { email, password, rememberMe: true });
    assert.equal(login.status, 200);
    const old = login.data.refreshToken;
    const responses = await Promise.all([0, 1].map(() => api('POST', '/auth/refresh-token', { refreshToken: old })));
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 403]);
    const fresh = responses.find(r => r.status === 200).data.refreshToken;
    const payload = jwt.verify(fresh, process.env.JWT_REFRESH_SECRET);
    assert.equal(payload.exp - payload.iat, 30 * 86400);
    assert.equal(await db.refreshToken.count({ where: { token: old } }), 0);
  });
  if (!externalBase) await check('refresh transaction rolls back if replacement cannot be saved', async () => {
    const old = jwt.sign({ id: users[0] }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d', jwtid: randomUUID() });
    await db.refreshToken.create({ data: { userId: users[0], token: old } });
    const { rotateRefreshToken } = require('../build/repositories/authRepository');
    try {
      await assert.rejects(rotateRefreshToken(users[0], old, 'x'.repeat(513)));
      assert.equal(await db.refreshToken.count({ where: { token: old } }), 1);
    } finally {
      await require('../build/config/database').default.$disconnect();
    }
  });

  for (let i = 0; i < 2; i++) {
    newsIds.push((await db.news.create({ data: { title: `QA ${tag} ${i}`, description: 'Test', content: 'Test content', author: 'QA', category: 'EDUCATION', image: '/images/placeholder.svg' } })).id);
    eventIds.push((await db.event.create({ data: { title: `QA ${tag} ${i}`, description: 'Test event', date: '2030-01-01', location: 'Malang', image: '/images/placeholder.svg' } })).id);
  }
  await check('news list + pagination', async () => {
    const r = await api('GET', '/news?page=1&limit=1'); assert.equal(r.status, 200);
    assert.equal(r.data.news.length, 1); assert.equal(r.data.currentPage, 1); assert.ok(r.data.totalNews >= 2);
  });
  await check('news detail', async () => { const r = await api('GET', `/news/${newsIds[0]}`); assert.equal(r.status, 200); assert.equal(r.data.id, newsIds[0]); });
  await status('news invalid ID', 'GET', '/news/bad', 400);
  await status('news absent ID', 'GET', `/news/${randomUUID()}`, 404);
  await status('news invalid pagination', 'GET', '/news?page=0&limit=-1', 400);
  await status('news large positive limit (no documented maximum)', 'GET', '/news?limit=2147483648', 200);
  await check('news empty page', async () => { const r = await api('GET', '/news?page=100000&limit=10'); assert.equal(r.status, 200); assert.deepEqual(r.data.news, []); });
  for (const [method, route] of [['GET', '/events'], ['GET', `/events/${eventIds[0]}`], ['POST', `/events/register/${eventIds[0]}`], ['POST', '/reports'], ['GET', '/reports/user-reports'], ['POST', '/donation']]) {
    await status(`${method} ${route.split(eventIds[0]).join(':id')} requires auth`, method, route, 401);
  }
  await status('JWT forged access', 'GET', '/events', 401, undefined, 'forged');
  await status('JWT expired access', 'GET', '/events', 401, undefined, jwt.sign({ id: users[0] }, process.env.JWT_SECRET, { expiresIn: -1 }));
  await status('JWT refresh token cannot act as access', 'GET', '/events', 401, undefined, registration.refreshToken);
  await status('JWT unknown user', 'GET', '/events', 401, undefined, jwt.sign({ id: randomUUID() }, process.env.JWT_SECRET));
  await check('event list + pagination', async () => { const r = await api('GET', '/events?limit=1', undefined, token); assert.equal(r.status, 200); assert.equal(r.data.events.length, 1); assert.ok(r.data.totalEvents >= 2); });
  await check('event detail', async () => { const r = await api('GET', `/events/${eventIds[0]}`, undefined, token); assert.equal(r.status, 200); assert.equal(r.data.id, eventIds[0]); });
  await status('event invalid ID', 'GET', '/events/bad', 400, undefined, token);
  await status('event absent ID', 'GET', `/events/${randomUUID()}`, 404, undefined, token);
  await status('event invalid pagination', 'GET', '/events?page=0', 400, undefined, token);
  await check('event registration persists authenticated owner', async () => {
    const r = await api('POST', `/events/register/${eventIds[0]}`, { userId: randomUUID() }, token); assert.equal(r.status, 201);
    const row = await db.eventRegistration.findUniqueOrThrow({ where: { id: r.data.registration.id } }); assert.equal(row.userId, users[0]);
  });
  await status('event duplicate registration rejected', 'POST', `/events/register/${eventIds[0]}`, 409, {}, token);
  await status('event register invalid ID', 'POST', '/events/register/bad', 400, {}, token);
  await status('event register absent ID', 'POST', `/events/register/${randomUUID()}`, 404, {}, token);
  await api('POST', `/events/register/${eventIds[1]}`, {}, token);
  await status('event registration rate limit', 'POST', `/events/register/${eventIds[1]}`, 429, {}, token);

  await start();
  await check('simultaneous event registration creates one row', async () => {
    const event = await db.event.create({ data: { title: `QA ${tag} concurrent`, description: 'Test', date: '2030-01-01', location: 'Malang', image: '/images/placeholder.svg' } });
    eventIds.push(event.id);
    const responses = await Promise.all([0, 1].map(() => api('POST', `/events/register/${event.id}`, {}, token)));
    assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
    assert.equal(await db.eventRegistration.count({ where: { userId: users[0], eventId: event.id } }), 1);
  });

  await check('report upload + persisted owner + served media', async () => {
    const r = await trackedUpload(form({ userId: randomUUID() }), token); assert.equal(r.status, 201);
    const row = await db.report.findUniqueOrThrow({ where: { id: r.data.report.id } }); assert.equal(row.userId, users[0]); assert.equal(row.status, 'WAITING');
    assert.equal((await request('GET', row.media)).status, 200);
  });
  await check('report list contains only own reports', async () => {
    const other = await db.user.create({ data: { email: `other-${tag}@example.com`, name: 'Other' } }); users.push(other.id);
    await db.report.create({ data: { title: 'Other report', street: 'Jalan', province: 'Jawa', country: 'Indonesia', description: 'Other', media: '/images/placeholder.svg', userId: other.id } });
    const r = await api('GET', '/reports/user-reports', undefined, token); assert.equal(r.status, 200); assert.ok(r.data.length >= 1); assert.ok(r.data.every(row => row.userId === users[0]));
  });
  await status('report missing file', 'POST', '/reports', 400, form({}, false), token);
  await check('report invalid fields + no orphan file', async () => {
    const before = fs.readdirSync(uploadDir).length;
    const r = await trackedUpload(form({ title: 'x' }), token); assert.equal(r.status, 400);
    assert.equal(fs.readdirSync(uploadDir).length, before, 'Rejected report leaves uploaded file on disk');
  });
  await check('report forbidden extension returns client error', async () => { assert.equal((await trackedUpload(form({}, true, 'test.exe'), token)).status, 400); });
  await check('report forbidden MIME returns client error', async () => { assert.equal((await trackedUpload(form({}, true, 'test.png', 'text/html'), token)).status, 400); });
  await check('report overlong title rejected', async () => { assert.equal((await trackedUpload(form({ title: 'x'.repeat(256) }), token)).status, 400); });
  for (const field of ['street', 'province', 'country']) {
    await check(`report overlong ${field} rejected without orphan file`, async () => {
      const before = fs.readdirSync(uploadDir).length;
      assert.equal((await trackedUpload(form({ [field]: 'x'.repeat(256) }), token)).status, 400);
      assert.equal(fs.readdirSync(uploadDir).length, before);
    });
  }
  await check('report unexpected file field returns 400', async () => {
    const body = form({}, false); body.append('wrongField', new Blob(['test'], { type: 'image/png' }), 'test.png');
    assert.equal((await trackedUpload(body, token)).status, 400);
  });
  await check('report file size limit returns 413', async () => {
    const before = fs.readdirSync(uploadDir).length;
    const body = form({}, false); body.append('file', new Blob([Buffer.alloc(50 * 1024 * 1024 + 1)], { type: 'image/png' }), 'large.png');
    assert.equal((await trackedUpload(body, token)).status, 413);
    assert.equal(fs.readdirSync(uploadDir).length, before);
  });
  for (const amount of [10000, '12.34', 0.01, 99999999.99]) {
    await check(`donation valid ${amount} + persisted amount and owner`, async () => {
      const r = await api('POST', '/donation', { amount, userId: randomUUID() }, token); assert.equal(r.status, 200);
      assert.equal(r.data.transaction.dummy, true); assert.equal(r.data.transaction.status, 'success');
      const row = await db.donation.findUniqueOrThrow({ where: { id: r.data.transaction.id } }); assert.equal(Number(row.amount), Number(amount)); assert.equal(row.userId, users[0]);
    });
  }
  for (const amount of [undefined, '', 'abc', 0, -1, 100000000, '1.001', '1e3', [10], {}]) await status(`donation invalid ${JSON.stringify(amount)}`, 'POST', '/donation', 400, { amount }, token);
  await check('malformed JSON returns 400', async () => { assert.equal((await api('POST', '/donation', '{bad', token, true)).status, 400); });
  await status('unknown route', 'GET', '/unknown', 404);
  await check('local placeholder is served', async () => { assert.equal((await request('GET', '/images/placeholder.svg')).status, 200); });

  await start();
  await status('register weak password', 'POST', '/auth/register', 400, { email: `weak-${tag}@example.com`, password: 'weak' });
  const longEmail = `${'x'.repeat(43)}${tag}@example.com`;
  await check('register long derived name handled without server error', async () => {
    const r = await api('POST', '/auth/register', { email: longEmail, password });
    const user = await db.user.findUnique({ where: { email: longEmail } });
    if (user) users.push(user.id);
    assert.equal(r.status, 201);
    assert.equal(user.name.length, 50);
  });
  await check('rememberMe string false normalized or rejected', async () => {
    const r = await api('POST', '/auth/login', { email, password, rememberMe: 'false' });
    assert.equal(r.status, 200); const p = jwt.decode(r.data.refreshToken); assert.equal(p.exp - p.iat, 7 * 86400);
  });
  for (let i = 0; i < 10; i++) await api('POST', '/auth/refresh-token', { refreshToken: 'forged' });
  await status('refresh rate limit', 'POST', '/auth/refresh-token', 429, { refreshToken: 'forged' });
  await start();
  for (let i = 0; i < 200; i++) await api('GET', '/news');
  await status('global rate limit', 'GET', '/news', 429);
}

main().catch(error => { results.push({ name: 'Test infrastructure', pass: false, error: error.message }); console.error(error); }).finally(async () => {
  try {
    await stop();
    // Cascade removes this run's reports, donations, tokens and registrations.
    await db.user.deleteMany({ where: { OR: [{ id: { in: users } }, { email }] } });
    await db.event.deleteMany({ where: { id: { in: eventIds } } });
    await db.news.deleteMany({ where: { id: { in: newsIds } } });
    for (const name of files) fs.rmSync(path.join(uploadDir, name), { force: true });
  } catch (error) { results.push({ name: 'Fixture cleanup', pass: false, error: error.message }); }
  await db.$disconnect();
  const failures = results.filter(r => !r.pass);
  console.log(`\n${results.length - failures.length}/${results.length} passed; ${failures.length} failed.`);
  if (failures.length) process.exitCode = 1;
});
