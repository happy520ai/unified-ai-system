import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { createIdempotencyCoordinator } from "./idempotencyCoordinator.ts";

const SHARED_SECRET = "0123456789abcdef0123456789abcdef";

function sqliteOptions(dbPath: string, overrides = {}) {
  return {
    storeMode: "sqlite" as const,
    sqlitePath: dbPath,
    secret: SHARED_SECRET,
    leaseMs: 5_000,
    inFlightWaitMs: 2_000,
    pollIntervalMs: 10,
    ...overrides,
  };
}

function request(key: string) {
  return {
    headers: { "idempotency-key": key, authorization: "Bearer shared-tenant" },
    socket: { remoteAddress: "127.0.0.1" },
  };
}

describe("SQLite idempotency coordinator", () => {
  it("requires an explicit path and shared HMAC secret", () => {
    expect(() => createIdempotencyCoordinator({ storeMode: "sqlite", secret: SHARED_SECRET })).toThrow(
      /SQLITE_PATH/,
    );
    expect(() => createIdempotencyCoordinator({ storeMode: "sqlite", sqlitePath: "idempotency.db", secret: "short" })).toThrow(
      /HMAC_SECRET/,
    );
  });

  it("replays a durable result after the owning connection closes", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "gateway-idempotency-persist-")), "idempotency.db");
    let calls = 0;
    const owner = createIdempotencyCoordinator(sqliteOptions(dbPath));
    const first = await owner.execute({
      request: request("persisted-key"),
      route: "/chat",
      payload: { prompt: "hello" },
      operation: async () => ({ call: ++calls, statusCode: 200 }),
    });
    owner.close();

    const successor = createIdempotencyCoordinator(sqliteOptions(dbPath));
    const replay = await successor.execute({
      request: request("persisted-key"),
      route: "/chat",
      payload: { prompt: "hello" },
      operation: async () => ({ call: ++calls, statusCode: 200 }),
    });
    successor.close();

    expect(first).toMatchObject({ status: "created", replayable: true });
    expect(replay).toMatchObject({ status: "replayed", replayed: true, value: { call: 1 } });
    expect(calls).toBe(1);
  });

  it("returns an in-progress response instead of executing a concurrent duplicate", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "gateway-idempotency-wait-")), "idempotency.db");
    const owner = createIdempotencyCoordinator(sqliteOptions(dbPath));
    const waiter = createIdempotencyCoordinator(sqliteOptions(dbPath, { inFlightWaitMs: 20 }));
    let calls = 0;
    let release!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolveStarted) => { markStarted = resolveStarted; });
    const pending = new Promise<void>((resolvePending) => { release = resolvePending; });

    const first = owner.execute({
      request: request("in-flight-key"),
      route: "/chat",
      payload: { prompt: "wait" },
      operation: async () => {
        calls += 1;
        markStarted();
        await pending;
        return { statusCode: 200 };
      },
    });
    await started;
    const duplicate = await waiter.execute({
      request: request("in-flight-key"),
      route: "/chat",
      payload: { prompt: "wait" },
      operation: async () => ({ call: ++calls }),
    });
    release();
    await first;
    owner.close();
    waiter.close();

    expect(duplicate).toMatchObject({
      accepted: false,
      statusCode: 409,
      code: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
      retryable: true,
    });
    expect(calls).toBe(1);
  });

  it("coalesces one provider operation across two Node processes", async () => {
    const directory = mkdtempSync(join(tmpdir(), "gateway-idempotency-process-"));
    const dbPath = join(directory, "idempotency.db");
    const markerPath = join(directory, "owner-started");
    const callLogPath = join(directory, "provider-calls.log");
    const workerPath = join(directory, "worker.mjs");
    const moduleUrl = pathToFileURL(resolve("apps/ai-gateway-service/src/http/idempotencyCoordinator.ts")).href;

    writeFileSync(workerPath, `
      import { appendFileSync, writeFileSync } from "node:fs";
      import { setTimeout as delay } from "node:timers/promises";
      import { createIdempotencyCoordinator } from ${JSON.stringify(moduleUrl)};
      const coordinator = createIdempotencyCoordinator({
        storeMode: "sqlite",
        sqlitePath: process.env.TEST_DB_PATH,
        secret: process.env.TEST_SHARED_SECRET,
        leaseMs: 5000,
        inFlightWaitMs: 3000,
        pollIntervalMs: 10,
      });
      const outcome = await coordinator.execute({
        request: {
          headers: { "idempotency-key": "cross-process-key", authorization: "Bearer shared-tenant" },
          socket: { remoteAddress: "127.0.0.1" },
        },
        route: "/chat",
        payload: { messages: [{ role: "user", content: "one operation" }] },
        operation: async () => {
          appendFileSync(process.env.TEST_CALL_LOG, "provider-call\\n");
          writeFileSync(process.env.TEST_MARKER_PATH, "started");
          await delay(300);
          return { statusCode: 200, payload: { provider: "fake", response: "one" } };
        },
      });
      coordinator.close();
      process.stdout.write(JSON.stringify(outcome));
    `, "utf8");

    const env = {
      ...process.env,
      TEST_DB_PATH: dbPath,
      TEST_SHARED_SECRET: SHARED_SECRET,
      TEST_MARKER_PATH: markerPath,
      TEST_CALL_LOG: callLogPath,
    };
    const owner = runWorker(workerPath, env);
    await waitForFile(markerPath);
    const duplicate = runWorker(workerPath, env);
    const [ownerOutput, duplicateOutput] = await Promise.all([owner, duplicate]);

    const ownerOutcome = JSON.parse(ownerOutput);
    const duplicateOutcome = JSON.parse(duplicateOutput);
    const providerCalls = readFileSync(callLogPath, "utf8").trim().split(/\r?\n/).filter(Boolean);

    expect(ownerOutcome).toMatchObject({ status: "created", replayed: false, replayable: true });
    expect(duplicateOutcome).toMatchObject({ status: "replayed", replayed: true, replayable: true });
    expect(duplicateOutcome.value).toEqual(ownerOutcome.value);
    expect(providerCalls).toHaveLength(1);
  }, 15_000);
});

function runWorker(workerPath: string, env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolveOutput, rejectOutput) => {
    const child = spawn(process.execPath, [workerPath], {
      cwd: resolve(dirname(workerPath), ".."),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectOutput);
    child.on("exit", (code) => {
      if (code === 0) resolveOutput(stdout);
      else rejectOutput(new Error(`Worker exited with ${code}: ${stderr}`));
    });
  });
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (existsSync(path)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
  throw new Error(`Timed out waiting for worker marker: ${path}`);
}
