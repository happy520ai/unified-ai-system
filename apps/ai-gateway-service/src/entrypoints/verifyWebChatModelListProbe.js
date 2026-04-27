import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { detectRuntimeCredentialProviders } from "../providers/providerCredentialDetector.js";

const PHASE = "phase-76s-web-chat-model-list-probe";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-76s-web-chat-model-list-probe.json");
const evidenceMdPath = resolve(evidenceDir, "phase-76s-web-chat-model-list-probe.md");
const ambiguousKey = "sk-phase76s-secret-must-not-persist";

let evidence;
const originalFetch = globalThis.fetch;

try {
  const probeLog = [];
  globalThis.fetch = createModelListFetchStub(probeLog);

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

  const safeDetection = await detectRuntimeCredentialProviders(application, {
    apiKey: ambiguousKey,
    source: "phase76s-safe-prefix-verify",
  });
  const deepProbeDetection = await detectRuntimeCredentialProviders(application, {
    apiKey: ambiguousKey,
    allowModelListProbe: true,
    probePolicy: "bounded-model-list",
    source: "phase76s-deep-probe-verify",
  });

  const dashscope = (deepProbeDetection.detected ?? []).find((item) => item.providerId === "dashscope") ?? {};
  const rejectedProviders = (deepProbeDetection.detected ?? [])
    .filter((item) => item.modelDiscovery?.status === "auth-failed")
    .map((item) => item.providerId)
    .sort();
  const recommended = deepProbeDetection.recommended ?? {};

  const passed = safeDetection.recommended == null &&
    safeDetection.safety?.networkProbePerformed === false &&
    safeDetection.safety?.modelListProbeEnabled === false &&
    deepProbeDetection.safety?.modelListProbeEnabled === true &&
    deepProbeDetection.safety?.probePolicy === "explicit-bounded-model-list" &&
    deepProbeDetection.safety?.networkProbePerformed === true &&
    recommended.providerId === "dashscope" &&
    String(recommended.modelId ?? "").startsWith("qwen") &&
    recommended.credentialValidated === true &&
    dashscope.modelDiscovery?.status === "ready" &&
    dashscope.modelDiscovery?.credentialValidated === true &&
    dashscope.requiresProviderChoice === false &&
    rejectedProviders.includes("openai") &&
    probeLog.some((item) => item.providerId === "dashscope" && item.authorizationShapeOk) &&
    probeLog.some((item) => item.providerId === "openai" && item.authorizationShapeOk) &&
    !JSON.stringify({ safeDetection, deepProbeDetection, probeLog }).includes("secret-must-not-persist");

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    safePrefixDetection: summarizeDetection(safeDetection),
    explicitModelListProbe: summarizeDetection(deepProbeDetection),
    probeTargets: probeLog.map(({ providerId, result, authorizationShapeOk }) => ({
      providerId,
      result,
      authorizationShapeOk,
    })),
    safety: {
      apiKeyValueRecorded: false,
      safeModeDoesNotProbeAmbiguousSk: safeDetection.safety?.networkProbePerformed === false,
      explicitProbeEnabledOnlyByRequest: deepProbeDetection.safety?.modelListProbeEnabled === true,
      plainSkDoesNotDefaultToOpenAi: safeDetection.recommended == null,
      dashscopeRecommendedAfterAuthenticatedModelsApi: recommended.providerId === "dashscope",
      defaultChatMainLaneChanged: false,
    },
    conclusion: passed ? "model-list-prefix-probe-connected" : "model-list-prefix-probe-not-connected",
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
    conclusion: "model-list-prefix-probe-not-connected",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
}

function createModelListFetchStub(probeLog) {
  return async function fetchStub(url, options = {}) {
    const textUrl = String(url);
    const providerId = detectProbeProviderId(textUrl);
    const authHeader = String(options?.headers?.authorization ?? "");
    const authorizationShapeOk = authHeader.startsWith("Bearer sk-phase76s-");

    if (providerId === "dashscope") {
      probeLog.push({ providerId, result: "ready", authorizationShapeOk });
      return createFetchResponse(200, {
        data: [
          { id: "qwen-plus", owned_by: "dashscope" },
          { id: "qwen-vl-plus", owned_by: "dashscope" },
          { id: "text-embedding-v3", owned_by: "dashscope" },
        ],
      });
    }

    probeLog.push({ providerId, result: "auth-failed", authorizationShapeOk });
    return createFetchResponse(401, { error: { message: "invalid api key for this provider" } });
  };
}

function detectProbeProviderId(url) {
  if (url.includes("dashscope.aliyuncs")) return "dashscope";
  if (url.includes("api.openai.com")) return "openai";
  if (url.includes("api.deepseek.com")) return "deepseek";
  if (url.includes("api.together.xyz")) return "together";
  if (url.includes("api.mistral.ai")) return "mistral";
  if (url.includes("api.moonshot.ai")) return "moonshot";
  if (url.includes("api.siliconflow.cn")) return "siliconflow";
  if (url.includes("hunyuan.cloud.tencent.com")) return "tencent-hunyuan";
  return "other";
}

function createFetchResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

function summarizeDetection(data) {
  return {
    mode: data.mode,
    recommended: data.recommended,
    warnings: data.warnings,
    providerIds: (data.detected ?? []).map((item) => item.providerId),
    providerStatuses: (data.detected ?? []).map((item) => ({
      providerId: item.providerId,
      status: item.status,
      discoveryStatus: item.modelDiscovery?.status,
      credentialValidated: item.modelDiscovery?.credentialValidated === true,
      requiresProviderChoice: item.requiresProviderChoice,
    })),
    capabilitySummary: data.capabilitySummary,
    safety: data.safety,
  };
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 76S Web Chat Model List Probe Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Safe-mode recommended provider/model: ${body.safePrefixDetection?.recommended?.value ?? "none"}
- Safe-mode network probe performed: ${body.safePrefixDetection?.safety?.networkProbePerformed}
- Explicit probe enabled: ${body.explicitModelListProbe?.safety?.modelListProbeEnabled}
- Explicit probe recommended provider/model: ${body.explicitModelListProbe?.recommended?.value ?? "none"}
- Probe targets: ${(body.probeTargets ?? []).map((item) => `${item.providerId}:${item.result}`).join(", ")}
- OpenAI default prevented: ${body.safety?.plainSkDoesNotDefaultToOpenAi}
- DashScope recommended after authenticated /models: ${body.safety?.dashscopeRecommendedAfterAuthenticatedModelsApi}
- API key value recorded: ${body.safety?.apiKeyValueRecorded}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Conclusion: ${body.conclusion}
`;
}
