import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createGatewayRuntime, mcpRuntimeInternals } from "./runtime.js";

function childFixture(signalCode = null) {
  const child = new EventEmitter();
  Object.assign(child, { exitCode: null, signalCode, stdout: new PassThrough(), stderr: new PassThrough(), kills: [] });
  child.kill = signal => {
    child.kills.push(signal);
    if (child.signalCode !== null) return false;
    child.signalCode = signal;
    setImmediate(() => child.emit("exit", null, signal));
    return true;
  };
  return child;
}

function fakeFetch(t) {
  t.mock.method(globalThis, "fetch", async url => new Response(JSON.stringify({ data:
    String(url).endsWith("/health/check") ? { status: "ready", realProviderEnabled: false, providerMode: "fake" }
      : String(url).endsWith("/enterprise/session") ? { authenticated: true }
        : { agentId: "agt_lifecycle_fixture" },
  }), { status: 200 }));
}

test("managed startup exposes only classified readiness timing records", async t => {
  fakeFetch(t);
  const child = childFixture();
  const runtime = await createGatewayRuntime({ env: {}, spawnProcess: () => child });
  t.after(() => runtime.stop());
  assert.ok(Array.isArray(runtime.readinessAttempts));
  assert.equal(runtime.readinessAttempts.at(-1)?.outcome, "ready");
  for (const attempt of runtime.readinessAttempts) {
    assert.equal(typeof attempt.attempt, "number");
    assert.equal(typeof attempt.elapsedMs, "number");
    assert.match(attempt.outcome, /^(ready|connect-refused|health-not-ready|auth-failed|provider-guard-refused|probe-error)$/);
    assert.equal(Object.keys(attempt).sort().join(","), "attempt,elapsedMs,outcome");
  }
});

 test("classification accepts only fixed non-sensitive outcomes", () => {
  assert.equal(mcpRuntimeInternals.classifyProbeFailure({ code: "ECONNREFUSED" }), "connect-refused");
  assert.equal(mcpRuntimeInternals.classifyProbeFailure({ stage: "health-not-ready" }), "health-not-ready");
  assert.equal(mcpRuntimeInternals.classifyProbeFailure({ stage: "auth-failed" }), "auth-failed");
  assert.equal(mcpRuntimeInternals.classifyProbeFailure({ message: "opaque" }), "probe-error");
  assert.equal(mcpRuntimeInternals.summarizeReadinessAttempts([
    { attempt: 1, elapsedMs: 4, outcome: "connect-refused" },
    { attempt: 2, elapsedMs: 2, outcome: "ready" },
  ]), "attempts=2, connect-refused=1, ready=1");
});

test("a managed gateway has an owner IPC channel even when its MCP host is killed", async t => {
  fakeFetch(t);
  const child = childFixture();
  const runtime = await createGatewayRuntime({ env: {}, spawnProcess: (_command, _args, options) => {
    assert.equal(options.env.AI_GATEWAY_MANAGED_PARENT_IPC, "1");
    assert.deepEqual(options.stdio, ["ignore", "pipe", "pipe", "ipc"]);
    return child;
  } });
  t.after(() => runtime.stop());
});

test("managed shutdown recognizes a signal exit without sending another kill", async t => {
  fakeFetch(t);
  const child = childFixture();
  const runtime = await createGatewayRuntime({ env: {}, spawnProcess: () => child });
  t.after(() => runtime.stop());
  await runtime.stop();
  assert.deepEqual(child.kills, ["SIGTERM"]);
});

test("an already-signalled child is terminal during stop and exit cleanup", async t => {
  fakeFetch(t);
  const child = childFixture();
  const runtime = await createGatewayRuntime({ env: {}, spawnProcess: () => child });
  t.after(() => runtime.stop());
  child.signalCode = "SIGTERM";
  await runtime.stop(); runtime.killNow();
  assert.deepEqual(child.kills, []);
});

test("a connection refusal classifies as connect-refused without leaking detail", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async url => {
    calls += 1;
    if (calls === 1) {
      const error = new Error("connect ECONNREFUSED 127.0.0.1:1");
      error.code = "ECONNREFUSED";
      throw error;
    }
    return new Response(JSON.stringify({ data:
      String(url).endsWith("/health/check") ? { status: "ready", realProviderEnabled: false, providerMode: "fake" }
        : String(url).endsWith("/enterprise/session") ? { authenticated: true }
          : { agentId: "agt_lifecycle_fixture" },
    }), { status: 200 });
  });
  const child = childFixture();
  const runtime = await createGatewayRuntime({ env: {}, spawnProcess: () => child });
  t.after(() => runtime.stop());
  assert.equal(runtime.readinessAttempts[0].outcome, "connect-refused");
  assert.equal(runtime.readinessAttempts.at(-1).outcome, "ready");
  for (const attempt of runtime.readinessAttempts) {
    assert.equal(Object.keys(attempt).sort().join(","), "attempt,elapsedMs,outcome");
  }
});

test("a non-ready health envelope classifies as health-not-ready", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ data:
    { status: "starting", realProviderEnabled: false, providerMode: "fake" },
  }), { status: 200 }));
  await assert.rejects(
    () => mcpRuntimeInternals.probeReadiness("http://127.0.0.1:1", {}),
    (error) => mcpRuntimeInternals.classifyProbeFailure(error) === "health-not-ready",
  );
});

test("a failed authentication check classifies as auth-failed", async t => {
  t.mock.method(globalThis, "fetch", async url => new Response(JSON.stringify({ data:
    String(url).endsWith("/health/check")
      ? { status: "ready", realProviderEnabled: false, providerMode: "fake" }
      : { authenticated: false },
  }), { status: 200 }));
  await assert.rejects(
    () => mcpRuntimeInternals.probeReadiness("http://127.0.0.1:1", {}),
    (error) => mcpRuntimeInternals.classifyProbeFailure(error) === "auth-failed",
  );
});

test("a real-provider gateway is refused as provider-guard-refused", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ data:
    { status: "ready", realProviderEnabled: true, providerMode: "real" },
  }), { status: 200 }));
  await assert.rejects(
    () => mcpRuntimeInternals.probeReadiness("http://127.0.0.1:1", {}),
    (error) => mcpRuntimeInternals.classifyProbeFailure(error) === "provider-guard-refused",
  );
});

test("startup rejects a child that exited by signal before a readiness probe", async t => {
  fakeFetch(t);
  let runtime;
  t.after(() => runtime?.stop());
  await assert.rejects(async () => {
    runtime = await createGatewayRuntime({ env: {}, spawnProcess: () => childFixture("SIGTERM") });
  }, /Gateway exited/);
});
