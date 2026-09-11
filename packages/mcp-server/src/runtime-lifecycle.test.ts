import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createGatewayRuntime } from "./runtime.js";

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

test("startup rejects a child that exited by signal before a readiness probe", async t => {
  fakeFetch(t);
  let runtime;
  t.after(() => runtime?.stop());
  await assert.rejects(async () => {
    runtime = await createGatewayRuntime({ env: {}, spawnProcess: () => childFixture("SIGTERM") });
  }, /Gateway exited/);
});
