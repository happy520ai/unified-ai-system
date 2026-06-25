import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../../ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../../ai-gateway-service/src/http/httpServer.js";
import { fetchJson, listen, close, writeEvidenceWithRenderer } from "../../../ai-gateway-service/src/entrypoints/entrypointUtils.js"


const PHASE = "phase-7a-2-console-service-chain";
const DEFAULT_NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-7a-2-console-service-chain.json");
const evidenceMdPath = resolve(evidenceDir, "phase-7a-2-console-service-chain.md");

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

let evidence;
let server;

if (!verificationEnv.NVIDIA_API_KEY) {
  evidence = createEvidence({
    status: "blocked",
    generatedAt: new Date().toISOString(),
    env: verificationEnv,
    serviceUrl: null,
    healthEnvelope: null,
    consoleResult: null,
    consoleOutput: null,
    conclusion: "blocked: NVIDIA_API_KEY is not present",
  });
  await saveEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} else {
  try {
    const application = createGatewayApplication(verificationEnv);
    server = createGatewayHttpServer(application);
    await listen(server, 0, "127.0.0.1");

    const address = server.address();
    const serviceUrl = `http://127.0.0.1:${address.port}`;
    const healthEnvelope = await fetchJson(`${serviceUrl}/health/check`);
    const consoleResult = await runNode({
      args: [resolve(repoRoot, "apps/agent-console/src/index.js")],
      cwd: repoRoot,
      env: compactEnv({
        ...verificationEnv,
        AI_GATEWAY_SERVICE_URL: serviceUrl,
        AI_GATEWAY_CONSOLE_PROMPT:
          "Phase 7A-2 console to service verification. Reply with one short confirmation sentence.",
      }),
      timeoutMs: Number(verificationEnv.AI_GATEWAY_CONSOLE_TIMEOUT_MS),
    });
    const consoleOutput = parseJson(consoleResult.stdout);
    const chainConnected = isChainConnected({ healthEnvelope, consoleResult, consoleOutput });

    evidence = createEvidence({
      status: chainConnected ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      env: verificationEnv,
      serviceUrl,
      healthEnvelope,
      consoleResult,
      consoleOutput,
      conclusion: chainConnected
        ? "agent-console-to-ai-gateway-service-connected"
        : "agent-console-to-ai-gateway-service-not-connected",
    });

    await saveEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = chainConnected ? 0 : 1;
  } catch (error) {
    evidence = createEvidence({
      status: "failed",
      generatedAt: new Date().toISOString(),
      env: verificationEnv,
      serviceUrl: null,
      healthEnvelope: null,
      consoleResult: null,
      consoleOutput: null,
      error: error instanceof Error ? error.message : String(error),
      conclusion: "agent-console-to-ai-gateway-service-not-connected",
    });
    await saveEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = 1;
  } finally {
    if (server) {
      await close(server);
    }
  }
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

function isChainConnected({ healthEnvelope, consoleResult, consoleOutput }) {
  const gateway = consoleOutput?.gateway;

  return (
    healthEnvelope?.status === "ok" &&
    healthEnvelope?.data?.providerMode === "real" &&
    healthEnvelope?.data?.realProviderEnabled === true &&
    healthEnvelope?.data?.routes?.includes("POST /chat") &&
    consoleResult.exitCode === 0 &&
    consoleOutput?.status === "completed" &&
    consoleOutput?.phase === PHASE &&
    gateway?.selectedProvider === "nvidia" &&
    gateway?.executionMode === "real" &&
    gateway?.executionStatus === "success" &&
    typeof gateway?.outputText === "string" &&
    gateway.outputText.length > 0
  );
}

function createEvidence({
  status,
  generatedAt,
  env,
  serviceUrl,
  healthEnvelope,
  consoleResult,
  consoleOutput,
  conclusion,
  error,
}) {
  const gateway = consoleOutput?.gateway;

  return {
    phase: PHASE,
    status,
    generatedAt,
    nvidiaApiKeyPresent: Boolean(env.NVIDIA_API_KEY),
    nvidiaModel: env.NVIDIA_MODEL ?? DEFAULT_NVIDIA_MODEL,
    service: {
      url: serviceUrl,
      healthStatus: healthEnvelope?.data?.status ?? null,
      phase: healthEnvelope?.data?.phase ?? null,
      providerMode: healthEnvelope?.data?.providerMode ?? null,
      realProviderEnabled: healthEnvelope?.data?.realProviderEnabled ?? null,
      providers: healthEnvelope?.data?.providers?.map((provider) => provider.id) ?? [],
      routes: healthEnvelope?.data?.routes ?? [],
    },
    console: {
      exitCode: consoleResult?.exitCode ?? null,
      signal: consoleResult?.signal ?? null,
      status: consoleOutput?.status ?? null,
      gatewayServiceUrl: consoleOutput?.gatewayServiceUrl ?? serviceUrl,
      stderrPreview: toPreview(consoleResult?.stderr ?? ""),
    },
    route: {
      requestId: gateway?.id ?? null,
      selectedProvider: gateway?.selectedProvider ?? null,
      selectedModel: gateway?.selectedModel ?? null,
      executionMode: gateway?.executionMode ?? null,
      executionStatus: gateway?.executionStatus ?? null,
      outputTextPresent: typeof gateway?.outputText === "string" && gateway.outputText.length > 0,
      outputTextPreview: toPreview(gateway?.outputText ?? ""),
      warnings: gateway?.warnings ?? [],
    },
    error: error ?? null,
    conclusion,
  };
}

async function saveEvidence(body) {
  await writeEvidenceWithRenderer(evidenceDir, evidenceJsonPath, evidenceMdPath, body, renderEvidenceMarkdown);
}

function renderEvidenceMarkdown(body) {
  return `# Phase 7A-2 Console Service Chain Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- NVIDIA API key present: ${body.nvidiaApiKeyPresent}
- NVIDIA model: ${body.nvidiaModel}
- Service URL: ${body.service.url ?? "n/a"}
- Health status: ${body.service.healthStatus ?? "n/a"}
- Service phase: ${body.service.phase ?? "n/a"}
- Provider mode: ${body.service.providerMode ?? "n/a"}
- Real provider enabled: ${body.service.realProviderEnabled ?? "n/a"}
- Providers: ${body.service.providers.join(", ") || "n/a"}
- Console status: ${body.console.status ?? "n/a"}
- Console exit code: ${body.console.exitCode ?? "n/a"}
- Selected provider: ${body.route.selectedProvider ?? "n/a"}
- Selected model: ${body.route.selectedModel ?? "n/a"}
- Execution mode: ${body.route.executionMode ?? "n/a"}
- Execution status: ${body.route.executionStatus ?? "n/a"}
- Output text present: ${body.route.outputTextPresent}
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
