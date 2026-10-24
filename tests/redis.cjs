// Run: node -r ts-node/register tests/redis.cjs (requires local Redis).
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const express = require("express");
const Redis = require("ioredis");
process.env.REDIS_DB ??= "1";
const redis = require("../src/config/redis").default;
const id = randomUUID();
const ip = `2001:db8:${id.replaceAll("-", "").match(/.{4}/g).slice(0, 6).join(":")}`;
const page = Math.floor(Math.random() * 1e9) + 1000;
const keys = [];
const servers = [];
let reads = 0;

function mock(path, exports) {
  const filename = require.resolve(path);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
mock("../src/services/newsService", {
  fetchAllNews: async () => { reads++; return { news: [{ id }], totalNews: 1 }; },
  fetchNewsById: async () => { reads++; throw Object.assign(new Error("Missing"), { statusCode: 404 }); },
});
mock("../src/services/eventService", {
  fetchAllEvents: async () => { reads++; return { events: [{ id }], totalEvents: 1 }; },
  fetchEventById: async () => { reads++; return { id }; },
  registerUserToEvent: async () => ({ id }),
});
mock("passport", { authenticate: () => (req, res, next) => {
  if (req.headers.authorization !== "Bearer test") return res.sendStatus(401);
  next();
} });

async function main() {
  assert.equal(await redis.ping(), "PONG");
  assert.equal(redis.options.db, Number(process.env.REDIS_DB));
  const marker = `blue-save:test:${id}`;
  keys.push(marker);
  await redis.set(marker, "selected-db", "EX", 60);
  const other = new Redis({ ...redis.options, db: redis.options.db === 0 ? 1 : 0 });
  try { assert.equal(await other.get(marker), null); } finally { other.disconnect(); }

  const { loginLimiter } = require("../src/middlewares/rateLimiter");
  keys.push(`blue-save:v1:rate-limit:login:${ip}`);
  for (let i = 0; i < 2; i++) {
    const app = express();
    app.use((req, res, next) => { Object.defineProperty(req, "ip", { value: ip }); next(); });
    app.get("/login-limit", loginLimiter, (req, res) => res.sendStatus(200));
    app.use("/news", require("../src/routes/newsRoutes").default);
    app.use("/events", require("../src/routes/eventRoutes").default);
    app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message }));
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise((resolve) => server.once("listening", resolve));
  }
  const urls = servers.map((server) => `http://127.0.0.1:${server.address().port}`);
  for (let i = 0; i < 5; i++) assert.equal((await fetch(`${urls[i % 2]}/login-limit`)).status, 200);
  assert.equal((await fetch(`${urls[1]}/login-limit`)).status, 429);
  assert.ok(await redis.pttl(keys[1]) > 0);

  for (const [path, namespace, data] of [
    [`/news?page=${page}`, "news-list", { page }],
    [`/events/${id}`, "events-detail", { eventId: id }],
  ]) {
    const key = `blue-save:v1:cache:${namespace}:${JSON.stringify(data)}`;
    keys.push(key);
    const before = reads;
    const options = { headers: { authorization: "Bearer test" } };
    const first = await fetch(urls[0] + path, options);
    assert.equal(first.status, 200);
    const body = await first.json();
    await redis.ping(); // Wait for the asynchronous cache write.
    assert.deepEqual(await (await fetch(urls[1] + path, options)).json(), body);
    assert.equal(reads, before + 1);
    assert.ok(await redis.ttl(key) > 0 && await redis.ttl(key) <= 60);
    if (namespace === "events-detail") assert.equal((await fetch(urls[0] + path)).status, 401);
    await redis.pexpire(key, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await fetch(urls[0] + path, options);
    assert.equal(reads, before + 2);
  }
  assert.equal((await fetch(`${urls[0]}/news?page=invalid`)).status, 400);
  const missingKey = `blue-save:v1:cache:news-detail:${JSON.stringify({ id })}`;
  keys.push(missingKey);
  for (let i = 0; i < 2; i++) assert.equal((await fetch(`${urls[0]}/news/${id}`)).status, 404);
  assert.equal(await redis.get(missingKey), null);

  redis.disconnect();
  const before = reads;
  assert.equal((await fetch(`${urls[0]}/news?page=${page}`)).status, 200);
  assert.equal(reads, before + 1);
  assert.equal((await fetch(`${urls[0]}/login-limit`)).status, 500);
  await redis.connect();
  console.log("PASS: Redis DB isolation, shared limits, cache hits/expiry, auth/validation, uncached errors, outage behavior");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const server of servers) { server.closeAllConnections(); server.close(); }
  try { if (redis.status !== "ready") await redis.connect(); await redis.del(...keys); }
  finally { redis.disconnect(); }
});
