import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../../ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../../ai-gateway-service/src/http/httpServer.js";

const PHASE = "phase-7d-error-logging";
const DEFAULT_NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-7d-error-logging.json");
const evidenceMdPath = resolve(evidenceDir, "phase-7d-error-logging.md");

const dotEnv = await loadDotEnv(resolve(repoRoot, ".env"));
const baseEnv = compactEnv({
  ...dotEnv,
  ...process.env,
  AI_GATEWAY_PROVIDER_MODE: "real",
  AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
  AI_GATEWAY_ROUTE_MODE: "fixed",
  AI_GATEWAY_DEFAULT_PROVIDER: "nvidia",
  AI_GATEWAY_DEFAULT_MODEL: process.env.NVIDIA_MODEL ?? dotEnv.NVIDIA_MODEL ?? DEFAULT_NVIDIA_MODEL,
  AI_GATEWAY_ENABLED_PROVIDERS: "nvidia",
  AI_GATEWAY_CONSOLE_TIMEOUT_MS: process.env.AI_GATEWAY_CONSOLE_TIMEOUT_MS ?? "60000",
  NVIDIA_MODEL: process.env.NVIDIA_MODEL ?? dotEnv.NVIDIA_MODEL ?? DEFAULT_NVIDIA_MODEL,
});

const capturedLogs = [];
const originalConsoleError = console.error;
console.error = (...args) => {
  captureServiceLog(args);
  originalConsoleError(...args);
};

let evidence;

try {
  if (!baseEnv.NVIDIA_API_KEY) {
    evidence = createEvidence({
      status: "blocked",
      generatedAt: new Date().toISOString(),
      env: baseEnv,
      successCase: null,
      errorCase: null,
      logs: capturedLogs,
      conclusion: "blocked: NVIDIA_API_KEY is not present",
    });
    process.exitCode = 1;
  } else {
    const successCase = await runConsoleAgainstService({
      env: baseEnv,
      prompt: "Phase 7D success path verification. Reply with one short confirmation sentence.",
    });
    const errorCase = await runConsoleAgainstService({
      env: {
        ...baseEnv,
        NVIDIA_API_KEY: "",
      },
      prompt: "Phase 7D error path verification.",
    });
    const passed = isSuccessCaseStable(successCase) && isErrorCaseStable(errorCase) && areLogsStable(capturedLogs);

    evidence = createEvidence({
      status: passed ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      env: baseEnv,
      successCase,
      errorCase,
      logs: capturedLogs,
      conclusion: passed ? "error-handling-and-logging-stable" : "error-handling-or-logging-not-stable",
    });
    process.exitCode = passed ? 0 : 1;
  }
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    env: baseEnv,
    successCase: null,
    errorCase: null,
    logs: capturedLogs,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "error-handling-or-logging-not-stable",
  });
  process.exitCode = 1;
} finally {
  console.error = originalConsoleError;
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
}

async function runConsoleAgainstService({ env, prompt }) {
  const application = createGatewayApplication(env);
  const server = createGatewayHttpServer(application);

  await listen(server, 0, "127.0.0.1");

  try {
    const serviceUrl = `http://127.0.0.1:${server.address().port}`;
    const consoleResult = await runNode({
      args: [resolve(repoRoot, "apps/agent-console/src/index.js")],
      cwd: repoRoot,
      env: compactEnv({
        ...env,
        AI_GATEWAY_SERVICE_URL: serviceUrl,
        AI_GATEWAY_CONSOLE_PROMPT: prompt,
      }),
      timeoutMs: Number(env.AI_GATEWAY_CONSOLE_TIMEOUT_MS),
    });

    return {
      serviceUrl,
      console: {
        exitCode: consoleResult.exitCode,
        signal: consoleResult.signal,
        stdout: parseJson(consoleResult.stdout),
        stderr: parseJson(consoleResult.stderr),
      },
    };
  } finally {
    await close(server);
  }
}

function isSuccessCaseStable(result) {
  const output = result?.console?.stdout;
  const gateway = output?.gateway;

  return (
    result?.console?.exitCode === 0 &&
    output?.status === "completed" &&
    output?.health?.status === "ready" &&
    gateway?.selectedProvider === "nvidia" &&
    gateway?.executionMode === "real" &&
    gateway?.executionStatus === "success" &&
    typeof gateway?.outputText === "string" &&
    gateway.outputText.length > 0
  );
}

function isErrorCaseStable(result) {
  const output = result?.console?.stderr;
  const serviceError = output?.error?.service?.error;

  return (
    result?.console?.exitCode === 1 &&
    output?.status === "failed" &&
    output?.error?.statusCode === 400 &&
    serviceError?.code === "NVIDIA_API_KEY_MISSING" &&
    serviceError?.provider === "nvidia"
  );
}

function areLogsStable(logs) {
  const events = new Set(logs.map((log) => log.event));

  return (
    events.has("request_received") &&
    events.has("provider_call_start") &&
    events.has("provider_call_completed") &&
    events.has("provider_call_failed") &&
    events.has("request_completed") &&
    events.has("request_failed")
  );
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

function listen(server, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, host, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

function close(server) {
  return new Promise((resolveClose) => {
    server.close(() => resolveClose());
  });
}

function runNode({ args, cwd, env, timeoutMs }) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks = {
      stdout: [],
      stderr: [],
    };
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => chunks.stdout.push(chunk));
    child.stderr.on("data", (chunk) => chunks.stderr.push(chunk));
    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      resolveRun({
        exitCode,
        signal,
        stdout: Buffer.concat(chunks.stdout).toString("utf8"),
        stderr: Buffer.concat(chunks.stderr).toString("utf8"),
      });
    });
  });
}

function parseJson(text) {
  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function captureServiceLog(args) {
  const text = args.join(" ");

  try {
    const log = JSON.parse(text);

    if (log.app === "ai-gateway-service" && log.event) {
      capturedLogs.push(log);
    }
  } catch {
    // Non-JSON stderr belongs to the process running the verifier.
  }
}

function createEvidence({ status, generatedAt, env, successCase, errorCase, logs, conclusion, error }) {
  return {
    phase: PHASE,
    status,
    generatedAt,
    nvidiaApiKeyPresent: Boolean(env.NVIDIA_API_KEY),
    nvidiaModel: env.NVIDIA_MODEL ?? DEFAULT_NVIDIA_MODEL,
    successCase: summarizeSuccessCase(successCase),
    errorCase: summarizeErrorCase(errorCase),
    logs: summarizeLogs(logs),
    error: error ?? null,
    conclusion,
  };
}

function summarizeSuccessCase(result) {
  const output = result?.console?.stdout;
  const gateway = output?.gateway;

  return {
    consoleExitCode: result?.console?.exitCode ?? null,
    consoleStatus: output?.status ?? null,
    serviceHealthStatus: output?.health?.status ?? null,
    selectedProvider: gateway?.selectedProvider ?? null,
    selectedModel: gateway?.selectedModel ?? null,
    executionMode: gateway?.executionMode ?? null,
    executionStatus: gateway?.executionStatus ?? null,
    outputTextPresent: typeof gateway?.outputText === "string" && gateway.outputText.length > 0,
  };
}

function summarizeErrorCase(result) {
  const output = result?.console?.stderr;
  const serviceError = output?.error?.service?.error;

  return {
    consoleExitCode: result?.console?.exitCode ?? null,
    consoleStatus: output?.status ?? null,
    statusCode: output?.error?.statusCode ?? null,
    code: serviceError?.code ?? output?.error?.service?.code ?? null,
    message: serviceError?.message ?? output?.error?.service?.message ?? null,
    retryable: serviceError?.retryable ?? null,
    provider: serviceError?.provider ?? null,
    model: serviceError?.model ?? null,
  };
}

function summarizeLogs(logs) {
  return {
    events: logs.map((log) => log.event),
    requestReceived: logs.some((log) => log.event === "request_received"),
    providerCallStart: logs.some((log) => log.event === "provider_call_start"),
    providerCallCompleted: logs.some((log) => log.event === "provider_call_completed"),
    providerCallFailed: logs.some((log) => log.event === "provider_call_failed"),
    requestCompleted: logs.some((log) => log.event === "request_completed"),
    requestFailed: logs.some((log) => log.event === "request_failed"),
  };
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 7D Error Handling and Logging Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- NVIDIA API key present: ${body.nvidiaApiKeyPresent}
- NVIDIA model: ${body.nvidiaModel}
- Success console status: ${body.successCase?.consoleStatus ?? "n/a"}
- Success selected provider: ${body.successCase?.selectedProvider ?? "n/a"}
- Success execution status: ${body.successCase?.executionStatus ?? "n/a"}
- Error console status: ${body.errorCase?.consoleStatus ?? "n/a"}
- Error status code: ${body.errorCase?.statusCode ?? "n/a"}
- Error code: ${body.errorCase?.code ?? "n/a"}
- Error provider: ${body.errorCase?.provider ?? "n/a"}
- Log events: ${body.logs.events.join(", ") || "n/a"}
- Conclusion: ${body.conclusion}
`;
}

function compactEnv(env) {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  );
}
