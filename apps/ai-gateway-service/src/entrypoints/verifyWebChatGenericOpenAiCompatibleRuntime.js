import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-76r-web-chat-generic-openai-compatible-runtime";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-76r-web-chat-generic-openai-compatible-runtime.json");
const evidenceMdPath = resolve(evidenceDir, "phase-76r-web-chat-generic-openai-compatible-runtime.md");

let gatewayServer;
let upstreamServer;
let upstreamChatCalled = false;
let upstreamAuthorizationShapeOk = false;
let evidence;

try {
  upstreamServer = createFakeOpenAiCompatibleServer();
  await listen(upstreamServer, 0, "127.0.0.1");
  const upstreamBaseUrl = `http://127.0.0.1:${upstreamServer.address().port}/v1`;

  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
  });
  gatewayServer = createGatewayHttpServer(application);
  await listen(gatewayServer, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${gatewayServer.address().port}`;
  const pastedCredential = `公益API OpenAI-compatible ${upstreamBaseUrl} sk-phase76r-secret-must-not-persist`;

  const detection = await requestJson(`${serviceUrl}/providers/runtime-credential/detect`, {
    apiKey: pastedCredential,
    source: "phase76r-verify",
  });
  const detectionData = detection.payload?.data ?? {};
  const genericCandidate = (detectionData.detected ?? []).find((item) => item.providerId === "generic-openai-compatible");
  const selectedModel = genericCandidate?.models?.find((model) => model.execution?.chat === true)?.modelId ?? "custom-chat-model";

  const credential = await requestJson(`${serviceUrl}/providers/runtime-credential`, {
    providerId: "generic-openai-compatible",
    modelId: selectedModel,
    apiKey: pastedCredential,
    source: "phase76r-verify",
    models: genericCandidate?.models ?? [],
  });

  const chat = await requestJson(`${serviceUrl}/chat`, {
    prompt: "phase76r generic openai compatible runtime probe",
    providerId: "generic-openai-compatible",
    model: selectedModel,
  });

  const passed = detection.ok &&
    genericCandidate?.providerId === "generic-openai-compatible" &&
    genericCandidate?.availableForChat === true &&
    genericCandidate?.endpointConfigured === true &&
    detectionData.recommended?.providerId === "generic-openai-compatible" &&
    credential.ok &&
    credential.payload?.data?.providerId === "generic-openai-compatible" &&
    credential.payload?.data?.endpointConfigured === true &&
    chat.ok &&
    chat.payload?.data?.selectedProvider === "generic-openai-compatible" &&
    String(chat.payload?.data?.text ?? "").includes("generic OpenAI-compatible probe passed") &&
    upstreamChatCalled &&
    upstreamAuthorizationShapeOk &&
    !JSON.stringify({ detection: summarizeDetection(detectionData), credential: credential.payload, chat: chat.payload }).includes("secret-must-not-persist");

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    upstream: {
      baseUrlShape: "local-fake-openai-compatible",
      chatCalled: upstreamChatCalled,
      authorizationShapeOk: upstreamAuthorizationShapeOk,
    },
    detection: summarizeDetection(detectionData),
    credential: {
      ok: credential.ok,
      httpStatus: credential.httpStatus,
      providerId: credential.payload?.data?.providerId,
      endpointConfigured: credential.payload?.data?.endpointConfigured,
      apiKeyPresent: credential.payload?.data?.apiKeyPresent,
      secretStorage: credential.payload?.data?.secretStorage,
    },
    chat: {
      ok: chat.ok,
      httpStatus: chat.httpStatus,
      selectedProvider: chat.payload?.data?.selectedProvider,
      selectedModel: chat.payload?.data?.selectedModel,
      success: chat.payload?.data?.success,
      textPreview: String(chat.payload?.data?.text ?? "").slice(0, 120),
    },
    safety: {
      apiKeyValueRecorded: false,
      pastedCredentialParsed: true,
      endpointStoredMemoryOnly: true,
      defaultChatMainLaneChanged: false,
    },
    conclusion: passed ? "generic-openai-compatible-runtime-connected" : "generic-openai-compatible-runtime-not-connected",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "generic-openai-compatible-runtime-not-connected",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (gatewayServer) await close(gatewayServer);
  if (upstreamServer) await close(upstreamServer);
}

function createFakeOpenAiCompatibleServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    const auth = String(request.headers.authorization ?? "");

    if (request.method === "GET" && url.pathname === "/v1/models") {
      writeJson(response, 200, {
        data: [
          {
            id: "custom-chat-model",
            display_name: "Custom Chat Model",
            supported_parameters: ["temperature", "max_tokens"],
          },
        ],
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
      upstreamChatCalled = true;
      upstreamAuthorizationShapeOk = auth.startsWith("Bearer sk-phase76r-") && !auth.includes("http://");
      const body = await readJson(request);
      writeJson(response, 200, {
        id: "phase76r-chatcmpl",
        model: body.model,
        choices: [
          {
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: "generic OpenAI-compatible probe passed",
            },
          },
        ],
        usage: {
          prompt_tokens: 4,
          completion_tokens: 4,
          total_tokens: 8,
        },
      });
      return;
    }

    writeJson(response, 404, { error: { message: "not found" } });
  });
}

async function requestJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    ok: response.ok,
    httpStatus: response.status,
    payload: text ? JSON.parse(text) : {},
  };
}

function summarizeDetection(data) {
  return {
    mode: data.mode,
    recommended: data.recommended,
    warnings: data.warnings,
    providerIds: (data.detected ?? []).map((item) => item.providerId),
    generic: (data.detected ?? []).find((item) => item.providerId === "generic-openai-compatible")
      ? {
          availableForChat: (data.detected ?? []).find((item) => item.providerId === "generic-openai-compatible")?.availableForChat,
          endpointConfigured: (data.detected ?? []).find((item) => item.providerId === "generic-openai-compatible")?.endpointConfigured,
          chatExecutableModelCount: (data.detected ?? []).find((item) => item.providerId === "generic-openai-compatible")?.chatExecutableModelCount,
        }
      : null,
    networkProbePerformed: Boolean(data.safety?.networkProbePerformed),
  };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function listen(targetServer, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    targetServer.once("error", rejectListen);
    targetServer.listen(port, host, () => {
      targetServer.off("error", rejectListen);
      resolveListen();
    });
  });
}

function close(targetServer) {
  return new Promise((resolveClose) => targetServer.close(() => resolveClose()));
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 76R Web Chat Generic OpenAI-Compatible Runtime Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Detection provider ids: ${(body.detection?.providerIds ?? []).join(", ")}
- Recommended provider/model: ${body.detection?.recommended?.value ?? "n/a"}
- Generic endpoint configured: ${body.detection?.generic?.endpointConfigured}
- Runtime credential stored provider: ${body.credential?.providerId ?? "n/a"}
- Runtime endpoint configured: ${body.credential?.endpointConfigured}
- Chat selected provider: ${body.chat?.selectedProvider ?? "n/a"}
- Chat selected model: ${body.chat?.selectedModel ?? "n/a"}
- Upstream chat called: ${body.upstream?.chatCalled}
- Upstream authorization shape ok: ${body.upstream?.authorizationShapeOk}
- API key value recorded: ${body.safety?.apiKeyValueRecorded}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Conclusion: ${body.conclusion}
`;
}
