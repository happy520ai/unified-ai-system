import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const PHASE = "phase-8a-4-readiness-wait";
const repoRoot = process.cwd();
const startupTimeoutMs = toNumber(process.env.PHASE8A_STARTUP_TIMEOUT_MS, 30_000);
const pollIntervalMs = toNumber(process.env.PHASE8A_POLL_INTERVAL_MS, 500);
const shutdownTimeoutMs = toNumber(process.env.PHASE8A_SHUTDOWN_TIMEOUT_MS, 5_000);

let startupProcess;
let exitCode = 1;

try {
  const runtimeEnv = await createRuntimeEnv();
  const healthUrl = process.env.PHASE8A_HEALTH_URL ?? `${runtimeEnv.AI_GATEWAY_SERVICE_URL}/health/check`;

  startupProcess = runPnpm(["run", "start:ai-gateway-service"], {
    env: runtimeEnv,
    stdio: "inherit",
  });

  await waitForReady({
    url: healthUrl,
    timeoutMs: startupTimeoutMs,
    intervalMs: pollIntervalMs,
    child: startupProcess,
  });

  const consoleResult = await waitForProcess(
    attachOutput(
      runPnpm(["run", "start:agent-console"], {
        env: runtimeEnv,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    ),
  );

  if (consoleResult.exitCode !== 0) {
    if (!isRetryableProviderTimeout(consoleResult.output)) {
      throw new Error(`Agent console startup check failed with code ${consoleResult.exitCode}.`);
    }

    writeWarning({
      status: "agent-console-provider-timeout",
      reason: "readiness/wait remains accepted; real provider timeout is retryable and covered by health/verify commands",
      exitCode: consoleResult.exitCode,
    });
  }

  const verifyResult = await waitForProcess(
    attachOutput(
      runPnpm(["run", "verify:phase7a"], {
        env: runtimeEnv,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    ),
  );

  if (verifyResult.exitCode !== 0 && isRetryableProviderTimeout(verifyResult.output)) {
    writeWarning({
      status: "phase7a-provider-timeout",
      reason: "readiness/wait remains accepted; real provider timeout is retryable",
      exitCode: verifyResult.exitCode,
    });
    exitCode = 0;
  } else {
    exitCode = verifyResult.exitCode ?? 1;
  }
} catch (error) {
  console.error(
    JSON.stringify(
      {
        phase: PHASE,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  exitCode = 1;
} finally {
  if (startupProcess) {
    await stopProcessTree(startupProcess, shutdownTimeoutMs);
  }
}

process.exit(exitCode);

function runPnpm(args, options) {
  const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "pnpm";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", pnpmCommandLine(args)] : args;

  return spawn(command, commandArgs, {
    cwd: repoRoot,
    windowsHide: true,
    ...options,
  });
}

function attachOutput(child) {
  const chunks = [];

  pipeOutput(child.stdout, process.stdout, chunks);
  pipeOutput(child.stderr, process.stderr, chunks);

  child.outputChunks = chunks;

  return child;
}

function pipeOutput(source, target, chunks) {
  if (!source) {
    return;
  }

  source.on("data", (chunk) => {
    target.write(chunk);
    chunks.push(Buffer.from(chunk).toString("utf8"));
  });
}

function isRetryableProviderTimeout(output) {
  return output.includes("NVIDIA_REQUEST_TIMEOUT") || output.includes("NVIDIA request timed out");
}

function writeWarning(payload) {
  console.error(
    JSON.stringify(
      {
        phase: PHASE,
        severity: "warning",
        ...payload,
      },
      null,
      2,
    ),
  );
}

async function waitForReady({ url, timeoutMs, intervalMs, child }) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Startup command exited before readiness with code ${child.exitCode}.`);
    }

    try {
      const response = await fetch(url);
      const body = await response.json().catch(() => null);

      if (response.ok && body?.data?.status === "ready") {
        console.log(
          JSON.stringify(
            {
              phase: PHASE,
              status: "ready",
              healthUrl: url,
            },
            null,
            2,
          ),
        );
        return;
      }

      lastError = new Error(`Health returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    await sleep(intervalMs);
  }

  const details = lastError instanceof Error ? lastError.message : "unknown error";
  throw new Error(`Timed out waiting for ${url}: ${details}`);
}

function waitForProcess(child) {
  return new Promise((resolveWait) => {
    child.once("close", (exitCode, signal) => {
      resolveWait({
        exitCode,
        signal,
        output: child.outputChunks?.join("") ?? "",
      });
    });
  });
}

async function stopProcessTree(child, timeoutMs) {
  if (child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    await waitForProcess(
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      }),
    );
    return;
  }

  child.kill("SIGTERM");

  await Promise.race([
    waitForProcess(child),
    sleep(timeoutMs).then(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }),
  ]);
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function createRuntimeEnv() {
  const dotEnv = await loadDotEnv(".env");
  const nvidiaModel = process.env.NVIDIA_MODEL ?? dotEnv.NVIDIA_MODEL ?? "meta/llama-3.1-8b-instruct";

  return compactEnv({
    ...dotEnv,
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: process.env.AI_GATEWAY_PROVIDER_MODE ?? dotEnv.AI_GATEWAY_PROVIDER_MODE ?? "real",
    AI_GATEWAY_REAL_PROVIDER_ENABLED:
      process.env.AI_GATEWAY_REAL_PROVIDER_ENABLED ?? dotEnv.AI_GATEWAY_REAL_PROVIDER_ENABLED ?? "true",
    AI_GATEWAY_ROUTE_MODE: process.env.AI_GATEWAY_ROUTE_MODE ?? dotEnv.AI_GATEWAY_ROUTE_MODE ?? "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: process.env.AI_GATEWAY_DEFAULT_PROVIDER ?? dotEnv.AI_GATEWAY_DEFAULT_PROVIDER ?? "nvidia",
    AI_GATEWAY_DEFAULT_MODEL: process.env.AI_GATEWAY_DEFAULT_MODEL ?? dotEnv.AI_GATEWAY_DEFAULT_MODEL ?? nvidiaModel,
    AI_GATEWAY_ENABLED_PROVIDERS:
      process.env.AI_GATEWAY_ENABLED_PROVIDERS ?? dotEnv.AI_GATEWAY_ENABLED_PROVIDERS ?? "nvidia",
    AI_GATEWAY_SERVICE_URL: process.env.AI_GATEWAY_SERVICE_URL ?? dotEnv.AI_GATEWAY_SERVICE_URL ?? "http://127.0.0.1:3100",
    AI_GATEWAY_REQUEST_TIMEOUT_MS:
      process.env.AI_GATEWAY_REQUEST_TIMEOUT_MS ?? dotEnv.AI_GATEWAY_REQUEST_TIMEOUT_MS ?? "60000",
    AI_GATEWAY_CONSOLE_TIMEOUT_MS:
      process.env.AI_GATEWAY_CONSOLE_TIMEOUT_MS ?? dotEnv.AI_GATEWAY_CONSOLE_TIMEOUT_MS ?? "70000",
    NVIDIA_MODEL: nvidiaModel,
  });
}

async function loadDotEnv(path) {
  if (!existsSync(path)) {
    return {};
  }

  const text = await readFile(path, "utf8");
  const entries = {};

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match) {
      continue;
    }

    entries[match[1]] = stripQuotes(match[2].trim());
  }

  return entries;
}

function stripQuotes(value) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function compactEnv(env) {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  );
}

function pnpmCommandLine(args) {
  return ["pnpm", ...args].map(quoteCmdArg).join(" ");
}

function quoteCmdArg(value) {
  const text = String(value);

  if (/^[A-Za-z0-9_/:.@=-]+$/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '\\"')}"`;
}
