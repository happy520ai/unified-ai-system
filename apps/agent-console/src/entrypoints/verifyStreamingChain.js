import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../../ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../../ai-gateway-service/src/http/httpServer.js";

const PHASE = "phase-8a-streaming-chain";
const DEFAULT_NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-8a-streaming-chain.json");
const evidenceMdPath = resolve(evidenceDir, "phase-8a-streaming-chain.md");

const dotEnv = await loadDotEnv(resolve(repoRoot, ".env"));
const verificationEnv = compactEnv({
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

let server;
let evidence;

if (!verificationEnv.NVIDIA_API_KEY) {
  evidence = createEvidence({
    status: "blocked",
    generatedAt: new Date().toISOString(),
    env: verificationEnv,
    serviceUrl: null,
    healthEnvelope: null,
    streamingResult: null,
    nonStreamingResult: null,
    conclusion: "blocked: NVIDIA_API_KEY is not present",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} else {
  try {
    const application = createGatewayApplication(verificationEnv);
    server = createGatewayHttpServer(application);
    await listen(server, 0, "127.0.0.1");

    const serviceUrl = `http://127.0.0.1:${server.address().port}`;
    const healthEnvelope = await fetchJson(`${serviceUrl}/health/check`);
    const streamingResult = await runConsole({
      env: {
        ...verificationEnv,
        AI_GATEWAY_SERVICE_URL: serviceUrl,
        AI_GATEWAY_CONSOLE_STREAM: "true",
        AI_GATEWAY_CONSOLE_PROMPT:
          "Phase 8A streaming verification. Reply with one short confirmation sentence.",
      },
    });
    const nonStreamingResult = await runConsole({
      env: {
        ...verificationEnv,
        AI_GATEWAY_SERVICE_URL: serviceUrl,
        AI_GATEWAY_CONSOLE_STREAM: "false",
        AI_GATEWAY_CONSOLE_PROMPT:
          "Phase 8A non-streaming baseline verification. Reply with one short confirmation sentence.",
      },
    });
    const passed =
      isStreamingStable({ healthEnvelope, streamingResult }) && isNonStreamingStable({ healthEnvelope, nonStreamingResult });

    evidence = createEvidence({
      status: passed ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      env: verificationEnv,
      serviceUrl,
      healthEnvelope,
      streamingResult,
      nonStreamingResult,
      conclusion: passed ? "streaming-chain-connected" : "streaming-chain-not-connected",
    });
    await writeEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    evidence = createEvidence({
      status: "failed",
      generatedAt: new Date().toISOString(),
      env: verificationEnv,
      serviceUrl: null,
      healthEnvelope: null,
      streamingResult: null,
      nonStreamingResult: null,
      error: error instanceof Error ? error.message : String(error),
      conclusion: "streaming-chain-not-connected",
    });
    await writeEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = 1;
  } finally {
    if (server) {
      await close(server);
    }
  }
}

async function runConsole({ env }) {
  const result = await runNode({
    args: [resolve(repoRoot, "apps/agent-console/src/index.js")],
    cwd: repoRoot,
    env: compactEnv(env),
    timeoutMs: Number(env.AI_GATEWAY_CONSOLE_TIMEOUT_MS),
  });

  return {
    exitCode: result.exitCode,
    signal: result.signal,
    stdout: parseJson(result.stdout),
    stderrPreview: toPreview(result.stderr),
  };
}

function isStreamingStable({ healthEnvelope, streamingResult }) {
  const stream = streamingResult?.stdout?.stream;

  return (
    healthEnvelope?.status === "ok" &&
    healthEnvelope?.data?.routes?.includes("POST /chat/stream") &&
    streamingResult?.exitCode === 0 &&
    streamingResult?.stdout?.status === "completed" &&
    streamingResult?.stdout?.mode === "stream" &&
    stream?.selectedProvider === "nvidia" &&
    stream?.executionMode === "real" &&
    stream?.executionStatus === "success" &&
    stream?.doneReceived === true &&
    stream?.chunkCount > 0 &&
    typeof stream?.outputText === "string" &&
    stream.outputText.length > 0
  );
}

function isNonStreamingStable({ healthEnvelope, nonStreamingResult }) {
  const gateway = nonStreamingResult?.stdout?.gateway;

  return (
    healthEnvelope?.status === "ok" &&
    healthEnvelope?.data?.routes?.includes("POST /chat") &&
    nonStreamingResult?.exitCode === 0 &&
    nonStreamingResult?.stdout?.status === "completed" &&
    gateway?.selectedProvider === "nvidia" &&
    gateway?.executionMode === "real" &&
    gateway?.executionStatus === "success" &&
    typeof gateway?.outputText === "string" &&
    gateway.outputText.length > 0
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

async function fetchJson(url) {
  const response = await fetch(url);
  return response.json();
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

function createEvidence({
  status,
  generatedAt,
  env,
  serviceUrl,
  healthEnvelope,
  streamingResult,
  nonStreamingResult,
  conclusion,
  error,
}) {
  const stream = streamingResult?.stdout?.stream;
  const nonStreamingGateway = nonStreamingResult?.stdout?.gateway;

  return {
    phase: PHASE,
    status,
    generatedAt,
    nvidiaApiKeyPresent: Boolean(env.NVIDIA_API_KEY),
    nvidiaModel: env.NVIDIA_MODEL ?? DEFAULT_NVIDIA_MODEL,
    service: {
      url: serviceUrl,
      healthStatus: healthEnvelope?.data?.status ?? null,
      providerMode: healthEnvelope?.data?.providerMode ?? null,
      realProviderEnabled: healthEnvelope?.data?.realProviderEnabled ?? null,
      providers: healthEnvelope?.data?.providers?.map((provider) => provider.id) ?? [],
      routes: healthEnvelope?.data?.routes ?? [],
    },
    streaming: {
      consoleExitCode: streamingResult?.exitCode ?? null,
      consoleStatus: streamingResult?.stdout?.status ?? null,
      mode: streamingResult?.stdout?.mode ?? null,
      selectedProvider: stream?.selectedProvider ?? null,
      selectedModel: stream?.selectedModel ?? null,
      executionMode: stream?.executionMode ?? null,
      executionStatus: stream?.executionStatus ?? null,
      chunkCount: stream?.chunkCount ?? 0,
      outputTextPresent: typeof stream?.outputText === "string" && stream.outputText.length > 0,
      outputTextPreview: toPreview(stream?.outputText ?? ""),
    },
    nonStreamingBaseline: {
      consoleExitCode: nonStreamingResult?.exitCode ?? null,
      consoleStatus: nonStreamingResult?.stdout?.status ?? null,
      selectedProvider: nonStreamingGateway?.selectedProvider ?? null,
      executionMode: nonStreamingGateway?.executionMode ?? null,
      executionStatus: nonStreamingGateway?.executionStatus ?? null,
      outputTextPresent:
        typeof nonStreamingGateway?.outputText === "string" && nonStreamingGateway.outputText.length > 0,
    },
    error: error ?? null,
    conclusion,
  };
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 8A Streaming Chain Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- NVIDIA API key present: ${body.nvidiaApiKeyPresent}
- NVIDIA model: ${body.nvidiaModel}
- Health status: ${body.service.healthStatus ?? "n/a"}
- Providers: ${body.service.providers.join(", ") || "n/a"}
- Routes: ${body.service.routes.join(", ") || "n/a"}
- Streaming console status: ${body.streaming.consoleStatus ?? "n/a"}
- Streaming selected provider: ${body.streaming.selectedProvider ?? "n/a"}
- Streaming execution mode: ${body.streaming.executionMode ?? "n/a"}
- Streaming execution status: ${body.streaming.executionStatus ?? "n/a"}
- Streaming chunk count: ${body.streaming.chunkCount}
- Streaming output text present: ${body.streaming.outputTextPresent}
- Non-streaming baseline status: ${body.nonStreamingBaseline.consoleStatus ?? "n/a"}
- Non-streaming baseline provider: ${body.nonStreamingBaseline.selectedProvider ?? "n/a"}
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

function toPreview(text) {
  const normalized = String(text).replace(/\s+/g, " ").trim();

  if (normalized.length <= 200) {
    return normalized;
  }

  return `${normalized.slice(0, 197)}...`;
}
