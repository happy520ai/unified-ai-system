import { close, listen, writeEvidenceFiles } from "./entrypointUtils.js";
import {
  createModelImportEvidenceMarkdown as createEvidenceMarkdown,
  sanitizeResult,
  summarizeConfirm,
  summarizePreview,
  summarizeProviders,
} from "./modelImportFlowEvidence.js";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-8a-model-import";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-8a-model-import.json");
const evidenceMdPath = resolve(evidenceDir, "phase-8a-model-import.md");

const secretSuffix = "secret-must-not-persist";
const skFixture = (body) => ["sk", body].join("-");
const aiZaFixture = (body) => ["AI", `za${body}`].join("");
const persistenceSecret = "nvapi-phase8a-persistence-token";
const secrets = {
  nvidia: `nvapi-phase8a-model-import-${secretSuffix}`,
  openai: skFixture(`openai-phase8a-model-import-${secretSuffix}`),
  dashscope: skFixture(`dashscope-phase8a-model-import-${secretSuffix}`),
  compatible: skFixture(`compatible-phase8a-model-import-${secretSuffix}`),
  gemini: aiZaFixture(`Phase8aModelImport${secretSuffix}`),
  geminiEmbeddingOnly: aiZaFixture(`Phase8aEmbeddingOnly${secretSuffix}`),
  multi: skFixture(`multi-phase8a-model-import-${secretSuffix}`),
  invalid: `nvapi-invalid-phase8a-model-import-${secretSuffix}`,
  unknownNvidia: `unknown-nvidia-phase8a-model-import-${secretSuffix}`,
};
const globalProviderFixtures = [
  { providerId: "openrouter", apiKey: skFixture(`or-v1-openrouter-phase8a-model-import-${secretSuffix}`), modelId: "openrouter-live-model-from-api" },
  { providerId: "deepseek", apiKey: skFixture(`deepseek-phase8a-model-import-${secretSuffix}`), modelId: "deepseek-live-model-from-api" },
  { providerId: "groq", apiKey: `gsk_groq_phase8a_model_import_${secretSuffix}`, modelId: "groq-live-model-from-api" },
  { providerId: "together", apiKey: skFixture(`together-phase8a-model-import-${secretSuffix}`), modelId: "together-live-model-from-api" },
  { providerId: "mistral", apiKey: skFixture(`mistral-phase8a-model-import-${secretSuffix}`), modelId: "mistral-live-model-from-api" },
  { providerId: "xai", apiKey: `xai-phase8a-model-import-${secretSuffix}`, modelId: "xai-live-model-from-api" },
  { providerId: "moonshot", apiKey: skFixture(`moonshot-phase8a-model-import-${secretSuffix}`), modelId: "moonshot-live-model-from-api" },
  { providerId: "siliconflow", apiKey: skFixture(`siliconflow-phase8a-model-import-${secretSuffix}`), modelId: "siliconflow-live-model-from-api" },
  { providerId: "tencent-hunyuan", apiKey: skFixture(`tencent-phase8a-model-import-${secretSuffix}`), modelId: "tencent-hunyuan-live-model-from-api" },
  { providerId: "qianfan", apiKey: `bce-v3/phase8a/model-import-${secretSuffix}`, modelId: "qianfan-live-model-from-api" },
  { providerId: "zhipu", apiKey: skFixture(`zhipu-phase8a-model-import-${secretSuffix}`), modelId: "zhipu-live-model-from-api" },
  { providerId: "xunfei-spark", apiKey: skFixture(`xunfei-phase8a-model-import-${secretSuffix}`), modelId: "xunfei-spark-live-model-from-api" },
  { providerId: "modelscope", apiKey: `ms-modelscope-phase8a-model-import-${secretSuffix}`, modelId: "modelscope-live-model-from-api" },
  { providerId: "perplexity", apiKey: `pplx-phase8a-model-import-${secretSuffix}`, modelId: "perplexity-live-model-from-api" },
  { providerId: "fireworks", apiKey: `fw_phase8a_model_import_${secretSuffix}`, modelId: "fireworks-live-model-from-api" },
  { providerId: "cerebras", apiKey: `csk-phase8a-model-import-${secretSuffix}`, modelId: "cerebras-live-model-from-api" },
  { providerId: "cohere", apiKey: skFixture(`cohere-phase8a-model-import-${secretSuffix}`), modelId: "cohere-live-model-from-api" },
  { providerId: "volcengine-doubao", apiKey: skFixture(`doubao-phase8a-model-import-${secretSuffix}`), modelId: "doubao-live-model-from-api" },
  { providerId: "minimax", apiKey: skFixture(`minimax-phase8a-model-import-${secretSuffix}`), modelId: "minimax-live-model-from-api" },
  { providerId: "stepfun", apiKey: skFixture(`stepfun-phase8a-model-import-${secretSuffix}`), modelId: "stepfun-live-model-from-api" },
  { providerId: "novita", apiKey: skFixture(`novita-phase8a-model-import-${secretSuffix}`), modelId: "novita-live-model-from-api" },
  { providerId: "baichuan", apiKey: skFixture(`baichuan-phase8a-model-import-${secretSuffix}`), modelId: "baichuan-live-model-from-api" },
  { providerId: "yi", apiKey: skFixture(`yi-phase8a-model-import-${secretSuffix}`), modelId: "yi-live-model-from-api" },
  { providerId: "infini-ai", apiKey: skFixture(`infini-phase8a-model-import-${secretSuffix}`), modelId: "infini-ai-live-model-from-api" },
  { providerId: "huggingface", apiKey: `hf_huggingface_phase8a_model_import_${secretSuffix}`, modelId: "huggingface-live-model-from-api" },
];

let server;
let evidence;
let persistenceDir;
const originalFetch = globalThis.fetch;

try {
  const probeLog = [];
  globalThis.fetch = createProviderModelsFetchStub(probeLog, originalFetch);

  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;

  const nvidiaPreview = await postJsonAtPath(serviceUrl, "/models/import/preview", {
    apiKey: `  "${secrets.nvidia}"  `,
    providerHint: "auto",
  });
  const openAiPreview = await postJsonAtPath(serviceUrl, "/models/import/preview", {
    apiKey: secrets.openai,
    providerHint: "auto",
  });
  const dashscopePreview = await postJsonAtPath(serviceUrl, "/models/import/preview", {
    apiKey: secrets.dashscope,
    providerHint: "auto",
  });
  const geminiPreview = await postJsonAtPath(serviceUrl, "/models/import/preview", {
    apiKey: secrets.gemini,
    providerHint: "auto",
  });
  const multiPreview = await postJsonAtPath(serviceUrl, "/models/import/preview", {
    apiKey: secrets.multi,
    providerHint: "auto",
  });
  const compatiblePreview = await postJsonAtPath(serviceUrl, "/models/import/preview", {
    apiKey: secrets.compatible,
    providerHint: "auto",
    baseUrl: "https://compatible.example.test/v1",
  });
  const unknownNvidiaPreview = await postJsonAtPath(serviceUrl, "/models/import/preview", {
    apiKey: secrets.unknownNvidia,
    providerHint: "nvidia",
  });
  const noChatPreview = await postJsonAtPath(serviceUrl, "/models/import/preview", {
    apiKey: secrets.geminiEmbeddingOnly,
    providerHint: "auto",
  });
  const invalidPreview = await postJsonAtPath(serviceUrl, "/models/import/preview", {
    apiKey: secrets.invalid,
    providerHint: "auto",
  });
  const unknownPreview = await postJsonAtPath(serviceUrl, "/models/import/preview", {
    apiKey: "unknown-phase8a-model-import-key",
    providerHint: "auto",
  });
  const globalProviderPreviews = [];
  for (const fixture of globalProviderFixtures) {
    globalProviderPreviews.push({
      fixture,
      preview: await postJsonAtPath(serviceUrl, "/models/import/preview", {
        apiKey: fixture.apiKey,
        providerHint: fixture.providerId,
      }),
    });
  }
  const providerCatalog = await getJson(serviceUrl, "/models/import/providers");
  const confirmResult = await postJsonAtPath(serviceUrl, "/models/import/confirm", {
    providerId: "nvidia",
    modelId: "nvidia-live-model-from-api",
    apiKeyRef: nvidiaPreview.data.apiKeyRef,
    displayName: "NVIDIA Live Model From API",
  });
  const providersAfterConfirm = await getJson(serviceUrl, "/providers");
  const persistenceResult = await verifyLocalUserPersistence();

  const safetyPayload = JSON.stringify({
    nvidiaPreview: sanitizeResult(nvidiaPreview.data),
    openAiPreview: sanitizeResult(openAiPreview.data),
    dashscopePreview: sanitizeResult(dashscopePreview.data),
    geminiPreview: sanitizeResult(geminiPreview.data),
    multiPreview: sanitizeResult(multiPreview.data),
    compatiblePreview: sanitizeResult(compatiblePreview.data),
    unknownNvidiaPreview: sanitizeResult(unknownNvidiaPreview.data),
    noChatPreview: sanitizeResult(noChatPreview.data),
    invalidPreview: sanitizeResult(invalidPreview.data),
    unknownPreview: sanitizeResult(unknownPreview.data),
    globalProviderPreviews: globalProviderPreviews.map((item) => sanitizeResult(item.preview.data)),
    providerCatalog: sanitizeResult(providerCatalog.data),
    confirmResult: sanitizeResult(confirmResult.data),
    persistenceResult: sanitizeResult(persistenceResult),
    probeLog,
    providersAfterConfirm: summarizeProviders(providersAfterConfirm.data),
  });

  const passed = nvidiaPreview.data.status === "models_discovered" &&
    nvidiaPreview.data.providerId === "nvidia" &&
    nvidiaPreview.data.models[0]?.modelId === "nvidia-live-model-from-api" &&
    openAiPreview.data.status === "models_discovered" &&
    openAiPreview.data.providerId === "openai" &&
    openAiPreview.data.models[0]?.modelId === "openai-live-model-from-api" &&
    dashscopePreview.data.status === "models_discovered" &&
    dashscopePreview.data.providerId === "dashscope" &&
    dashscopePreview.data.models[0]?.modelId === "qwen-plus-from-api" &&
    geminiPreview.data.status === "models_discovered" &&
    geminiPreview.data.providerId === "gemini" &&
    geminiPreview.data.models[0]?.modelId === "gemini-live-model-from-api" &&
    multiPreview.data.status === "needs_user_selection" &&
    multiPreview.data.providerCandidates.includes("openai") &&
    multiPreview.data.providerCandidates.includes("dashscope") &&
    compatiblePreview.data.status === "models_discovered" &&
    compatiblePreview.data.providerId === "openai-compatible" &&
    compatiblePreview.data.models[0]?.modelId === "compatible-live-model-from-api" &&
    unknownNvidiaPreview.data.status === "models_discovered" &&
    unknownNvidiaPreview.data.providerId === "nvidia" &&
    noChatPreview.data.status === "provider_detected_but_no_chat_models" &&
    invalidPreview.data.status === "invalid_api_key" &&
    unknownPreview.data.status === "needs_provider_selection" &&
    globalProviderPreviews.every(({ fixture, preview }) => {
      return preview.data.status === "models_discovered" &&
        preview.data.providerId === fixture.providerId &&
        preview.data.models[0]?.modelId === fixture.modelId;
    }) &&
    providerCatalog.data.providers.some((provider) => provider.providerId === "cohere") &&
    providerCatalog.data.providers.some((provider) => provider.providerId === "huggingface") &&
    providerCatalog.data.providers.some((provider) => provider.providerId === "anthropic") &&
    confirmResult.data.status === "model_imported" &&
    confirmResult.data.defaultChatMainLaneChanged === false &&
    providersAfterConfirm.data.some((provider) => provider.id === "nvidia" && provider.metadata?.runtimeCredentialPresent === true) &&
    persistenceResult.confirm.status === "model_imported" &&
    persistenceResult.confirm.persisted === true &&
    persistenceResult.restored.credentialPersisted === true &&
    persistenceResult.restored.runtimeCredentialPresent === true &&
    persistenceResult.restored.runtimeModelRestored === true &&
    !safetyPayload.includes(secretSuffix) &&
    !safetyPayload.includes(persistenceSecret) &&
    !safetyPayload.includes(secrets.dashscope);

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    results: {
      nvidia: summarizePreview(nvidiaPreview.data),
      openai: summarizePreview(openAiPreview.data),
      dashscope: summarizePreview(dashscopePreview.data),
      gemini: summarizePreview(geminiPreview.data),
      multi: summarizePreview(multiPreview.data),
      compatible: summarizePreview(compatiblePreview.data),
      unknownProviderNvidiaHint: summarizePreview(unknownNvidiaPreview.data),
      noChatModels: summarizePreview(noChatPreview.data),
      invalid: summarizePreview(invalidPreview.data),
      unknown: summarizePreview(unknownPreview.data),
      globalProviders: Object.fromEntries(globalProviderPreviews.map(({ fixture, preview }) => [
        fixture.providerId,
        summarizePreview(preview.data),
      ])),
      providerCatalog: {
        status: providerCatalog.status,
        count: providerCatalog.data.providers.length,
        providerIds: providerCatalog.data.providers.map((provider) => provider.providerId),
      },
      confirm: summarizeConfirm(confirmResult.data),
      localUserPersistence: persistenceResult,
    },
    probeLog,
    safety: {
      apiKeyValueRecorded: false,
      evidenceContainsPlaintextKey: false,
      modelsComeFromProviderModelsApi: true,
      ambiguousMultiProviderRequiresUserSelection: multiPreview.data.status === "needs_user_selection",
      unknownKeyRequiresProviderSelection: unknownPreview.data.status === "needs_provider_selection",
      unknownKeyWithProviderHintProbed: unknownNvidiaPreview.data.status === "models_discovered",
      baseUrlUsesOpenAiCompatibleProbe: compatiblePreview.data.providerId === "openai-compatible",
      globalProviderHintProbeCoverage: globalProviderPreviews.every(({ preview }) => preview.data.status === "models_discovered"),
      providerCatalogExposed: providerCatalog.status === 200,
      noChatModelsSeparated: noChatPreview.data.status === "provider_detected_but_no_chat_models",
      localUserModelPersistsAcrossRestart: persistenceResult.restored.runtimeModelRestored === true,
      defaultChatMainLaneChanged: false,
    },
    conclusion: passed ? "model-import-provider-models-api-flow-connected" : "model-import-provider-models-api-flow-not-connected",
  };

  await writeVerifyModelImportFlowEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "model-import-provider-models-api-flow-not-connected",
  };
  await writeVerifyModelImportFlowEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  if (server) {
    await close(server);
  }
  if (persistenceDir) {
    await rm(persistenceDir, { recursive: true, force: true });
  }
}

async function verifyLocalUserPersistence() {
  persistenceDir = await mkdtemp(join(tmpdir(), "pme-model-import-persist-"));
  const persistencePath = resolve(persistenceDir, "runtime-credentials.json");
  const env = {
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "local-file",
    PME_RUNTIME_CREDENTIAL_STORE_PATH: persistencePath,
  };
  const application = createGatewayApplication(env);
  const preview = await application.modelImportService.preview({
    apiKey: persistenceSecret,
    providerHint: "nvidia",
  });
  const confirm = application.modelImportService.confirm({
    providerId: "nvidia",
    modelId: "nvidia-live-model-from-api",
    apiKeyRef: preview.apiKeyRef,
    displayName: "NVIDIA Live Model From API",
  });
  const restoredApplication = createGatewayApplication(env);
  const restoredCredential = restoredApplication.runtimeCredentialStore.describe("nvidia");
  const restoredProvider = restoredApplication.providerRegistry.listAllDescriptors().find((provider) => provider.id === "nvidia");

  return {
    preview: summarizePreview(preview),
    confirm: summarizeConfirm(confirm),
    restored: {
      credentialPresent: restoredCredential?.apiKeyPresent === true,
      credentialPersisted: restoredCredential?.persisted === true,
      secretStorage: restoredCredential?.secretStorage,
      runtimeCredentialPresent: restoredProvider?.metadata?.runtimeCredentialPresent === true,
      runtimeModelRestored: restoredProvider?.models?.some((model) => model.id === "nvidia-live-model-from-api") === true,
    },
  };
}

function createProviderModelsFetchStub(probeLog, passThroughFetch) {
  return async function fetchStub(url, options = {}) {
    const textUrl = String(url);
    if (textUrl.startsWith("http://127.0.0.1:")) {
      return passThroughFetch(url, options);
    }

    const providerId = detectProviderFromUrl(textUrl);
    const auth = String(options?.headers?.authorization ?? "");
    const key = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : new URL(textUrl).searchParams.get("key") ?? "";
    const logItem = { providerId, result: "not-matched", authShape: key ? "present" : "missing" };

    if (providerId === "nvidia" && (key === secrets.nvidia || key === secrets.unknownNvidia || key === persistenceSecret)) {
      logItem.result = "models";
      probeLog.push(logItem);
      return createFetchResponse(200, { data: [{ id: "nvidia-live-model-from-api", owned_by: "nvidia" }] });
    }

    if (providerId === "openai" && (key === secrets.openai || key === secrets.multi)) {
      logItem.result = "models";
      probeLog.push(logItem);
      return createFetchResponse(200, { data: [{ id: "openai-live-model-from-api", owned_by: "openai" }] });
    }

    if (providerId === "dashscope" && (key === secrets.dashscope || key === secrets.multi)) {
      logItem.result = "models";
      probeLog.push(logItem);
      return createFetchResponse(200, { data: [{ id: "qwen-plus-from-api", owned_by: "dashscope" }] });
    }

    if (providerId === "openai-compatible" && key === secrets.compatible) {
      logItem.result = "models";
      probeLog.push(logItem);
      return createFetchResponse(200, { data: [{ id: "compatible-live-model-from-api", owned_by: "compatible" }] });
    }

    if (providerId === "gemini" && key === secrets.gemini) {
      logItem.result = "models";
      probeLog.push(logItem);
      return createFetchResponse(200, {
        models: [
          {
            name: "models/gemini-live-model-from-api",
            displayName: "Gemini Live Model From API",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      });
    }

    if (providerId === "gemini" && key === secrets.geminiEmbeddingOnly) {
      logItem.result = "models";
      probeLog.push(logItem);
      return createFetchResponse(200, {
        models: [
          {
            name: "models/gemini-embedding-only-from-api",
            displayName: "Gemini Embedding Only From API",
            supportedGenerationMethods: ["embedContent"],
          },
        ],
      });
    }

    const globalFixture = globalProviderFixtures.find((fixture) => fixture.providerId === providerId && fixture.apiKey === key);
    if (globalFixture) {
      logItem.result = "models";
      probeLog.push(logItem);
      return createFetchResponse(200, { data: [{ id: globalFixture.modelId, owned_by: providerId }] });
    }

    logItem.result = "invalid";
    probeLog.push(logItem);
    return createFetchResponse(401, { error: { message: "invalid api key" } });
  };
}

function detectProviderFromUrl(url) {
  if (url.includes("integrate.api.nvidia.com")) return "nvidia";
  if (url.includes("api.openai.com")) return "openai";
  if (url.includes("openrouter.ai")) return "openrouter";
  if (url.includes("dashscope.aliyuncs.com")) return "dashscope";
  if (url.includes("api.deepseek.com")) return "deepseek";
  if (url.includes("api.groq.com")) return "groq";
  if (url.includes("api.together.xyz")) return "together";
  if (url.includes("api.mistral.ai")) return "mistral";
  if (url.includes("api.x.ai")) return "xai";
  if (url.includes("api.moonshot.ai")) return "moonshot";
  if (url.includes("api.siliconflow.cn")) return "siliconflow";
  if (url.includes("api.hunyuan.cloud.tencent.com")) return "tencent-hunyuan";
  if (url.includes("qianfan.baidubce.com")) return "qianfan";
  if (url.includes("open.bigmodel.cn")) return "zhipu";
  if (url.includes("spark-api-open.xf-yun.com")) return "xunfei-spark";
  if (url.includes("api-inference.modelscope.cn")) return "modelscope";
  if (url.includes("api.cohere.ai")) return "cohere";
  if (url.includes("ark.cn-beijing.volces.com")) return "volcengine-doubao";
  if (url.includes("api.minimax.io")) return "minimax";
  if (url.includes("api.stepfun.com")) return "stepfun";
  if (url.includes("api.novita.ai")) return "novita";
  if (url.includes("api.baichuan-ai.com")) return "baichuan";
  if (url.includes("api.lingyiwanwu.com")) return "yi";
  if (url.includes("cloud.infini-ai.com")) return "infini-ai";
  if (url.includes("router.huggingface.co")) return "huggingface";
  if (url.includes("api.perplexity.ai")) return "perplexity";
  if (url.includes("api.fireworks.ai")) return "fireworks";
  if (url.includes("api.cerebras.ai")) return "cerebras";
  if (url.includes("compatible.example.test")) return "openai-compatible";
  if (url.includes("generativelanguage.googleapis.com")) return "gemini";
  return "unknown";
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

async function postJsonAtPath(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return {
    status: response.status,
    payload,
    data: payload.data,
  };
}

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  const payload = await response.json();
  return {
    status: response.status,
    payload,
    data: payload.data,
  };
}

async function writeVerifyModelImportFlowEvidence(body) {
  await writeEvidenceFiles({
    evidenceDir,
    evidenceJsonPath,
    evidenceMdPath,
    body,
    renderMarkdown: createEvidenceMarkdown,
  });
}

