import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-7a-1-service-entry";
const DEFAULT_NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-7a-1-service-entry.json");
const evidenceMdPath = resolve(evidenceDir, "phase-7a-1-service-entry.md");

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
  AI_GATEWAY_REQUEST_TIMEOUT_MS: process.env.AI_GATEWAY_REQUEST_TIMEOUT_MS ?? "60000",
  NVIDIA_MODEL: process.env.NVIDIA_MODEL ?? dotEnv.NVIDIA_MODEL ?? DEFAULT_NVIDIA_MODEL,
  NVIDIA_BASE_URL: process.env.NVIDIA_BASE_URL,
});

let server;
let evidence;

if (!verificationEnv.NVIDIA_API_KEY) {
  evidence = createEvidence({
    status: "blocked",
    generatedAt: new Date().toISOString(),
    env: verificationEnv,
    serviceUrl: null,
    healthHttpStatus: null,
    healthEnvelope: null,
    chatHttpStatus: null,
    chatEnvelope: null,
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
    const health = await fetchJson(`${serviceUrl}/health`);
    const chat = await fetchJson(`${serviceUrl}/chat`, {
      method: "POST",
      body: {
        context: {
          requestId: "ai-gateway-service-phase-7a-1-chat",
          traceId: "phase-7a-1-service-entry",
        },
        messages: [
          {
            role: "user",
            content: "Phase 7A-1 service entry verification. Reply with one short confirmation sentence.",
          },
        ],
        options: {
          temperature: 0,
          maxOutputTokens: 64,
        },
        metadata: {
          caller: "ai-gateway-service-verifier",
          phase: PHASE,
        },
      },
    });
    const serviceEntryConnected = isServiceEntryConnected({ health, chat });

    evidence = createEvidence({
      status: serviceEntryConnected ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      env: verificationEnv,
      serviceUrl,
      healthHttpStatus: health.httpStatus,
      healthEnvelope: health.body,
      chatHttpStatus: chat.httpStatus,
      chatEnvelope: chat.body,
      conclusion: serviceEntryConnected
        ? "service-entry-health-and-chat-connected-to-nvidia"
        : "service-entry-health-or-chat-not-connected",
    });
    await writeEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = serviceEntryConnected ? 0 : 1;
  } catch (error) {
    evidence = createEvidence({
      status: "failed",
      generatedAt: new Date().toISOString(),
      env: verificationEnv,
      serviceUrl: null,
      healthHttpStatus: null,
      healthEnvelope: null,
      chatHttpStatus: null,
      chatEnvelope: null,
      error: error instanceof Error ? error.message : String(error),
      conclusion: "service-entry-health-or-chat-not-connected",
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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();

  return {
    httpStatus: response.status,
    body: text ? JSON.parse(text) : {},
  };
}

function isServiceEntryConnected({ health, chat }) {
  const healthData = health.body?.data;
  const chatData = chat.body?.data;

  return (
    health.httpStatus === 200 &&
    health.body?.status === "ok" &&
    healthData?.status === "ready" &&
    healthData?.providerMode === "real" &&
    healthData?.realProviderEnabled === true &&
    healthData?.providers?.map((provider) => provider.id).join(",") === "nvidia" &&
    healthData?.routes?.includes("POST /chat") &&
    chat.httpStatus === 200 &&
    chat.body?.success === true &&
    chatData?.selectedProvider === "nvidia" &&
    chatData?.executionMode === "real" &&
    chatData?.executionStatus === "success" &&
    typeof chatData?.outputText === "string" &&
    chatData.outputText.length > 0
  );
}

function createEvidence({
  status,
  generatedAt,
  env,
  serviceUrl,
  healthHttpStatus,
  healthEnvelope,
  chatHttpStatus,
  chatEnvelope,
  conclusion,
  error,
}) {
  const healthData = healthEnvelope?.data;
  const chatData = chatEnvelope?.data;

  return {
    phase: PHASE,
    status,
    generatedAt,
    nvidiaApiKeyPresent: Boolean(env.NVIDIA_API_KEY),
    nvidiaModel: env.NVIDIA_MODEL ?? DEFAULT_NVIDIA_MODEL,
    service: {
      url: serviceUrl,
      healthHttpStatus,
      healthStatus: healthData?.status ?? null,
      phase: healthData?.phase ?? null,
      providerMode: healthData?.providerMode ?? null,
      realProviderEnabled: healthData?.realProviderEnabled ?? null,
      providers: healthData?.providers?.map((provider) => provider.id) ?? [],
      routes: healthData?.routes ?? [],
    },
    chat: {
      httpStatus: chatHttpStatus,
      success: chatEnvelope?.success ?? null,
      code: chatEnvelope?.code ?? null,
      selectedProvider: chatData?.selectedProvider ?? null,
      selectedModel: chatData?.selectedModel ?? null,
      executionMode: chatData?.executionMode ?? null,
      executionStatus: chatData?.executionStatus ?? null,
      outputTextPresent: typeof chatData?.outputText === "string" && chatData.outputText.length > 0,
      outputTextPreview: toPreview(chatData?.outputText ?? ""),
      warnings: chatData?.warnings ?? [],
      error: chatEnvelope?.error
        ? {
            code: chatEnvelope.error.code,
            type: chatEnvelope.error.type,
            message: chatEnvelope.error.message,
            retryable: chatEnvelope.error.retryable,
            provider: chatEnvelope.error.provider,
            model: chatEnvelope.error.model,
          }
        : null,
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
  return `# Phase 7A-1 Service Entry Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- NVIDIA API key present: ${body.nvidiaApiKeyPresent}
- NVIDIA model: ${body.nvidiaModel}
- Service URL: ${body.service.url ?? "n/a"}
- Health HTTP status: ${body.service.healthHttpStatus ?? "n/a"}
- Health status: ${body.service.healthStatus ?? "n/a"}
- Service phase: ${body.service.phase ?? "n/a"}
- Provider mode: ${body.service.providerMode ?? "n/a"}
- Real provider enabled: ${body.service.realProviderEnabled ?? "n/a"}
- Providers: ${body.service.providers.join(", ") || "n/a"}
- Routes: ${body.service.routes.join(", ") || "n/a"}
- Chat HTTP status: ${body.chat.httpStatus ?? "n/a"}
- Chat success: ${body.chat.success ?? "n/a"}
- Selected provider: ${body.chat.selectedProvider ?? "n/a"}
- Selected model: ${body.chat.selectedModel ?? "n/a"}
- Execution mode: ${body.chat.executionMode ?? "n/a"}
- Execution status: ${body.chat.executionStatus ?? "n/a"}
- Output text present: ${body.chat.outputTextPresent}
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
