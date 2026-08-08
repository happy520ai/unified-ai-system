// Process supervisor for the MCP server. Spawns the child, streams its
// stderr through the logger (stdout is reserved for JSON-RPC), and restarts
// it on crash with exponential backoff. Shutdown is graceful: SIGTERM is
// forwarded, and the supervisor waits up to `shutdownGraceMs` before SIGKILL.

import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_RESTART_MIN_MS = 1_000;
const DEFAULT_RESTART_MAX_MS = 60_000;
const DEFAULT_SHUTDOWN_GRACE_MS = 5_000;
const DEFAULT_STDERR_TAIL_LIMIT = 12_000;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createSupervisor(options = {}) {
  const {
    logger,
    command = process.execPath,
    args = [],
    cwd,
    env = {},
    restartMinMs = DEFAULT_RESTART_MIN_MS,
    restartMaxMs = DEFAULT_RESTART_MAX_MS,
    shutdownGraceMs = DEFAULT_SHUTDOWN_GRACE_MS,
    stderrTailLimit = DEFAULT_STDERR_TAIL_LIMIT,
    healthCheck = null,
    spawnProcess = spawn,
    autoStart = true,
    now = () => Date.now(),
  } = options;

  if (!logger || typeof logger.info !== "function") {
    throw new Error("supervisor requires a logger with info/warn/error helpers");
  }

  let child = null;
  let stopping = false;
  let restartCount = 0;
  let consecutiveFailures = 0;
  let lastStartAt = null;
  let lastStopAt = null;
  let lastExit = null;
  let stderrTail = "";
  let healthState = { lastCheckAt: 0, lastOkAt: 0, lastError: null };
  let statusListeners = new Set();

  function emitStatus() {
    const snapshot = snapshotStatus();
    for (const listener of statusListeners) {
      try {
        listener(snapshot);
      } catch (error) {
        logger.warn("status listener threw", { error: error.message });
      }
    }
  }

  function snapshotStatus() {
    return {
      running: child !== null && child.exitCode === null,
      pid: child?.pid ?? null,
      uptimeMs: lastStartAt ? now() - lastStartAt : 0,
      restartCount,
      lastExit,
      health: { ...healthState },
      stderrTail,
    };
  }

  function appendTail(line) {
    stderrTail = `${stderrTail}${line}`.slice(-stderrTailLimit);
  }

  async function stopChild(childInstance) {
    if (!childInstance || childInstance.exitCode !== null) return;
    if (typeof childInstance.kill !== "function") return;
    childInstance.kill("SIGTERM");
    const exited = Promise.race([
      once(childInstance, "exit"),
      delay(shutdownGraceMs),
    ]);
    await exited;
    if (childInstance.exitCode === null) {
      childInstance.kill("SIGKILL");
      await Promise.race([
        once(childInstance, "exit"),
        delay(2_000),
      ]);
    }
  }

  function backoffDelayMs() {
    const base = clamp(
      restartMinMs * 2 ** Math.max(0, consecutiveFailures - 1),
      restartMinMs,
      restartMaxMs,
    );
    const jitter = Math.random() * (base * 0.2);
    return Math.round(base + jitter);
  }

  async function startOnce() {
    if (stopping) return null;
    const spawnOptions = {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    };
    logger.info("spawning mcp server child", {
      command,
      args,
      pidHint: null,
    });
    const spawned = spawnProcess(command, args, spawnOptions);
    child = spawned;
    lastStartAt = now();
    emitStatus();

    let stderrBuffer = "";
    spawned.stderr?.setEncoding("utf8");
    spawned.stderr?.on("data", (chunk) => {
      stderrBuffer += chunk;
      const lastLine = chunk.split(/\r?\n/).filter(Boolean).slice(-5).join("\n");
      appendTail(chunk);
      if (lastLine) {
        logger.warn("child stderr", { tail: lastLine });
      }
    });
    spawned.stdout?.on("data", () => {
      // stdout is the JSON-RPC channel and must remain untouched.
      // We intentionally do not tee it to any logger.
    });
    spawned.on("exit", (code, signal) => {
      child = null;
      lastStopAt = now();
      lastExit = { code, signal, at: new Date(lastStopAt).toISOString() };
      stderrTail = stderrBuffer.slice(-stderrTailLimit);
      logger.info("child exited", {
        code,
        signal,
        restartCount,
        consecutiveFailures,
      });
      emitStatus();
      if (stopping) return;
      const crashed = code !== 0;
      if (crashed) {
        consecutiveFailures += 1;
        const wait = backoffDelayMs();
        logger.warn("child crashed; scheduling restart", {
          waitMs: wait,
          consecutiveFailures,
        });
        setTimeout(() => {
          void startOnce().then((ok) => {
            if (ok) {
              consecutiveFailures = 0;
              restartCount += 1;
            }
          });
        }, wait).unref?.();
      } else {
        // Graceful exit (exit 0) while not stopping = the child decided to
        // exit. Treat it like a crash so the service stays up but with the
        // same backoff to avoid flapping.
        consecutiveFailures += 1;
        const wait = backoffDelayMs();
        logger.warn("child exited cleanly; keeping service alive", { waitMs: wait });
        setTimeout(() => {
          void startOnce().then((ok) => {
            if (ok) {
              restartCount += 1;
            }
          });
        }, wait).unref?.();
      }
    });

    spawned.on("error", (error) => {
      logger.error("child spawn error", { message: error.message });
    });

    if (healthCheck) {
      void runHealthLoop();
    }
    return spawned;
  }

  async function runHealthLoop() {
    const probeInterval = healthCheck.intervalMs ?? 15_000;
    while (!stopping && child && child.exitCode === null) {
      const startedAt = now();
      healthState.lastCheckAt = startedAt;
      try {
        await healthCheck.probe({
          pid: child.pid,
          startedAt,
          logger,
        });
        healthState.lastOkAt = startedAt;
        healthState.lastError = null;
      } catch (error) {
        healthState.lastError = error.message;
        logger.warn("health probe failed", { message: error.message });
      }
      emitStatus();
      await delay(probeInterval);
    }
  }

  async function start() {
    if (child) {
      return child;
    }
    stopping = false;
    const ok = await startOnce();
    if (ok) restartCount += 1;
    return ok;
  }

  async function stop() {
    stopping = true;
    if (child) {
      await stopChild(child);
    }
    child = null;
    emitStatus();
  }

  function onStatus(listener) {
    statusListeners.add(listener);
    listener(snapshotStatus());
    return () => statusListeners.delete(listener);
  }

  function getStatus() {
    return snapshotStatus();
  }

  if (autoStart) {
    // Defer to next tick so the caller can register listeners first.
    setTimeout(() => {
      void start();
    }, 0).unref?.();
  }

  return {
    start,
    stop,
    onStatus,
    getStatus,
    getChild: () => child,
  };
}

export const supervisorInternals = {
  clamp,
};
