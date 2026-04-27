import { spawn, execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

const PHASE = "phase-9c-managed-startup";
const repoRoot = process.cwd();
const repoKey = createHash("sha256").update(repoRoot.toLowerCase()).digest("hex").slice(0, 16);
const stateDir = join(tmpdir(), "unified-ai-system-phase9c");
const logDir = join(stateDir, "logs");
const statePath = join(stateDir, `${repoKey}.json`);
const defaultKnowledgePersistenceDir = join(repoRoot, ".data", "knowledge");
const startupTimeoutMs = toNumber(process.env.PHASE9C_STARTUP_TIMEOUT_MS, 30_000);
const pollIntervalMs = toNumber(process.env.PHASE9C_POLL_INTERVAL_MS, 500);
const shutdownTimeoutMs = toNumber(process.env.PHASE9C_SHUTDOWN_TIMEOUT_MS, 5_000);
const serviceStartArgs = ["./apps/ai-gateway-service/src/index.js"];
const consoleStartArgs = ["./apps/agent-console/src/index.js"];

const mode = process.argv[2];

if (mode === "start") {
  if (process.env.UNIFIED_AI_SYSTEM_PHASE9C_DETACHED_OWNER === "1") {
    await startManagedChain();
  } else {
    await launchManagedChain();
  }
} else if (mode === "stop") {
  await stopManagedChain();
} else if (mode === "status") {
  await showManagedStatus();
} else if (mode === "logs") {
  await showManagedLogs();
} else {
  console.error(`Usage: node ./tools/phase9c/managed-dev.mjs <start|stop|status|logs>`);
  process.exit(1);
}

async function launchManagedChain() {
  const existingState = await readState();

  if (existingState) {
    const existingOwnerInfo = await getProcessInfo(existingState.ownerPid).catch(() => null);

    if (isOwnedProcess(existingOwnerInfo, existingState)) {
      console.log(
        JSON.stringify(
          {
            phase: PHASE,
            status: "already-running",
            running: true,
            ownerPid: existingState.ownerPid,
            childPid: existingState.childPid,
            statePath,
            logPath: existingState.logPath,
            createdAt: existingState.createdAt,
          },
          null,
          2,
        ),
      );
      return;
    }

    await removeState();
  }

  const launcher = spawn(process.execPath, [process.argv[1], "start"], {
    cwd: repoRoot,
    detached: true,
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      UNIFIED_AI_SYSTEM_PHASE9C_DETACHED_OWNER: "1",
    },
  });
  launcher.unref();

  const deadline = Date.now() + startupTimeoutMs + 15_000;
  let lastState = null;

  while (Date.now() < deadline) {
    lastState = await readState();

    if (lastState?.readyAt) {
      const ownerInfo = await getProcessInfo(lastState.ownerPid).catch(() => null);

      if (isOwnedProcess(ownerInfo, lastState)) {
        console.log(
          JSON.stringify(
            {
              phase: PHASE,
              status: "running",
              running: true,
              ownerPid: lastState.ownerPid,
              childPid: lastState.childPid,
              statePath,
              logPath: lastState.logPath,
              createdAt: lastState.createdAt,
              readyAt: lastState.readyAt,
              startupMode: "detached-managed",
            },
            null,
            2,
          ),
        );
        return;
      }
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Timed out waiting for detached managed startup to become ready.${lastState?.logPath ? ` See logs: ${lastState.logPath}` : ""}`,
  );
}

async function startManagedChain() {
  await removeStaleStateOrFail();

  const token = randomUUID();
  const ownerInfo = await getProcessInfo(process.pid).catch(() => null);
  const logPath = join(logDir, `${repoKey}-${token}.log`);
  await mkdir(logDir, { recursive: true });
  await writeFile(logPath, `[${new Date().toISOString()}] ${PHASE} managed output started\n`, "utf8");
  const logStream = createWriteStream(logPath, { flags: "a" });
  let serviceProcess;

  const state = {
    phase: PHASE,
    repoRoot,
    token,
    ownerPid: process.pid,
    ownerCreationDate: ownerInfo?.creationDate ?? null,
    childPid: null,
    servicePid: null,
    command: `${nodeCommandLine(serviceStartArgs)} && ${nodeCommandLine(consoleStartArgs)} (after health ready)`,
    statePath,
    logPath,
    createdAt: new Date().toISOString(),
  };

  let cleanupStarted = false;

  const cleanupAndExit = async (exitCode) => {
    if (cleanupStarted) {
      return;
    }

    cleanupStarted = true;

    if (serviceProcess?.exitCode === null) {
      await stopRecordedTree(state, { includeOwner: false });
    }

    await removeOwnedState(token);
    await closeStream(logStream);
    process.exit(exitCode);
  };

  process.once("SIGINT", () => {
    void cleanupAndExit(130);
  });
  process.once("SIGTERM", () => {
    void cleanupAndExit(143);
  });

  try {
    serviceProcess = runNode(serviceStartArgs, {
      env: createManagedEnv(token),
      stdio: ["ignore", "pipe", "pipe"],
    });
    attachManagedOutput(serviceProcess, logStream);

    state.childPid = serviceProcess.pid ?? null;
    state.servicePid = serviceProcess.pid ?? null;
    await writeState(state);

    writeManagedMessage(
      {
        phase: PHASE,
        status: "service-started",
        ownerPid: state.ownerPid,
        childPid: state.childPid,
        statePath,
        logPath,
      },
      logStream,
    );

    const healthUrl = getHealthUrl();
    await waitForReady({
      url: healthUrl,
      timeoutMs: startupTimeoutMs,
      intervalMs: pollIntervalMs,
      child: serviceProcess,
      logStream,
    });

    const consoleProcess = runNode(consoleStartArgs, {
      env: createManagedEnv(token),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const consoleOutput = attachManagedOutput(consoleProcess, logStream);

    const consoleResult = await waitForProcess(consoleProcess);

    if (consoleResult.exitCode !== 0) {
      const output = collectedOutput(consoleOutput);

      if (!isRetryableProviderTimeout(output)) {
        throw new Error(`Agent console startup check failed with code ${consoleResult.exitCode}.`);
      }

      writeManagedMessage(
        {
          phase: PHASE,
          status: "console-startup-provider-timeout",
          reason: "startup remains running; real provider response validation is handled by health/verify commands",
          consoleExitCode: consoleResult.exitCode,
        },
        logStream,
        process.stderr,
      );
    }

    if (serviceProcess.exitCode !== null) {
      throw new Error(`Service exited during startup with code ${serviceProcess.exitCode}.`);
    }

    state.readyAt = new Date().toISOString();
    state.consoleExitCode = consoleResult.exitCode ?? null;
    state.consoleStartupCheck = consoleResult.exitCode === 0 ? "completed" : "provider-timeout-warning";
    await writeState(state);

    writeManagedMessage(
      {
        phase: PHASE,
        status: "running",
        ownerPid: state.ownerPid,
        childPid: state.childPid,
        statePath,
        logPath,
      },
      logStream,
    );

    const result = await waitForProcess(serviceProcess);
    await removeOwnedState(token);
    await closeStream(logStream);
    process.exit(result.exitCode ?? 1);
  } catch (error) {
    writeManagedMessage(
      {
        phase: PHASE,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        statePath,
        logPath,
      },
      logStream,
      process.stderr,
    );
    await cleanupAndExit(1);
  }
}

async function stopManagedChain() {
  const state = await readState();

  if (!state) {
    console.log(
      JSON.stringify(
        {
          phase: PHASE,
          status: "no-op",
          reason: "no managed startup state found",
          statePath,
        },
        null,
        2,
      ),
    );
    return;
  }

  const { processInfo: ownerInfo } = await getProcessInfoSafe(state.ownerPid);

  if (!isOwnedProcess(ownerInfo, state)) {
    await removeState();
    console.log(
      JSON.stringify(
        {
          phase: PHASE,
          status: "stale-state-removed",
          ownerPid: state.ownerPid,
          statePath,
        },
        null,
        2,
      ),
    );
    return;
  }

  await stopRecordedTree(state, { includeOwner: true });
  await removeState();

  console.log(
    JSON.stringify(
      {
        phase: PHASE,
        status: "stopped",
        ownerPid: state.ownerPid,
        childPid: state.childPid,
        statePath,
      },
      null,
      2,
    ),
  );
}

async function showManagedStatus() {
  const state = await readState();

  if (!state) {
    console.log(
      JSON.stringify(
        {
          phase: PHASE,
          status: "stopped",
          running: false,
          reason: "no managed startup state found",
          statePath,
        },
        null,
        2,
      ),
    );
    return;
  }

  const { processInfo: ownerInfo } = await getProcessInfoSafe(state.ownerPid);

  if (!isOwnedProcess(ownerInfo, state)) {
    console.log(
      JSON.stringify(
        {
          phase: PHASE,
          status: "stale",
          running: false,
          reason: "managed state found but owner process did not match",
          ownerPid: state.ownerPid,
          childPid: state.childPid,
          statePath,
          createdAt: state.createdAt,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(
    JSON.stringify(
      {
        phase: PHASE,
        status: "running",
        running: true,
        ownerPid: state.ownerPid,
        childPid: state.childPid,
        statePath,
        createdAt: state.createdAt,
      },
      null,
      2,
    ),
  );
}

async function getProcessInfoSafe(pid) {
  try {
    return {
      processInfo: await getProcessInfo(pid),
      error: null,
    };
  } catch (error) {
    return {
      processInfo: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function showManagedLogs() {
  const state = await readState();

  if (!state) {
    console.log(
      JSON.stringify(
        {
          phase: PHASE,
          status: "no-output",
          reason: "no managed startup state found; current no attributable output",
          statePath,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!state.logPath) {
    console.log(
      JSON.stringify(
        {
          phase: PHASE,
          status: "no-output",
          reason: "managed state has no logPath",
          statePath,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!isManagedLogPath(state.logPath)) {
    console.error(
      JSON.stringify(
        {
          phase: PHASE,
          status: "invalid-log-path",
          reason: "managed logPath is outside the expected Phase 9C log directory",
          statePath,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  try {
    const output = await readFile(state.logPath, "utf8");

    if (!output) {
      console.log(
        JSON.stringify(
          {
            phase: PHASE,
            status: "empty-output",
            logPath: state.logPath,
          },
          null,
          2,
        ),
      );
      return;
    }

    process.stdout.write(output);
    if (!output.endsWith("\n")) {
      process.stdout.write("\n");
    }
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.log(
        JSON.stringify(
          {
            phase: PHASE,
            status: "no-output",
            reason: "managed log file not found",
            logPath: state.logPath,
            statePath,
          },
          null,
          2,
        ),
      );
      return;
    }

    throw error;
  }
}

async function removeStaleStateOrFail() {
  const state = await readState();

  if (!state) {
    return;
  }

  const ownerInfo = await getProcessInfo(state.ownerPid).catch(() => null);

  if (isOwnedProcess(ownerInfo, state)) {
    throw new Error(`Managed startup already appears to be running with PID ${state.ownerPid}.`);
  }

  await removeState();
}

async function stopRecordedTree(state, { includeOwner }) {
  if (process.platform === "win32") {
    const targetPid = includeOwner ? state.ownerPid : state.childPid;

    if (!targetPid) {
      return;
    }

    await waitForProcess(
      spawn("taskkill", ["/pid", String(targetPid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      }),
    );
    return;
  }

  if (state.childPid) {
    killUnixProcessGroup(state.childPid, "SIGTERM");
    await sleep(shutdownTimeoutMs);
    killUnixProcessGroup(state.childPid, "SIGKILL");
  }

  if (includeOwner) {
    killProcess(state.ownerPid, "SIGTERM");
  }
}

function attachManagedOutput(child, logStream) {
  const collector = {
    chunks: [],
  };

  pipeManagedOutput(child.stdout, process.stdout, logStream, collector);
  pipeManagedOutput(child.stderr, process.stderr, logStream, collector);

  return collector;
}

function pipeManagedOutput(source, target, logStream, collector) {
  if (!source) {
    return;
  }

  source.on("data", (chunk) => {
    target.write(chunk);
    logStream.write(chunk);
    collector?.chunks.push(Buffer.from(chunk).toString("utf8"));
  });
}

function collectedOutput(collector) {
  return collector.chunks.join("");
}

function isRetryableProviderTimeout(output) {
  return output.includes("_REQUEST_TIMEOUT") ||
    output.includes("request timed out") ||
    output.includes("HTTP LLM provider request failed") ||
    (
      output.includes('"app": "agent-console"') &&
      output.includes('"phase": "phase-7a-2-console-service-chain"') &&
      output.includes("Gateway request failed")
    );
}

function closeStream(stream) {
  return new Promise((resolveClose) => {
    stream.end(resolveClose);
  });
}

async function waitForReady({ url, timeoutMs, intervalMs, child, logStream }) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Service startup exited before readiness with code ${child.exitCode}.`);
    }

    try {
      const response = await fetch(url);
      const body = await response.json().catch(() => null);

      if (response.ok && body?.data?.status === "ready") {
        writeManagedMessage(
          {
            phase: PHASE,
            status: "service-ready",
            healthUrl: url,
          },
          logStream,
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

function getHealthUrl() {
  const serviceUrl = process.env.AI_GATEWAY_SERVICE_URL ?? "http://127.0.0.1:3100";
  return process.env.PHASE9C_HEALTH_URL ?? `${serviceUrl}/health/check`;
}

function createManagedEnv(token) {
  const nvidiaModel = process.env.NVIDIA_MODEL ?? "meta/llama-3.1-8b-instruct";

  return {
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: process.env.AI_GATEWAY_PROVIDER_MODE ?? "real",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: process.env.AI_GATEWAY_REAL_PROVIDER_ENABLED ?? "true",
    AI_GATEWAY_ROUTE_MODE: process.env.AI_GATEWAY_ROUTE_MODE ?? "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: process.env.AI_GATEWAY_DEFAULT_PROVIDER ?? "nvidia",
    AI_GATEWAY_DEFAULT_MODEL: process.env.AI_GATEWAY_DEFAULT_MODEL ?? nvidiaModel,
    AI_GATEWAY_ENABLED_PROVIDERS: process.env.AI_GATEWAY_ENABLED_PROVIDERS ?? "nvidia",
    AI_GATEWAY_REQUEST_TIMEOUT_MS: process.env.AI_GATEWAY_REQUEST_TIMEOUT_MS ?? "60000",
    AI_GATEWAY_SERVICE_URL: process.env.AI_GATEWAY_SERVICE_URL ?? "http://127.0.0.1:3100",
    KNOWLEDGE_STORAGE_MODE: process.env.KNOWLEDGE_STORAGE_MODE ?? "file-sqlite",
    KNOWLEDGE_PERSISTENCE_DIR: process.env.KNOWLEDGE_PERSISTENCE_DIR ?? defaultKnowledgePersistenceDir,
    NVIDIA_MODEL: nvidiaModel,
    UNIFIED_AI_SYSTEM_PHASE9C_OWNER: token,
  };
}

function writeManagedMessage(payload, logStream, target = process.stdout) {
  const message = JSON.stringify(payload, null, 2);
  target.write(`${message}\n`);
  logStream.write(`${message}\n`);
}

function runNode(args, options) {
  return spawn(process.execPath, args, {
    cwd: repoRoot,
    detached: process.platform !== "win32",
    windowsHide: true,
    ...options,
  });
}

async function writeState(state) {
  await mkdir(stateDir, { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function readState() {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function removeState() {
  await rm(statePath, { force: true });
}

async function removeOwnedState(token) {
  const state = await readState();

  if (state?.token === token) {
    await removeState();
  }
}

function isOwnedProcess(processInfo, state) {
  if (!processInfo || Number(processInfo.pid) !== Number(state.ownerPid)) {
    return false;
  }

  if (state.ownerCreationDate && processInfo.creationDate !== state.ownerCreationDate) {
    return false;
  }

  const commandLine = String(processInfo.commandLine ?? "");

  return commandLine.includes("managed-dev.mjs") && commandLine.includes("start");
}

async function getProcessInfo(pid) {
  if (!pid) {
    return null;
  }

  if (process.platform === "win32") {
    const script = `
$p = Get-CimInstance Win32_Process -Filter "ProcessId = ${Number(pid)}"
if ($null -eq $p) { exit 0 }
[pscustomobject]@{
  ProcessId = $p.ProcessId
  ParentProcessId = $p.ParentProcessId
  CreationDate = [string]$p.CreationDate
  CommandLine = $p.CommandLine
} | ConvertTo-Json -Compress
`;
    const output = await execFileText("powershell.exe", ["-NoProfile", "-EncodedCommand", encodePowerShell(script)]);

    if (!output.trim()) {
      return null;
    }

    const parsedOutput = JSON.parse(output);
    const parsed = Array.isArray(parsedOutput) ? parsedOutput[0] : parsedOutput;

    return {
      pid: parsed.ProcessId,
      parentPid: parsed.ParentProcessId,
      creationDate: parsed.CreationDate,
      commandLine: parsed.CommandLine ?? "",
    };
  }

  const commandLine = (await readFile(`/proc/${pid}/cmdline`, "utf8")).replace(/\0/g, " ");

  return {
    pid,
    parentPid: null,
    creationDate: null,
    commandLine,
  };
}

function isManagedLogPath(logPath) {
  const resolvedLogPath = resolve(logPath);
  const resolvedLogDir = resolve(logDir);

  return (
    (resolvedLogPath === resolvedLogDir || resolvedLogPath.startsWith(`${resolvedLogDir}${sep}`)) &&
    basename(resolvedLogPath).startsWith(`${repoKey}-`)
  );
}

function execFileText(command, args) {
  return new Promise((resolveExec, rejectExec) => {
    execFile(
      command,
      args,
      {
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          rejectExec(error);
          return;
        }

        resolveExec(stdout);
      },
    );
  });
}

function encodePowerShell(script) {
  return Buffer.from(script, "utf16le").toString("base64");
}

function waitForProcess(child) {
  return new Promise((resolveWait) => {
    child.once("close", (exitCode, signal) => {
      resolveWait({ exitCode, signal });
    });
  });
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

function killUnixProcessGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") {
      throw error;
    }
  }
}

function killProcess(pid, signal) {
  try {
    process.kill(pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") {
      throw error;
    }
  }
}

function nodeCommandLine(args) {
  return [process.execPath, ...args].map(quoteCmdArg).join(" ");
}

function quoteCmdArg(value) {
  const text = String(value);

  if (/^[A-Za-z0-9_/:.@=-]+$/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '\\"')}"`;
}
