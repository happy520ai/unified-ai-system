import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createModelLibraryStore } from "../../apps/ai-gateway-service/src/model-library/modelLibraryStore.js";
import { buildModelUsabilityMatrix } from "../../apps/ai-gateway-service/src/model-library/modelUsabilityMatrix.js";
import { createModelVerificationStateStore } from "../../apps/ai-gateway-service/src/model-library/modelVerificationStateStore.js";
import { createNvidiaUnifiedClient } from "../../apps/ai-gateway-service/src/providers/nvidia/nvidiaUnifiedClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const phase = "Phase324B-6";
const batchId = "phase324b6";
const providerId = "nvidia";
const promptText = "\u8bf7\u7528\u4e00\u53e5\u4e2d\u6587\u56de\u7b54\uff1a\u4f60\u80fd\u6b63\u5e38\u5de5\u4f5c\u5417\uff1f";
const timeoutMs = 45_000;
const maxTokens = 64;
const minDelayMs = Math.ceil(60_000 / 40);
const maxCandidates = 5;

const docsDir = path.join(repoRoot, "docs");
const evidenceDir = path.join(repoRoot, "apps", "ai-gateway-service", "evidence", "phase324b6");
const resultPath = path.join(docsDir, "phase324b6-nvidia-smoke-batch-result.json");
const reportPath = path.join(docsDir, "phase324b6-nvidia-smoke-batch-report.md");
const indexPath = path.join(docsDir, "phase324b6-model-smoke-evidence-index.json");

const batchResultPaths = [
  "phase324b-nvidia-smoke-batch-result.json",
  "phase324b2-nvidia-smoke-batch-result.json",
  "phase324b3-nvidia-smoke-batch-result.json",
  "phase324b4-nvidia-smoke-batch-result.json",
  "phase324b5-nvidia-smoke-batch-result.json",
].map((name) => path.join(docsDir, name));

const evidenceIndexPaths = [
  "phase324b-model-smoke-evidence-index.json",
  "phase324b2-b3-model-smoke-evidence-index.json",
  "phase324b4-model-smoke-evidence-index.json",
  "phase324b5-model-smoke-evidence-index.json",
].map((name) => path.join(docsDir, name));

const unsafeBuckets = new Set([
  "embedding",
  "rerank",
  "vision",
  "safety",
  "biology",
  "voice",
  "video",
  "openusd",
  "autonomous_driving",
  "multimodal",
  "audio",
  "pii",
  "translation",
  "unknown",
  "deprecated",
]);

const chatBuckets = new Set(["chat", "reasoning_chat", "code"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function redactSecrets(text) {
  return String(text ?? "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/\b(nvapi|sk|pk|ak|sk-proj)[A-Za-z0-9._-]{8,}\b/gi, "[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret|key)=)[^&\s]+/gi, "$1[redacted]");
}

function truncateText(text, limit = 200) {
  const normalized = redactSecrets(text).replace(/\s+/g, " ").trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, Math.max(0, limit - 3))}...`;
}

function safeName(modelId) {
  return String(modelId).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function evidenceIdFor(modelId, timestamp) {
  const compact = timestamp.replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${batchId}-${safeName(modelId)}-${compact}`;
}

function parseMode() {
  const args = new Set(process.argv.slice(2));
  const preview = args.has("--preview");
  const run = args.has("--run");
  assert(preview !== run, "Use exactly one mode: --preview or --run.");
  return preview ? "preview" : "run";
}

function buildRuntimeMatrix() {
  const store = createModelLibraryStore({
    env: {
      ...process.env,
      PHASE313A_NVIDIA_REAL_SMOKE: "",
      PHASE312A_NVIDIA_REAL_SMOKE: "",
      PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
    },
  });
  return buildModelUsabilityMatrix({
    registry: store.getRegistry(),
    verificationStore: createModelVerificationStateStore(),
  });
}

async function buildPriorSets() {
  const processed = new Set();
  const failed = new Set();
  const highRisk = new Set();
  const smokePassed = new Set();

  for (const filePath of batchResultPaths) {
    const batch = await readJsonIfExists(filePath);
    for (const item of batch?.results ?? []) {
      processed.add(item.modelId);
      if (item.finalStatus === "smoke_passed") smokePassed.add(item.modelId);
      if (item.finalStatus === "smoke_failed") failed.add(item.modelId);
      if (item.finalStatus === "smoke_failed" || [404, 410].includes(Number(item.httpStatus)) || item.errorCode === "nvidia_request_timeout") {
        highRisk.add(item.modelId);
      }
    }
  }

  for (const filePath of evidenceIndexPaths) {
    const index = await readJsonIfExists(filePath);
    for (const item of index?.evidence ?? []) {
      processed.add(item.modelId);
      if (item.finalStatus === "smoke_passed") smokePassed.add(item.modelId);
      if (item.finalStatus === "smoke_failed") failed.add(item.modelId);
    }
  }

  return { processed, failed, highRisk, smokePassed };
}

async function buildPreview() {
  const [matrix, prior] = await Promise.all([
    Promise.resolve(buildRuntimeMatrix()),
    buildPriorSets(),
  ]);
  const selectable = new Set((matrix.chatSelectableModels ?? []).map((item) => item.modelId));
  for (const record of matrix.records ?? []) {
    if (record.verificationStatus === "smoke_passed") prior.smokePassed.add(record.modelId);
    if (record.verificationStatus === "smoke_failed") prior.failed.add(record.modelId);
  }

  const excluded = [];
  const candidates = [];
  for (const record of matrix.records ?? []) {
    let reason = null;
    if (record.providerId !== providerId) reason = "non_nvidia";
    else if (selectable.has(record.modelId) || record.selectable === true) reason = "selectable";
    else if (prior.smokePassed.has(record.modelId)) reason = "smoke_passed";
    else if (prior.failed.has(record.modelId)) reason = "failed";
    else if (prior.highRisk.has(record.modelId)) reason = "high_risk_404_410_timeout";
    else if (prior.processed.has(record.modelId)) reason = "already_processed";
    else if (!chatBuckets.has(record.capabilityBucket) || unsafeBuckets.has(record.capabilityBucket)) reason = "non_chat";
    else if (record.requiresSpecialPayload === true) reason = "requires_special_payload";
    else if (record.verificationStatus !== "unverified") reason = `status_${record.verificationStatus}`;

    const item = {
      modelId: record.modelId,
      provider: record.providerId,
      capabilityBucket: record.capabilityBucket,
      verificationStatus: record.verificationStatus,
      selectable: record.selectable === true,
    };
    if (reason) excluded.push({ ...item, reason });
    else candidates.push(item);
  }

  const plannedSmokeModels = candidates.slice(0, maxCandidates);
  const preview = {
    phase,
    mode: "preview",
    providerScope: "nvidia_only",
    providerCalled: false,
    excludedSelectableModels: excluded.filter((item) => item.reason === "selectable").map((item) => item.modelId),
    excludedSmokePassedModels: excluded.filter((item) => item.reason === "smoke_passed").map((item) => item.modelId),
    excludedFailedModels: excluded.filter((item) => item.reason === "failed").map((item) => item.modelId),
    excludedHighRiskModels: excluded.filter((item) => item.reason === "high_risk_404_410_timeout").map((item) => item.modelId),
    excludedNonNvidiaModels: excluded.filter((item) => item.reason === "non_nvidia").map((item) => item.modelId),
    excludedAlreadyProcessedModels: excluded.filter((item) => item.reason === "already_processed").map((item) => item.modelId),
    excludedNonChatModels: excluded.filter((item) => item.reason === "non_chat").map((item) => item.modelId),
    safeCandidateCount: candidates.length,
    plannedSmokeModels,
    plannedSmokeCount: plannedSmokeModels.length,
    safety: {
      noProviderCallInPreview: true,
      noSelectableChange: true,
      noChatMainChainTouched: true,
    },
  };

  assert(preview.plannedSmokeModels.every((item) => item.provider === "nvidia"), "Preview includes non-NVIDIA model.");
  assert(preview.plannedSmokeModels.every((item) => !selectable.has(item.modelId)), "Preview includes selectable model.");
  assert(preview.plannedSmokeModels.every((item) => !prior.processed.has(item.modelId)), "Preview includes already processed model.");
  return preview;
}

function mapCapability(record) {
  if (record.capabilityBucket === "code") return "chat_coding";
  if (record.capabilityBucket === "reasoning_chat") return "chat_reasoning";
  return "chat_general";
}

function classify({ result, missingKey }) {
  if (missingKey || result?.code === "nvidia_api_key_missing") {
    return { finalStatus: "skipped_env_missing", selectableRecommendation: "not_eligible" };
  }
  const providerCalled = result?.meta?.providerCalled === true;
  const completionVerified = result?.success === true;
  const text = String(result?.data?.outputText ?? result?.data?.text ?? "").trim();
  const assistantTextPresent = text.length > 0;
  const httpStatus = Number(result?.data?.httpStatus ?? result?.meta?.httpStatus ?? 0) || null;
  const errorCode = completionVerified ? "" : String(result?.code ?? result?.error?.code ?? "");
  if (providerCalled && httpStatus === 200 && completionVerified && assistantTextPresent && !errorCode) {
    return { finalStatus: "smoke_passed", selectableRecommendation: "eligible_after_phase324c5" };
  }
  if (providerCalled && completionVerified && !assistantTextPresent) {
    return { finalStatus: "manual_review_required", selectableRecommendation: "manual_review_required" };
  }
  return { finalStatus: "smoke_failed", selectableRecommendation: "not_eligible" };
}

function renderReport(summary) {
  const lines = [
    "# Phase324B-6 NVIDIA Smoke Batch Report",
    "",
    "## Preview Summary",
    "",
    `- safeCandidateCount: ${summary.preview.safeCandidateCount}`,
    `- plannedSmokeCount: ${summary.preview.plannedSmokeCount}`,
    "",
    "## Run Summary",
    "",
    `- processedCount: ${summary.summary.processedCount}`,
    `- smokePassedCount: ${summary.summary.smokePassedCount}`,
    `- smokeFailedCount: ${summary.summary.smokeFailedCount}`,
    `- skippedEnvMissingCount: ${summary.summary.skippedEnvMissingCount}`,
    `- manualReviewRequiredCount: ${summary.summary.manualReviewRequiredCount}`,
    `- eligibleForPhase324C5Count: ${summary.summary.eligibleForPhase324C5Count}`,
    "",
    "## Results",
    "",
    ...summary.results.flatMap((item) => [
      `### ${item.modelId}`,
      "",
      `- finalStatus: ${item.finalStatus}`,
      `- providerCalled: ${item.providerCalled}`,
      `- httpStatus: ${item.httpStatus ?? "n/a"}`,
      `- errorCode: ${item.errorCode ?? "none"}`,
      `- evidenceId: ${item.evidenceId}`,
      `- selectableRecommendation: ${item.selectableRecommendation}`,
      "",
    ]),
    "## Boundary",
    "",
    "- Passed models can only enter future Phase324C-5 review.",
    "- This phase did not modify selectable metadata or Chat dropdown.",
    "- Rollback is limited to B-6 evidence/report/index files.",
    "",
  ];
  return lines.join("\n");
}

async function run() {
  const preview = await buildPreview();
  if (preview.plannedSmokeCount === 0) {
    const skipped = {
      phase,
      mode: "run",
      providerScope: "nvidia_only",
      plannedSmokeModels: [],
      processedModels: [],
      summary: {
        plannedCount: 0,
        processedCount: 0,
        smokePassedCount: 0,
        smokeFailedCount: 0,
        skippedEnvMissingCount: 0,
        manualReviewRequiredCount: 0,
        eligibleForPhase324C5Count: 0,
        finalStatus: "skipped_no_safe_candidate",
      },
      results: [],
      preview,
      safety: {
        nvidiaApiCalled: false,
        nonNvidiaApiCalled: false,
        selectableModified: false,
        chatMainChainModified: false,
      },
    };
    await writeJson(resultPath, skipped);
    await writeJson(indexPath, { phase, evidence: [] });
    await writeFile(reportPath, `${renderReport(skipped)}\n`, "utf8");
    return skipped;
  }

  const env = process.env;
  const missingKey = !Boolean(env.NVIDIA_API_KEY);
  const store = createModelLibraryStore({ env });
  const client = createNvidiaUnifiedClient({ env, modelLibraryStore: store, timeoutMs });
  const results = [];
  await mkdir(evidenceDir, { recursive: true });

  for (let index = 0; index < preview.plannedSmokeModels.length; index += 1) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, minDelayMs));
    const model = preview.plannedSmokeModels[index];
    let result;
    const startedAt = new Date().toISOString();
    if (missingKey) {
      result = {
        success: false,
        code: "nvidia_api_key_missing",
        message: "Blocked before provider call: NVIDIA_API_KEY is not configured.",
        error: { code: "nvidia_api_key_missing", message: "Blocked before provider call: NVIDIA_API_KEY is not configured." },
        meta: { providerCalled: false, requestId: `${batchId}-missing-key-${index + 1}`, durationMs: 0, httpStatus: null, startedAt },
      };
    } else {
      result = await client.chatCompletion({
        modelId: model.modelId,
        messages: [{ role: "user", content: promptText }],
        maxTokens,
        temperature: 0,
        capability: mapCapability(model),
      });
    }
    const createdAt = new Date().toISOString();
    const text = String(result?.data?.outputText ?? result?.data?.text ?? "");
    const classified = classify({ result, missingKey });
    const evidenceId = evidenceIdFor(model.modelId, createdAt);
    const evidencePathAbs = path.join(evidenceDir, `${safeName(model.modelId)}.json`);
    const evidencePath = path.relative(repoRoot, evidencePathAbs).replaceAll("\\", "/");
    const evidence = {
      phase,
      modelId: model.modelId,
      provider: "nvidia",
      providerId: "nvidia",
      providerCalled: result?.meta?.providerCalled === true,
      finalStatus: classified.finalStatus,
      completionVerified: result?.success === true,
      assistantTextPresent: truncateText(text).length > 0,
      assistantTextSample: truncateText(text),
      httpStatus: Number(result?.data?.httpStatus ?? result?.meta?.httpStatus ?? 0) || null,
      errorCode: result?.success === true ? null : String(result?.code ?? result?.error?.code ?? "smoke_failed"),
      errorMessage: result?.success === true ? null : redactSecrets(result?.error?.message ?? result?.message ?? ""),
      latencyMs: Number(result?.meta?.durationMs ?? 0) || 0,
      evidenceId,
      evidencePath,
      selectableRecommendation: classified.selectableRecommendation,
      createdAt,
      safety: {
        nvidiaOnly: true,
        noNonNvidiaProviderCalled: true,
        noSelectableChange: true,
        notAddedToChatDropdown: true,
      },
    };
    await writeJson(evidencePathAbs, evidence);
    results.push(evidence);
  }

  const summary = {
    phase,
    mode: "run",
    providerScope: "nvidia_only",
    plannedSmokeModels: preview.plannedSmokeModels.map((item) => item.modelId),
    processedModels: results.map((item) => item.modelId),
    summary: {
      plannedCount: preview.plannedSmokeCount,
      processedCount: results.length,
      smokePassedCount: results.filter((item) => item.finalStatus === "smoke_passed").length,
      smokeFailedCount: results.filter((item) => item.finalStatus === "smoke_failed").length,
      skippedEnvMissingCount: results.filter((item) => item.finalStatus === "skipped_env_missing").length,
      manualReviewRequiredCount: results.filter((item) => item.finalStatus === "manual_review_required").length,
      eligibleForPhase324C5Count: results.filter((item) => item.selectableRecommendation === "eligible_after_phase324c5").length,
    },
    results,
    preview,
    safety: {
      nvidiaApiCalled: results.some((item) => item.providerCalled),
      nonNvidiaApiCalled: false,
      selectableModified: false,
      chatMainChainModified: false,
    },
  };
  await writeJson(resultPath, summary);
  await writeJson(indexPath, {
    phase,
    evidence: results.map((item) => ({
      modelId: item.modelId,
      finalStatus: item.finalStatus,
      evidenceId: item.evidenceId,
      evidencePath: item.evidencePath,
      selectableRecommendation: item.selectableRecommendation,
    })),
  });
  await writeFile(reportPath, `${renderReport(summary)}\n`, "utf8");
  return summary;
}

async function main() {
  const mode = parseMode();
  if (mode === "preview") {
    console.log(JSON.stringify(await buildPreview(), null, 2));
    return;
  }
  const summary = await run();
  console.log(JSON.stringify({
    phase,
    processedCount: summary.summary.processedCount,
    smokePassedCount: summary.summary.smokePassedCount,
    smokeFailedCount: summary.summary.smokeFailedCount,
    skippedEnvMissingCount: summary.summary.skippedEnvMissingCount,
    manualReviewRequiredCount: summary.summary.manualReviewRequiredCount,
    eligibleForPhase324C5Count: summary.summary.eligibleForPhase324C5Count,
  }, null, 2));
}

main().catch((error) => {
  console.error(redactSecrets(error instanceof Error ? error.stack ?? error.message : String(error)));
  process.exit(1);
});
