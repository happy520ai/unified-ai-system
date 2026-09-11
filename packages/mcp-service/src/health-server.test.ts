import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createDaemon } from "./daemon.js";
import { createHealthServer } from "./health-server.js";

const ADMIN_TOKEN = "test-health-admin-".padEnd(64, "a");
const supervisor = {
  getStatus: () => ({ running: true, restartCount: 2, uptimeMs: 123,
    stderrTail: "synthetic diagnostic tail", health: { lastError: "private detail" } }),
};

async function start(t, options = {}) {
  const server = createHealthServer({ port: 0, adminToken: "", supervisor, ...options });
  t.after(() => server.close());
  await server.listen();
  return server;
}

function call(server, path, { method = "GET", headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port: server.address().port,
      path, method, headers, agent: false }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(2000, () => req.destroy(new Error("test request timed out")));
    req.on("error", reject);
    req.end();
  });
}

test("health probes remain public while management is disabled without a token", async (t) => {
  let shutdowns = 0;
  const server = await start(t, { onShutdown: () => { shutdowns++; } });
  assert.equal((await call(server, "/healthz")).status, 200);
  assert.equal((await call(server, "/readyz")).status, 200);
  for (const [path, method] of [["/logs", "GET"], ["/shutdown", "POST"]]) {
    const result = await call(server, path, { method });
    assert.equal(result.status, 503);
    assert.doesNotMatch(result.body, /synthetic diagnostic tail/);
  }
  assert.equal(shutdowns, 0);
});

test("public status excludes diagnostic state and logs", async (t) => {
  const server = await start(t);
  const result = await call(server, "/status");
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(result.body), { service: "unified-ai-system-mcp-service",
    version: "0.4.9", running: true, restartCount: 2, uptimeMs: 123 });
});

test("management rejects missing, wrong, query, duplicate and combined credentials", async (t) => {
  let shutdowns = 0;
  const server = await start(t, { adminToken: ADMIN_TOKEN, onShutdown: () => { shutdowns++; } });
  const invalidHeaders = [
    {}, { Authorization: "Bearer wrong-token" },
    { Authorization: `Basic ${ADMIN_TOKEN}` },
    { Authorization: [`Bearer ${ADMIN_TOKEN}`, "Bearer wrong-token"] },
    { Authorization: `Bearer ${ADMIN_TOKEN}, Bearer ${ADMIN_TOKEN}` },
  ];
  for (const [path, method] of [["/logs", "GET"], ["/shutdown", "POST"]]) {
    for (const headers of invalidHeaders) {
      const result = await call(server, path, { method, headers });
      assert.equal(result.status, 401);
      assert.ok(!result.body.includes(ADMIN_TOKEN));
      assert.ok(!result.body.includes("synthetic diagnostic tail"));
    }
    assert.equal((await call(server, `${path}?token=${ADMIN_TOKEN}`, { method })).status, 401);
  }
  assert.equal(shutdowns, 0);
});

test("authorized diagnostics work and repeated shutdown invokes the callback only once", async (t) => {
  let shutdowns = 0;
  const server = await start(t, { adminToken: ADMIN_TOKEN, onShutdown: () => { shutdowns++; } });
  const headers = { Authorization: `Bearer ${ADMIN_TOKEN}` };
  assert.deepEqual(await call(server, "/logs?limit=4", { headers }), { status: 200, body: "tail" });
  assert.equal((await call(server, "/shutdown", { headers })).status, 405);
  for (let i = 0; i < 2; i++) {
    assert.equal((await call(server, "/shutdown", { method: "POST", headers })).status, 202);
  }
  assert.equal(shutdowns, 1);
});

test("log limits reject ambiguous and unbounded values after authorization", async (t) => {
  const server = await start(t, { adminToken: ADMIN_TOKEN });
  for (const query of ["limit=-1", "limit=0", "limit=NaN", "limit=1e9", "limit=64001", "limit=1&limit=2"]) {
    assert.equal((await call(server, `/logs?${query}`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    })).status, 400);
  }
});

test("unsafe listener and malformed tokens fail before a listener is allocated", () => {
  for (const host of ["0.0.0.0", "::", "::1", "localhost", "127.0.0.2", ""]) {
    assert.throws(() => createHealthServer({ host, adminToken: "" }), /127\.0\.0\.1/);
  }
  for (const adminToken of ["short", " ".repeat(64), "a".repeat(257), `${ADMIN_TOKEN}\n`, null, 123]) {
    assert.throws(() => createHealthServer({ adminToken }), /admin token/i);
  }
});

test("daemon wires administration without exposing the token in public state or logs", async (t) => {
  const logged = [];
  const logger = { info: (...args) => logged.push(args), error: (...args) => logged.push(args),
    warn: (...args) => logged.push(args), close: async () => {} };
  const daemon = await createDaemon({ healthPort: 0, healthHost: "127.0.0.1",
    repoRoot: fileURLToPath(new URL("../../../", import.meta.url)),
    healthAdminToken: ADMIN_TOKEN, logger, supervisor: { ...supervisor,
      start: async () => {}, stop: async () => {} } });
  t.after(() => daemon.stop());
  await daemon.start();
  assert.equal((await call(daemon.healthServer, "/logs")).status, 401);
  assert.equal((await call(daemon.healthServer, "/logs", {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  })).status, 200);
  assert.ok(!JSON.stringify(logged).includes(ADMIN_TOKEN));
  assert.ok(!(await call(daemon.healthServer, "/status")).body.includes(ADMIN_TOKEN));
});

test("replacement server accepts the rotated token and refuses the old token", async (t) => {
  const old = await start(t, { adminToken: ADMIN_TOKEN });
  const headers = { Authorization: `Bearer ${ADMIN_TOKEN}` };
  assert.equal((await call(old, "/logs", { headers })).status, 200);
  await old.close();
  const rotated = "test-health-admin-rotated-".padEnd(64, "b");
  const replacement = await start(t, { adminToken: rotated });
  assert.equal((await call(replacement, "/logs", { headers })).status, 401);
  assert.equal((await call(replacement, "/logs", {
    headers: { Authorization: `Bearer ${rotated}` },
  })).status, 200);
});
