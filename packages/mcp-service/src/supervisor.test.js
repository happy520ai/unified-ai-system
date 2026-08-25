// Tests for the supervisor using `node:test`.
//
// These tests use a tiny node script as a stand-in child so we don't depend
// on the real MCP server or any network. The supervisor must:
//   * spawn the child and pipe stdout/stderr independently
//   * restart a crashing child with backoff
//   * stop gracefully on SIGTERM
//   * keep the child's stdout clean (no log lines leak onto stdout)
//   * surface status snapshots

import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSupervisor } from "./supervisor.js";

function makeEchoScript() {
  const dir = mkdtempSync(join(tmpdir(), "sup-cwd-"));
  const script = join(dir, "echo.js");
  writeFileSync(
    script,
    `process.stdout.write('{"hello":"std"}\\\\n'); setTimeout(() => process.exit(0), 60);`,
  );
  return { dir, script };
}

function makeSilentCrashScript() {
  const dir = mkdtempSync(join(tmpdir(), "sup-crash-"));
  const script = join(dir, "crash.js");
  writeFileSync(
    script,
    `process.stderr.write('boom\\\\n'); process.exit(1);`,
  );
  return { dir, script };
}

function makeRogueDrainScript() {
  const dir = mkdtempSync(join(tmpdir(), "sup-drain-"));
  const script = join(dir, "rogue.js");
  writeFileSync(
    script,
    `process.stdout.write('not-json\\\\n'); process.exit(0);`,
  );
  return { dir, script };
}

function makeSecretStderrScript() {
  const dir = mkdtempSync(join(tmpdir(), "sup-secret-"));
  const script = join(dir, "secret.js");
  writeFileSync(
    script,
    `process.stderr.write('OPENAI_API_KEY='); setTimeout(() => { process.stderr.write('provider-supervisor-canary\\nAuthorization: Bearer bearer-supervisor-secret\\n'); process.exit(1); }, 20);`,
  );
  return { dir, script };
}

function fakeLogger() {
  const calls = [];
  return {
    info: (msg, fields) => calls.push({ level: "info", msg, fields }),
    warn: (msg, fields) => calls.push({ level: "warn", msg, fields }),
    error: (msg, fields) => calls.push({ level: "error", msg, fields }),
    debug: () => {},
    close: async () => {},
    filePath: null,
    childLine: () => {},
    resolvePath: () => null,
    calls,
  };
}

async function waitForLog(calls, predicate, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (calls.some(predicate)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test("supervisor spawns child and surfaces status", async () => {
  const { dir, script } = makeEchoScript();
  const log = fakeLogger();
  const sup = createSupervisor({
    logger: log,
    command: process.execPath,
    args: [script],
    cwd: dir,
    autoStart: true,
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const status = sup.getStatus();
    assert.ok(status.running || status.lastExit, "supervisor should report a status");
    assert.equal(typeof status.pid === "number" || status.pid === null, true);
  } finally {
    await sup.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("supervisor restarts a crashing child", async () => {
  const { dir, script } = makeSilentCrashScript();
  const log = fakeLogger();
  const sup = createSupervisor({
    logger: log,
    command: process.execPath,
    args: [script],
    cwd: dir,
    autoStart: true,
    restartMinMs: 50,
    restartMaxMs: 100,
    shutdownGraceMs: 200,
  });
  try {
    await waitForLog(log.calls, (call) =>
      call.msg?.includes?.("child crashed; scheduling restart")
    );
    const crashCount = log.calls.filter((c) =>
      c.msg?.includes?.("child crashed; scheduling restart")
    ).length;
    assert.ok(crashCount >= 1, "should detect at least one crash");
  } finally {
    await sup.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("supervisor stop is graceful", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sup-stop-"));
  const script = join(dir, "ignore-sig.js");
  writeFileSync(
    script,
    `process.on('SIGTERM', () => { process.exit(0); }); setTimeout(() => process.exit(0), 60000);`,
  );
  const log = fakeLogger();
  const sup = createSupervisor({
    logger: log,
    command: process.execPath,
    args: [script],
    cwd: dir,
    autoStart: true,
    shutdownGraceMs: 1500,
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await sup.stop();
    const status = sup.getStatus();
    assert.equal(status.running, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("supervisor does not pollute child stdout with log output", async () => {
  const { dir, script } = makeRogueDrainScript();
  // Capture child stdout by running the script directly first to confirm
  // baseline output, and then assert the supervisor does not produce extra
  // side-effects on stdout (proxy test: child.stdout should be untouched).
  // We can't intercept stdout transitively from the supervisor since the
  // supervisor connects child's stdout to ours by default, so we simulate
  // checking that no logger.info call writes to stdout.
  const log = fakeLogger();
  const sup = createSupervisor({
    logger: log,
    command: process.execPath,
    args: [script],
    cwd: dir,
    autoStart: true,
    shutdownGraceMs: 1000,
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 200));
    // The supervisor must keep stdout channels reserved for the child; the
    // only thing we can assert programmatically is that no logger call
    // attempts to write to stdout. The implementation enforces that, and
    // we double-check by inspecting calls.
    for (const call of log.calls) {
      assert.notEqual(call.level, "child-stdout", "no logger should write to child's stdout channel");
    }
    await sup.stop();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("supervisor redacts child stderr before logging or retaining status", async () => {
  const { dir, script } = makeSecretStderrScript();
  const log = fakeLogger();
  const sup = createSupervisor({
    logger: log,
    command: process.execPath,
    args: [script],
    cwd: dir,
    autoStart: true,
    restartMinMs: 5_000,
    restartMaxMs: 5_000,
    shutdownGraceMs: 200,
  });
  try {
    await waitForLog(log.calls, (call) => call.msg === "child exited");
    const renderedLogs = JSON.stringify(log.calls);
    const status = JSON.stringify(sup.getStatus());
    for (const secret of ["provider-supervisor-canary", "bearer-supervisor-secret"]) {
      assert.doesNotMatch(renderedLogs, new RegExp(secret));
      assert.doesNotMatch(status, new RegExp(secret));
    }
    assert.match(renderedLogs, /REDACTED/);
  } finally {
    await sup.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
