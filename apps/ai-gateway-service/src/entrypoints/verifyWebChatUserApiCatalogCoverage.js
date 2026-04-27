import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { detectRuntimeCredentialProviders, extractRuntimeCredentialSecret } from "../providers/providerCredentialDetector.js";

const PHASE = "phase-76q-web-chat-user-api-catalog-coverage";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-76q-web-chat-user-api-catalog-coverage.json");
const evidenceMdPath = resolve(evidenceDir, "phase-76q-web-chat-user-api-catalog-coverage.md");

let evidence;
const originalFetch = globalThis.fetch;

try {
  globalThis.fetch = createModelListFetchStub();

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

  const checks = {
    excelProviderClues: await detect(application, "腾讯混元 API：sk-phase76q-tencent-secret-must-not-persist openai兼容API"),
    qianfan: await detect(application, "百度千帆 bce-v3/ALTAK-Phase76QTest/phase76qSecretMustNotPersist"),
    zhipu: await detect(application, "智谱 AI 6f10c7e7158e11111111111111111111.phase76qSecretMustNotPersist"),
    xunfei: await detect(application, "科大讯飞 Spark Lite APIPassword dFaiLuOSWWFgOmLBxwcD:SEuuzOnMkKQgOZtsEGRJ"),
    modelscope: await detect(application, "魔搭社区 ms-phase76q-secret-must-not-persist"),
    cloudflare: await detect(application, "Cloudflare Workers AI cfat_phase76qSecretMustNotPersist"),
    huggingface: await detect(application, "BLOOM API hf_phase76qSecretMustNotPersist"),
    coze: await detect(application, "扣子 pat_phase76qSecretMustNotPersist"),
    genericSk: await detect(application, "sk-phase76q-generic-secret-must-not-persist"),
    dashscopeShape: await detect(application, "sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
  };

  const extracted = {
    tencent: maskExtracted(extractRuntimeCredentialSecret("tencent-hunyuan", "API：sk-phase76q-tencent-secret-must-not-persist")),
    qianfan: maskExtracted(extractRuntimeCredentialSecret("qianfan", "百度千帆 bce-v3/ALTAK-Phase76QTest/phase76qSecretMustNotPersist")),
    zhipu: maskExtracted(extractRuntimeCredentialSecret("zhipu", "智谱 6f10c7e7158e11111111111111111111.phase76qSecretMustNotPersist")),
    xunfei: maskExtracted(extractRuntimeCredentialSecret("xunfei-spark", "科大讯飞 dFaiLuOSWWFgOmLBxwcD:SEuuzOnMkKQgOZtsEGRJ")),
    modelscope: maskExtracted(extractRuntimeCredentialSecret("modelscope", "魔搭 ms-phase76q-secret-must-not-persist")),
  };

  const passed = hasOnlyProvider(checks.excelProviderClues, "tencent-hunyuan") &&
    hasProvider(checks.qianfan, "qianfan") &&
    hasProvider(checks.zhipu, "zhipu") &&
    hasProvider(checks.xunfei, "xunfei-spark") &&
    hasProvider(checks.modelscope, "modelscope") &&
    hasProvider(checks.cloudflare, "cloudflare-workers-ai") &&
    hasProvider(checks.huggingface, "huggingface") &&
    hasProvider(checks.coze, "coze") &&
    hasProvider(checks.genericSk, "tencent-hunyuan") &&
    hasProvider(checks.genericSk, "dashscope") &&
    hasProvider(checks.genericSk, "siliconflow") &&
    hasProvider(checks.genericSk, "generic-openai-compatible") &&
    checks.genericSk.recommended == null &&
    hasOnlyProvider(checks.dashscopeShape, "dashscope") &&
    checks.dashscopeShape.recommended?.providerId === "dashscope" &&
    checks.dashscopeShape.safety?.networkProbePerformed === true &&
    !hasProvider(checks.genericSk, "local-fake-provider") &&
    isChatCandidate(checks.qianfan, "qianfan") &&
    isChatCandidate(checks.zhipu, "zhipu") &&
    isChatCandidate(checks.xunfei, "xunfei-spark") &&
    isChatCandidate(checks.modelscope, "modelscope") &&
    isChatCandidate(checks.huggingface, "huggingface") &&
    isRecognizedOnly(checks.cloudflare, "cloudflare-workers-ai") &&
    isRecognizedOnly(checks.coze, "coze") &&
    Object.values(extracted).every((item) => item.includes("...")) &&
    !JSON.stringify({ checks, extracted }).includes("secret-must-not-persist");

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    sourceWorkbookInspected: {
      fileName: "免费api汇总.xlsx",
      apiKeyValuesRecorded: false,
      observedProviderFamilies: [
        "iFlytek Spark",
        "Baidu Qianfan",
        "Tencent Hunyuan",
        "Coze",
        "Zhipu AI",
        "SiliconFlow",
        "DashScope",
        "ModelScope",
        "Google Gemini",
        "Cloudflare Workers AI",
        "Groq",
        "Hugging Face",
        "OpenAI",
        "generic OpenAI-compatible relay",
      ],
    },
    detection: Object.fromEntries(Object.entries(checks).map(([name, data]) => [name, summarizeDetection(data)])),
    extractedCredentialExamplesMasked: extracted,
    safety: {
      apiKeyValueRecorded: false,
      fakeExcludedFromGenericFallback: !hasProvider(checks.genericSk, "local-fake-provider"),
      genericSkSprayPrevented: checks.genericSk.safety?.ambiguousKeySprayPrevented === true,
      plainSkDoesNotDefaultToOpenAi: checks.genericSk.recommended == null,
      dashscopeShapeRecommended: checks.dashscopeShape.recommended?.providerId === "dashscope",
      nonChatPlatformsRecognizedOnly: isRecognizedOnly(checks.cloudflare, "cloudflare-workers-ai") &&
        isRecognizedOnly(checks.coze, "coze"),
      huggingFaceRouterChatExecutable: isChatCandidate(checks.huggingface, "huggingface"),
    },
    conclusion: passed ? "user-api-catalog-coverage-connected" : "user-api-catalog-coverage-not-connected",
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
    conclusion: "user-api-catalog-coverage-not-connected",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
}

async function detect(application, apiKey) {
  return detectRuntimeCredentialProviders(application, {
    apiKey,
    source: "phase76q-verify",
  });
}

function createModelListFetchStub() {
  return async function fetchStub(url) {
    const textUrl = String(url);
    const provider = textUrl.includes("qianfan")
      ? "qianfan"
      : textUrl.includes("bigmodel")
        ? "zhipu"
        : textUrl.includes("xf-yun")
          ? "xunfei-spark"
          : textUrl.includes("modelscope")
            ? "modelscope"
            : textUrl.includes("hunyuan")
              ? "tencent-hunyuan"
              : "generic";
    const modelsByProvider = {
      qianfan: [{ id: "ernie-speed-128k" }, { id: "ernie-4.5-turbo-128k" }],
      zhipu: [{ id: "glm-4-flash" }, { id: "glm-4.5" }],
      "xunfei-spark": [{ id: "lite" }, { id: "generalv3.5" }],
      modelscope: [{ id: "Qwen/Qwen2.5-7B-Instruct" }],
      "tencent-hunyuan": [{ id: "hunyuan-lite" }, { id: "hunyuan-turbo" }],
      generic: [{ id: "custom-chat-model" }],
    };
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ data: modelsByProvider[provider] ?? modelsByProvider.generic });
      },
    };
  };
}

function hasProvider(data, providerId) {
  return (data.detected ?? []).some((item) => item.providerId === providerId);
}

function hasOnlyProvider(data, providerId) {
  const ids = (data.detected ?? []).map((item) => item.providerId);
  return ids.length === 1 && ids[0] === providerId;
}

function isChatCandidate(data, providerId) {
  const provider = (data.detected ?? []).find((item) => item.providerId === providerId);
  return provider?.availableForChat === true && (provider.chatExecutableModelCount ?? 0) > 0;
}

function isRecognizedOnly(data, providerId) {
  const provider = (data.detected ?? []).find((item) => item.providerId === providerId);
  return Boolean(provider) && provider.availableForChat === false;
}

function summarizeDetection(data) {
  return {
    mode: data.mode,
    recommended: data.recommended,
    warnings: data.warnings,
    providerIds: (data.detected ?? []).map((item) => item.providerId),
    statuses: (data.detected ?? []).map((item) => ({ providerId: item.providerId, status: item.status, chatExecutableModelCount: item.chatExecutableModelCount })),
    capabilitySummary: data.capabilitySummary,
    networkProbePerformed: Boolean(data.safety?.networkProbePerformed),
    ambiguousKeySprayPrevented: Boolean(data.safety?.ambiguousKeySprayPrevented),
  };
}

function maskExtracted(value) {
  const text = String(value ?? "");
  if (text.length <= 12) return "<masked>";
  return `${text.slice(0, 6)}...${text.slice(-4)}(${text.length})`;
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 76Q Web Chat User API Catalog Coverage Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Source workbook inspected: ${body.sourceWorkbookInspected?.fileName ?? "n/a"}
- API key values recorded: ${body.sourceWorkbookInspected?.apiKeyValuesRecorded ?? false}
- Observed provider families: ${(body.sourceWorkbookInspected?.observedProviderFamilies ?? []).join(", ")}
- Tencent hint provider ids: ${(body.detection?.excelProviderClues?.providerIds ?? []).join(", ")}
- Qianfan provider ids: ${(body.detection?.qianfan?.providerIds ?? []).join(", ")}
- Zhipu provider ids: ${(body.detection?.zhipu?.providerIds ?? []).join(", ")}
- iFlytek provider ids: ${(body.detection?.xunfei?.providerIds ?? []).join(", ")}
- ModelScope provider ids: ${(body.detection?.modelscope?.providerIds ?? []).join(", ")}
- Cloudflare provider ids: ${(body.detection?.cloudflare?.providerIds ?? []).join(", ")}
- Hugging Face provider ids: ${(body.detection?.huggingface?.providerIds ?? []).join(", ")}
- Coze provider ids: ${(body.detection?.coze?.providerIds ?? []).join(", ")}
- Generic sk provider ids: ${(body.detection?.genericSk?.providerIds ?? []).join(", ")}
- Plain sk recommended provider/model: ${body.detection?.genericSk?.recommended?.value ?? "none"}
- DashScope-shaped sk provider ids: ${(body.detection?.dashscopeShape?.providerIds ?? []).join(", ")}
- DashScope-shaped recommended provider/model: ${body.detection?.dashscopeShape?.recommended?.value ?? "none"}
- Fake excluded from generic fallback: ${body.safety?.fakeExcludedFromGenericFallback}
- Generic sk spray prevented: ${body.safety?.genericSkSprayPrevented}
- Plain sk does not default to OpenAI: ${body.safety?.plainSkDoesNotDefaultToOpenAi}
- DashScope-shaped key recommended: ${body.safety?.dashscopeShapeRecommended}
- Non-chat platforms recognized only: ${body.safety?.nonChatPlatformsRecognizedOnly}
- Hugging Face Router chat executable: ${body.safety?.huggingFaceRouterChatExecutable}
- Conclusion: ${body.conclusion}
`;
}
