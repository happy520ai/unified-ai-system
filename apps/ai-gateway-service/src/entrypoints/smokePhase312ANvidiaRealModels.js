import { mkdir, writeFile } from "node:fs/promises";
import { writeEvidenceWithRenderer } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sleep, listen } from "./entrypointUtils.js";

import { createModelLibraryStore } from "../model-library/modelLibraryStore.js";
import { ENDPOINT_TYPES } from "../model-library/modelCapabilityRules.js";
import { findModel } from "../model-library/unifiedModelRegistry.js";
import { createNvidiaUnifiedClient } from "../providers/nvidia/nvidiaUnifiedClient.js";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-312a-nvidia-real-smoke.json");
const evidenceMdPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-312a-nvidia-real-smoke.md");
const minDelayMs = 3_100;

const env = process.env;
const modelLibraryStore = createModelLibraryStore({ env });
let registry = modelLibraryStore.getRegistry();

const evidence = {
  phase: "312A",
  name: "NVIDIA Real Model Smoke",
  generatedAt: new Date().toISOString(),
  status: "skipped",
  sealed: false,
  realSmokeEnabled: env.PHASE312A_NVIDIA_REAL_SMOKE === "1",
  apiKeyPresent: Boolean(env.NVIDIA_API_KEY),
  rateLimit: "max 20 calls per minute",
  defaultChatChanged: false,
  paidApiCalled: false,
  mimoCalled: false,
  embeddingBatchTrainingCalled: false,
  candidateModelIds: [],
  results: [],
  chatGateway: null,
  summary: {},
  blockers: [],
};

if (!evidence.realSmokeEnabled) {
  evidence.status = "skipped-not-enabled";
  evidence.blockers.push("real_smoke_not_enabled");
  await writeEvidenceWithRenderer(dirname(evidenceJsonPath), evidenceJsonPath, evidenceMdPath, evidence, renderMarkdown);
  console.log(JSON.stringify({ status: evidence.status, blockers: evidence.blockers }, null, 2));
  process.exit(0);
}

if (!evidence.apiKeyPresent) {
  evidence.status = "fail";
  evidence.blockers.push("nvidia_api_key_missing");
  await writeEvidenceWithRenderer(dirname(evidenceJsonPath), evidenceJsonPath, evidenceMdPath, evidence, renderMarkdown);
  console.error(JSON.stringify({ status: evidence.status, blockers: evidence.blockers }, null, 2));
  process.exit(1);
}

const candidates = selectSmokeCandidates(registry, env);
evidence.candidateModelIds = candidates.map((model) => model.modelId);
if (candidates.length === 0) {
  evidence.status = "fail";
  evidence.blockers.push("no_smoke_candidates");
  await writeEvidenceWithRenderer(dirname(evidenceJsonPath), evidenceJsonPath, evidenceMdPath, evidence, renderMarkdown);
  console.error(JSON.stringify({ status: evidence.status, blockers: evidence.blockers }, null, 2));
  process.exit(1);
}

const client = createNvidiaUnifiedClient({ env, modelLibraryStore });
for (let index = 0; index < candidates.length; index += 1) {
  const model = candidates[index];
  if (index > 0) {
    await sleep(minDelayMs);
  }
  const result = await callModelSmoke({ client, model });
  modelLibraryStore.recordSmokeResult({ providerId: model.providerId, modelId: model.modelId, result });
  evidence.results.push({
    providerId: model.providerId,
    modelId: model.modelId,
    endpointType: model.endpointType,
    primaryCapability: model.primaryCapability,
    status: classifySmokeStatus(result),
    success: result.success === true,
    code: result.code,
    message: redactSecrets(result.message ?? ""),
    providerCalled: result.meta?.providerCalled === true,
    modelCalled: result.meta?.modelCalled ?? null,
    realExternalCall: result.meta?.realExternalCall === true,
    durationMs: result.meta?.durationMs ?? null,
  });
}

const firstUsableChat = candidates.find((model) => model.endpointType === ENDPOINT_TYPES.chat);
if (firstUsableChat && evidence.results.some((result) => result.modelId === firstUsableChat.modelId && result.success)) {
  await sleep(minDelayMs);
  evidence.chatGateway = await runChatGatewayRealSmoke({ env, manualModel: firstUsableChat });
}

registry = modelLibraryStore.getRegistry();
const selectableAfter = registry.models.filter((model) => model.state?.selectable);
const failedSelectable = evidence.results.filter((result) => {
  const model = findModel(registry, result.providerId, result.modelId);
  return model?.state?.selectable && result.success !== true;
});
const failedResults = evidence.results.filter((result) => result.success !== true);

evidence.summary = {
  attempted: evidence.results.length,
  usable: evidence.results.filter((result) => result.status === "usable").length,
  blocked: evidence.results.filter((result) => result.status === "blocked").length,
  wrongEndpoint: evidence.results.filter((result) => result.status === "wrong_endpoint").length,
  rateLimited: evidence.results.filter((result) => result.status === "rate_limited").length,
  selectableAfterSmoke: selectableAfter.length,
  smokePassedAfterSmoke: registry.summary.smokePassedModelCount,
  unverifiedAfterSmoke: registry.summary.unverifiedModelCount,
};

if (failedSelectable.length > 0 || failedResults.length > 0) {
  evidence.status = "fail";
  evidence.blockers.push(failedResults.some((result) => result.status === "rate_limited") ? "real_smoke_rate_limited" : "real_smoke_failed");
} else if (evidence.chatGateway && (evidence.chatGateway.automatic?.verifiedCompleted !== true || evidence.chatGateway.manual?.verifiedCompleted !== true)) {
  evidence.status = "fail";
  evidence.blockers.push("chat_gateway_real_smoke_failed");
} else {
  evidence.status = "pass";
  evidence.sealed = false;
}

await writeEvidenceWithRenderer(dirname(evidenceJsonPath), evidenceJsonPath, evidenceMdPath, evidence, renderMarkdown);
if (evidence.status !== "pass") {
  console.error(JSON.stringify({
    status: evidence.status,
    blockers: evidence.blockers,
    summary: evidence.summary,
    results: evidence.results.map((result) => ({ modelId: result.modelId, status: result.status, code: result.code })),
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: evidence.status,
    summary: evidence.summary,
    results: evidence.results.map((result) => ({ modelId: result.modelId, status: result.status, code: result.code })),
  }, null, 2));
}

async function runChatGatewayRealSmoke({ env, manualModel }) {
  const application = createGatewayApplication(env);
  const server = createGatewayHttpServer(application);
  const baseUrl = await listen(server);
  try {
    const automatic = await requestJson(`${baseUrl}/chat-gateway/execute`, {
      input: "Reply briefly with Phase312A automatic gateway real smoke ok.",
      mode: "automatic_gateway",
    });
    await sleep(minDelayMs);
    const manual = await requestJson(`${baseUrl}/chat-gateway/execute`, {
      input: "Reply briefly with Phase312A manual gateway real smoke ok.",
      mode: "manual_model",
      selectedModel: { providerId: manualModel.providerId, modelId: manualModel.modelId },
    });
    return {
      serviceUrl: baseUrl,
      automatic: summarizeGatewaySmoke(automatic),
      manual: summarizeGatewaySmoke(manual),
    };
  } finally {
    await closeServer(server);
  }
}

function summarizeGatewaySmoke(response) {
  const data = response.payload?.data ?? {};
  return {
    httpStatus: response.httpStatus,
    success: data.success === true,
    code: data.code,
    intentType: data.intentType,
    providerId: data.providerId,
    modelId: data.modelId,
    realExternalCall: data.realExternalCall === true,
    verifiedCompleted: data.verifiedCompleted === true,
    completionStatus: data.completionStatus,
    blockers: data.blockers ?? [],
  };
}

function closeServer(server) {
  return new Promise((resolveClose) => server.close(() => resolveClose()));
}

async function requestJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { text };
  }
  return {
    ok: response.ok,
    httpStatus: response.status,
    payload,
  };
}

function selectSmokeCandidates(registry, env) {
  const requested = parseRequestedModelIds(env.PHASE312A_NVIDIA_REAL_SMOKE_MODELS || env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct");
  const selectable = registry.models.filter((model) => model.providerId === "nvidia" && model.state?.selectable);
  const byId = new Map();
  for (const model of selectable) {
    byId.set(model.modelId, model);
  }
  for (const modelId of requested) {
    const model = findModel(registry, "nvidia", modelId);
    if (model) byId.set(model.modelId, model);
  }
  return Array.from(byId.values()).filter(isSmokeExecutableModel);
}

function parseRequestedModelIds(value) {
  return String(value ?? "")
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isSmokeExecutableModel(model) {
  return [
    ENDPOINT_TYPES.chat,
    ENDPOINT_TYPES.embeddings,
    ENDPOINT_TYPES.rerank,
    ENDPOINT_TYPES.safety,
    ENDPOINT_TYPES.pii,
    ENDPOINT_TYPES.translation,
  ].includes(model.endpointType) && model.downloadableOnly !== true && model.requiresSpecialPayload !== true;
}

async function callModelSmoke({ client, model }) {
  if (model.endpointType === ENDPOINT_TYPES.chat) {
    return client.chatCompletion({
      modelId: model.modelId,
      messages: [{ role: "user", content: "Reply with exactly: phase312a-model-smoke-ok" }],
      maxTokens: 24,
      capability: model.primaryCapability,
    });
  }
  if (model.endpointType === ENDPOINT_TYPES.embeddings) {
    return client.embeddings({ modelId: model.modelId, input: "phase312a embedding smoke" });
  }
  if (model.endpointType === ENDPOINT_TYPES.rerank) {
    return client.rerank({
      modelId: model.modelId,
      query: "Phase312A smoke",
      passages: ["Phase312A smoke validates rerank.", "Unrelated text."],
    });
  }
  if (model.endpointType === ENDPOINT_TYPES.safety) {
    return client.safety({ modelId: model.modelId, text: "This is a harmless safety review smoke test." });
  }
  if (model.endpointType === ENDPOINT_TYPES.pii) {
    return client.piiDetection({ modelId: model.modelId, text: "Contact Jane Doe at jane@example.com for a harmless test." });
  }
  if (model.endpointType === ENDPOINT_TYPES.translation) {
    return client.translation({ modelId: model.modelId, text: "Hello world.", targetLanguage: "Chinese" });
  }
  return {
    success: false,
    code: "endpoint_not_smoke_enabled",
    message: `Endpoint ${model.endpointType} is not enabled for Phase312A smoke.`,
    meta: {
      providerId: model.providerId,
      modelId: model.modelId,
      endpointType: model.endpointType,
      providerCalled: false,
      modelCalled: null,
      realExternalCall: false,
      fallbackUsed: false,
    },
  };
}

function classifySmokeStatus(result) {
  if (result?.success === true) return "usable";
  if (result?.code === "endpoint_type_mismatch" || result?.code === "endpoint_not_smoke_enabled") return "wrong_endpoint";
  if (result?.code === "nvidia_rate_limited") return "rate_limited";
  return "blocked";
}


function renderMarkdown(evidence) {
  return [
    "# Phase312A NVIDIA Real Smoke",
    "",
    `- status: ${evidence.status}`,
    `- sealed: ${evidence.sealed}`,
    `- realSmokeEnabled: ${evidence.realSmokeEnabled}`,
    `- apiKeyPresent: ${evidence.apiKeyPresent}`,
    `- blockers: ${evidence.blockers.length ? evidence.blockers.join(", ") : "none"}`,
    "",
    "## Summary",
    ...Object.entries(evidence.summary ?? {}).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Results",
    ...evidence.results.map((result) => `- ${result.modelId}: ${result.status} (${result.code})`),
    "",
  ].join("\n");
}

function redactSecrets(text) {
  return String(text)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/\b(nvapi|sk|pk|ak|sk-proj)[A-Za-z0-9._-]{8,}\b/gi, "[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret|key)=)[^&\s]+/gi, "$1[redacted]");
}
