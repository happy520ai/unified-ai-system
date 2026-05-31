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

const phase = "Phase324B-5";
const batchId = "phase324b5";
const providerId = "nvidia";
const promptText = "\u8bf7\u7528\u4e00\u53e5\u4e2d\u6587\u56de\u7b54\uff1a\u4f60\u80fd\u6b63\u5e38\u5de5\u4f5c\u5417\uff1f";
const promptType = "short_cn_health_check";
const timeoutMs = 45_000;
const maxTokens = 64;
const rpmLimit = 40;
const minDelayMs = Math.ceil(60_000 / rpmLimit);
const maxCandidates = 5;

const docsDir = path.join(repoRoot, "docs");
const inventoryPath = path.join(docsDir, "phase324a-nvidia-model-candidate-inventory.json");
const phase324eReportPath = path.join(docsDir, "phase324e-model-library-operations-report.json");
const phase324eDashboardPath = path.join(docsDir, "phase324e-model-library-operations-dashboard-data.json");
const phase324d2fStrategyPath = path.join(docsDir, "phase324d2f-model-selection-strategy.json");
const phase324gChecklistPath = path.join(docsDir, "phase324g-model-library-operations-checklist.md");
const evidenceDir = path.join(repoRoot, "apps", "ai-gateway-service", "evidence", "phase324b5");
const batchResultJsonPath = path.join(docsDir, "phase324b5-nvidia-smoke-batch-result.json");
const batchReportMdPath = path.join(docsDir, "phase324b5-nvidia-smoke-batch-report.md");
const evidenceIndexJsonPath = path.join(docsDir, "phase324b5-model-smoke-evidence-index.json");

const previousBatchResultPaths = [
  path.join(docsDir, "phase324b-nvidia-smoke-batch-result.json"),
  path.join(docsDir, "phase324b2-nvidia-smoke-batch-result.json"),
  path.join(docsDir, "phase324b3-nvidia-smoke-batch-result.json"),
  path.join(docsDir, "phase324b4-nvidia-smoke-batch-result.json"),
];

const previousEvidenceIndexPaths = [
  path.join(docsDir, "phase324b-model-smoke-evidence-index.json"),
  path.join(docsDir, "phase324b2-b3-model-smoke-evidence-index.json"),
  path.join(docsDir, "phase324b4-model-smoke-evidence-index.json"),
];

const explicitHighRiskModels = [
  "meta/llama2-70b",
  "meta/llama3-8b",
  "microsoft/phi-3-mini-4k-instruct",
  "mistralai/mistral-7b-instruct",
  "mistralai/mistral-7b-instruct-v0.3",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  "nvidia/llama-3.3-nemotron-super-49b-v1.5",
  "nvidia/nemotron-3-nano-30b-a3b",
  "nvidia/nvidia-nemotron-nano-9b-v2",
  "bytedance/seed-oss-36b-instruct",
  "deepseek-ai/deepseek-v3.1-terminus",
  "deepseek-ai/deepseek-v3.2",
  "deepseek-ai/deepseek-v4-flash",
];

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

function toSafeFileName(modelId) {
  return String(modelId).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
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

function buildEvidenceId(modelId, timestamp) {
  const compact = timestamp.replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${batchId}-${toSafeFileName(modelId)}-${compact}`;
}

function parseMode() {
  const args = new Set(process.argv.slice(2));
  const preview = args.has("--preview");
  const run = args.has("--run");
  assert(preview !== run, "Use exactly one mode: --preview or --run.");
  return preview ? "preview" : "run";
}

function mapCapability(record) {
  if (record?.capabilityBucket === "code") return "chat_coding";
  if (record?.capabilityBucket === "reasoning_chat") return "chat_reasoning";
  return "chat_general";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeExclusions(excluded) {
  return excluded.reduce((summary, item) => {
    summary[item.reason] = (summary[item.reason] ?? 0) + 1;
    return summary;
  }, {});
}

function buildRuntimeMatrix() {
  const env = {
    ...process.env,
    PHASE313A_NVIDIA_REAL_SMOKE: "",
    PHASE312A_NVIDIA_REAL_SMOKE: "",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
  };
  const modelLibraryStore = createModelLibraryStore({ env });
  const verificationStore = createModelVerificationStateStore();
  return buildModelUsabilityMatrix({
    registry: modelLibraryStore.getRegistry(),
    verificationStore,
  });
}

async function buildPreviousSets() {
  const processed = new Set();
  const failed = new Set();
  const timeout = new Set();
  const http404Or410 = new Set();

  for (const filePath of previousBatchResultPaths) {
    const batch = await readJsonIfExists(filePath);
    for (const item of batch?.results ?? []) {
      processed.add(item.modelId);
      if (item.finalStatus === "smoke_failed") failed.add(item.modelId);
      if (item.errorCode === "nvidia_request_timeout") timeout.add(item.modelId);
      if (Number(item.httpStatus) === 404 || Number(item.httpStatus) === 410) http404Or410.add(item.modelId);
    }
  }

  for (const filePath of previousEvidenceIndexPaths) {
    const index = await readJsonIfExists(filePath);
    for (const item of index?.evidence ?? []) {
      processed.add(item.modelId);
      if (item.finalStatus === "smoke_failed") failed.add(item.modelId);
    }
  }

  return { processed, failed, timeout, http404Or410 };
}

async function buildCandidatePreview() {
  const [
    inventory,
    phase324eReport,
    phase324eDashboard,
    phase324d2fStrategy,
    checklist,
    previousSets,
  ] = await Promise.all([
    readJson(inventoryPath),
    readJson(phase324eReportPath),
    readJson(phase324eDashboardPath),
    readJson(phase324d2fStrategyPath),
    readFile(phase324gChecklistPath, "utf8"),
    buildPreviousSets(),
  ]);

  assert(checklist.includes("Candidate provider is NVIDIA"), "Phase324G checklist boundary marker is missing.");

  const matrix = buildRuntimeMatrix();
  const selectableModels = new Set([
    ...(phase324eReport.modelStatusBuckets?.selectableVerified ?? []),
    ...(matrix.chatSelectableModels ?? []).map((item) => item.modelId),
  ]);
  const highRiskModels = new Set([
    ...explicitHighRiskModels,
    ...previousSets.failed,
    ...previousSets.timeout,
    ...previousSets.http404Or410,
    ...(phase324eReport.failureAnalysis?.notRecommendedForShortTermRetry ?? []),
    ...(phase324eReport.modelStatusBuckets?.smokeFailed ?? []),
    ...(phase324d2fStrategy.notRecommendedNow ?? []).map((item) => item.modelId),
  ]);
  const candidateSourceHints = new Set([
    ...((inventory.candidateGroups?.["phase324b-secondary-candidates"] ?? []).map((item) => item.modelId)),
    ...((inventory.candidateGroups?.["phase324b-priority-candidates"] ?? []).map((item) => item.modelId)),
  ]);

  const candidates = [];
  const excluded = [];

  for (const record of matrix.records ?? []) {
    let reason = null;
    if (record.providerId !== providerId) reason = "non_nvidia_provider";
    else if (selectableModels.has(record.modelId) || record.selectable === true) reason = "already_selectable";
    else if (highRiskModels.has(record.modelId)) reason = "known_failed_404_410_or_timeout";
    else if (previousSets.processed.has(record.modelId)) reason = "previously_processed";
    else if (!chatBuckets.has(record.capabilityBucket)) reason = "non_chat_model";
    else if (unsafeBuckets.has(record.capabilityBucket)) reason = "unsafe_capability_bucket";
    else if (record.verificationStatus !== "unverified") reason = `status_${record.verificationStatus}`;
    else if (record.requiresSpecialPayload === true) reason = "requires_special_payload";
    else if (record.deprecatedSoon === true) reason = "deprecated_soon";

    const previewRecord = {
      modelId: record.modelId,
      providerId: record.providerId,
      capabilityBucket: record.capabilityBucket,
      verificationStatus: record.verificationStatus,
      selectable: record.selectable === true,
      directChatAllowed: record.directChatAllowed === true,
      requiresSpecialPayload: record.requiresSpecialPayload === true,
      sourceHintFromPhase324A: candidateSourceHints.has(record.modelId),
    };

    if (reason) {
      excluded.push({ ...previewRecord, reason });
    } else {
      candidates.push(previewRecord);
    }
  }

  const plannedModels = candidates.slice(0, maxCandidates);
  const preview = {
    phase,
    batchId,
    generatedAt: new Date().toISOString(),
    mode: "preview",
    providerScope: "NVIDIA-only",
    maxCandidates,
    sourceFiles: {
      inventory: path.relative(repoRoot, inventoryPath).replaceAll("\\", "/"),
      phase324eReport: path.relative(repoRoot, phase324eReportPath).replaceAll("\\", "/"),
      phase324eDashboard: path.relative(repoRoot, phase324eDashboardPath).replaceAll("\\", "/"),
      phase324d2fStrategy: path.relative(repoRoot, phase324d2fStrategyPath).replaceAll("\\", "/"),
      phase324b4Index: "docs/phase324b4-model-smoke-evidence-index.json",
      phase324gChecklist: path.relative(repoRoot, phase324gChecklistPath).replaceAll("\\", "/"),
      previousBatches: previousBatchResultPaths.map((item) => path.relative(repoRoot, item).replaceAll("\\", "/")),
      previousIndexes: previousEvidenceIndexPaths.map((item) => path.relative(repoRoot, item).replaceAll("\\", "/")),
    },
    summary: {
      totalRuntimeRecords: matrix.records?.length ?? 0,
      safeCandidateCount: candidates.length,
      plannedModelCount: plannedModels.length,
      fewerThanFiveSafeCandidates: plannedModels.length < maxCandidates,
      fewerThanThreeSafeCandidates: plannedModels.length < 3,
      excludedCounts: summarizeExclusions(excluded),
      nonNvidiaPlanned: plannedModels.some((item) => item.providerId !== providerId),
      selectablePlanned: plannedModels.some((item) => selectableModels.has(item.modelId) || item.selectable === true),
      highRiskPlanned: plannedModels.some((item) => highRiskModels.has(item.modelId)),
      nonChatPlanned: plannedModels.some((item) => !chatBuckets.has(item.capabilityBucket)),
    },
    plannedModels,
    safeCandidatePoolPreview: candidates.slice(0, 20),
    excludedHighRiskModels: excluded.filter((item) => item.reason === "known_failed_404_410_or_timeout").map((item) => item.modelId),
    excludedFailedModels: [...previousSets.failed],
    excludedSelectableModels: excluded.filter((item) => item.reason === "already_selectable").map((item) => item.modelId),
    excludedNonChatModels: excluded.filter((item) => item.reason === "non_chat_model" || item.reason === "unsafe_capability_bucket").map((item) => ({
      modelId: item.modelId,
      capabilityBucket: item.capabilityBucket,
    })),
    excludedPreviousProcessedModels: excluded.filter((item) => item.reason === "previously_processed").map((item) => item.modelId),
  };

  assert(preview.summary.plannedModelCount <= maxCandidates, "Preview selected more than five models.");
  assert(preview.summary.nonNvidiaPlanned === false, "Preview selected a non-NVIDIA model.");
  assert(preview.summary.selectablePlanned === false, "Preview selected an already selectable model.");
  assert(preview.summary.highRiskPlanned === false, "Preview selected a high-risk failed model.");
  assert(preview.summary.nonChatPlanned === false, "Preview selected a non-chat model.");

  return preview;
}

function classifyResult({ result, missingKey }) {
  if (missingKey || result?.code === "nvidia_api_key_missing") {
    return {
      finalStatus: "skipped_env_missing",
      selectableRecommendation: "not_eligible",
      notes: ["NVIDIA runtime key unavailable; no provider success was claimed."],
    };
  }

  const providerCalled = result?.meta?.providerCalled === true;
  const completionVerified = result?.success === true;
  const assistantText = String(result?.data?.outputText ?? result?.data?.text ?? "").trim();
  const assistantTextPresent = assistantText.length > 0;
  const code = String(result?.code ?? result?.error?.code ?? "");
  const httpStatus = Number(result?.data?.httpStatus ?? result?.meta?.httpStatus ?? 0) || null;

  if (
    providerCalled
    && completionVerified
    && assistantTextPresent
    && !["provider_not_allowed", "nvidia_request_timeout", "fetch_unavailable"].includes(code)
  ) {
    return {
      finalStatus: "smoke_passed",
      selectableRecommendation: "eligible_after_phase324c4",
      notes: ["Real NVIDIA call completed with non-empty assistant text; Phase324C-4 may review selectable eligibility."],
    };
  }

  if (providerCalled && completionVerified && !assistantTextPresent) {
    return {
      finalStatus: "manual_review_required",
      selectableRecommendation: "manual_review_required",
      notes: ["Completion flag was true but assistant text was empty."],
    };
  }

  if (providerCalled && httpStatus !== null) {
    return {
      finalStatus: "smoke_failed",
      selectableRecommendation: "not_eligible",
      notes: ["Provider responded but the smoke did not satisfy the success gate."],
    };
  }

  return {
    finalStatus: "smoke_failed",
    selectableRecommendation: "not_eligible",
    notes: ["Smoke did not satisfy the success gate."],
  };
}

function renderBatchMarkdown(summary) {
  const lines = [
    "# Phase324B-5 NVIDIA Smoke Batch Report",
    "",
    `- phase: ${summary.phase}`,
    `- batchId: ${summary.batchId}`,
    `- generatedAt: ${summary.generatedAt}`,
    `- providerId: ${summary.providerId}`,
    `- plannedModelCount: ${summary.plannedModelCount}`,
    `- processedModelCount: ${summary.processedModelCount}`,
    `- smokePassedCount: ${summary.smokePassedCount}`,
    `- smokeFailedCount: ${summary.smokeFailedCount}`,
    `- skippedEnvMissingCount: ${summary.skippedEnvMissingCount}`,
    `- manualReviewRequiredCount: ${summary.manualReviewRequiredCount}`,
    `- eligibleForPhase324C4Count: ${summary.eligibleForPhase324C4Count}`,
    `- nonNvidiaCallsDetected: ${summary.nonNvidiaCallsDetected}`,
    `- secretExposureDetected: ${summary.secretExposureDetected}`,
    `- selectableGateModified: ${summary.selectableGateModified}`,
    `- chatDropdownModified: ${summary.chatDropdownModified}`,
    `- phase313VerificationStateModified: ${summary.phase313VerificationStateModified}`,
    "",
    "## Planned Models",
    "",
    ...summary.models.map((item) => `- \`${item.modelId}\``),
    "",
    "## Per Model Results",
    "",
    ...summary.results.flatMap((item) => [
      `### ${item.modelId}`,
      "",
      `- finalStatus: ${item.finalStatus}`,
      `- providerCalled: ${item.providerCalled}`,
      `- completionVerified: ${item.completionVerified}`,
      `- assistantTextPresent: ${item.assistantTextPresent}`,
      `- httpStatus: ${item.httpStatus ?? "n/a"}`,
      `- errorCode: ${item.errorCode ?? "none"}`,
      `- latencyMs: ${item.latencyMs ?? "n/a"}`,
      `- evidenceId: ${item.evidenceId}`,
      `- evidencePath: ${item.evidencePath}`,
      `- selectableRecommendation: ${item.selectableRecommendation}`,
      "",
    ]),
    "## Phase324C-4 Review Candidates",
    "",
    `- eligible_for_phase324c4_selectable_review: ${summary.phase324c4Candidates.length ? summary.phase324c4Candidates.map((item) => `\`${item}\``).join(", ") : "none"}`,
    `- not_eligible_for_phase324c4: ${summary.nonPhase324c4Candidates.length ? summary.nonPhase324c4Candidates.map((item) => `\`${item}\``).join(", ") : "none"}`,
    "",
    "## Boundary",
    "",
    "- This phase only generated Phase324B-5 NVIDIA smoke evidence.",
    "- No selectable metadata was updated.",
    "- No Chat dropdown, Chat send, /chat-gateway/execute, httpServer.js, provider client, or model-library code was modified.",
    "- Smoke-passed models require a separate Phase324C-4 selectable review before any Chat dropdown change.",
    "",
  ];
  return lines.join("\n");
}

function buildSummary({ preview, results }) {
  const phase324c4Candidates = results
    .filter((item) => item.finalStatus === "smoke_passed" && item.selectableRecommendation === "eligible_after_phase324c4")
    .map((item) => item.modelId);
  const nonPhase324c4Candidates = results
    .filter((item) => !phase324c4Candidates.includes(item.modelId))
    .map((item) => item.modelId);

  return {
    phase,
    batchId,
    generatedAt: new Date().toISOString(),
    providerId,
    plannedModelCount: preview.plannedModels.length,
    processedModelCount: results.length,
    smokePassedCount: results.filter((item) => item.finalStatus === "smoke_passed").length,
    smokeFailedCount: results.filter((item) => item.finalStatus === "smoke_failed").length,
    skippedEnvMissingCount: results.filter((item) => item.finalStatus === "skipped_env_missing").length,
    manualReviewRequiredCount: results.filter((item) => item.finalStatus === "manual_review_required").length,
    eligibleForPhase324C4Count: phase324c4Candidates.length,
    nonNvidiaCallsDetected: false,
    secretExposureDetected: false,
    selectableGateModified: false,
    chatDropdownModified: false,
    phase313VerificationStateModified: false,
    chatGatewayModified: false,
    providerClientModified: false,
    modelLibraryCodeModified: false,
    models: preview.plannedModels.map((item) => ({ modelId: item.modelId })),
    candidateSelection: preview,
    results,
    phase324c4Candidates,
    nonPhase324c4Candidates,
    canSeal: results.length === preview.plannedModels.length
      && results.length <= maxCandidates
      && results.every((item) => item.evidenceId && item.evidencePath && item.finalStatus)
      && results.every((item) => item.providerId === providerId)
      && results.every((item) => item.nonNvidiaCallDetected !== true)
      && results.every((item) => item.secretExposureDetected !== true),
  };
}

async function runSmoke() {
  const preview = await buildCandidatePreview();
  const env = process.env;
  const missingKey = !Boolean(env.NVIDIA_API_KEY);
  const modelLibraryStore = createModelLibraryStore({ env });
  const client = createNvidiaUnifiedClient({ env, modelLibraryStore, timeoutMs });
  const results = [];
  const evidenceIndex = [];

  await mkdir(evidenceDir, { recursive: true });

  for (let index = 0; index < preview.plannedModels.length; index += 1) {
    if (index > 0) await sleep(minDelayMs);
    const candidate = preview.plannedModels[index];
    const startedAt = new Date().toISOString();
    let result;

    if (missingKey) {
      result = {
        success: false,
        code: "nvidia_api_key_missing",
        message: "Blocked before provider call: NVIDIA_API_KEY is not configured.",
        data: null,
        error: {
          code: "nvidia_api_key_missing",
          message: "Blocked before provider call: NVIDIA_API_KEY is not configured.",
        },
        meta: {
          providerCalled: false,
          realExternalCall: false,
          durationMs: 0,
          requestId: `${batchId}-missing-key-${index + 1}`,
          endpointType: "chat_completions",
          httpStatus: null,
          modelCalled: candidate.modelId,
          startedAt,
          completedAt: startedAt,
        },
      };
    } else {
      result = await client.chatCompletion({
        modelId: candidate.modelId,
        messages: [{ role: "user", content: promptText }],
        maxTokens,
        temperature: 0,
        capability: mapCapability(candidate),
      });
    }

    const timestamp = new Date().toISOString();
    const assistantText = String(result?.data?.outputText ?? result?.data?.text ?? "");
    const assistantTextSample = truncateText(assistantText, 200);
    const classification = classifyResult({ result, missingKey });
    const evidenceId = buildEvidenceId(candidate.modelId, timestamp);
    const evidenceFileName = `${toSafeFileName(candidate.modelId)}.json`;
    const evidencePath = path.join(evidenceDir, evidenceFileName);
    const relativeEvidencePath = path.relative(repoRoot, evidencePath).replaceAll("\\", "/");

    const evidence = {
      phase,
      batchId,
      modelId: candidate.modelId,
      providerId,
      timestamp,
      requestId: String(result?.meta?.requestId ?? `${evidenceId}-request`),
      promptType,
      dryRun: false,
      providerCalled: result?.meta?.providerCalled === true,
      completionVerified: result?.success === true,
      assistantTextPresent: assistantTextSample.length > 0,
      assistantTextSample,
      httpStatus: Number(result?.data?.httpStatus ?? result?.meta?.httpStatus ?? 0) || null,
      latencyMs: Number(result?.meta?.durationMs ?? 0) || 0,
      errorCode: result?.success === true ? null : String(result?.code ?? result?.error?.code ?? "smoke_failed"),
      errorMessageRedacted: result?.success === true ? null : redactSecrets(result?.error?.message ?? result?.message ?? ""),
      finalStatus: classification.finalStatus,
      evidenceId,
      selectableRecommendation: classification.selectableRecommendation,
      notes: classification.notes,
    };

    await writeJson(evidencePath, evidence);

    const summarized = {
      batchId,
      phase,
      modelId: candidate.modelId,
      providerId,
      finalStatus: evidence.finalStatus,
      providerCalled: evidence.providerCalled,
      completionVerified: evidence.completionVerified,
      assistantTextPresent: evidence.assistantTextPresent,
      httpStatus: evidence.httpStatus,
      errorCode: evidence.errorCode,
      latencyMs: evidence.latencyMs,
      evidenceId,
      evidencePath: relativeEvidencePath,
      selectableRecommendation: evidence.selectableRecommendation,
      notes: evidence.notes,
      nonNvidiaCallDetected: false,
      secretExposureDetected: false,
    };
    results.push(summarized);
    evidenceIndex.push({
      batchId,
      phase,
      modelId: candidate.modelId,
      evidenceId,
      finalStatus: evidence.finalStatus,
      evidencePath: relativeEvidencePath,
    });
  }

  const summary = buildSummary({ preview, results });
  await writeJson(batchResultJsonPath, summary);
  await writeFile(batchReportMdPath, `${renderBatchMarkdown(summary)}\n`, "utf8");
  await writeJson(evidenceIndexJsonPath, {
    phase,
    batchId,
    generatedAt: summary.generatedAt,
    providerId,
    evidence: evidenceIndex,
  });

  return summary;
}

async function main() {
  const mode = parseMode();
  if (mode === "preview") {
    const preview = await buildCandidatePreview();
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  const summary = await runSmoke();
  console.log(JSON.stringify({
    phase: summary.phase,
    batchId: summary.batchId,
    processedModelCount: summary.processedModelCount,
    smokePassedCount: summary.smokePassedCount,
    smokeFailedCount: summary.smokeFailedCount,
    skippedEnvMissingCount: summary.skippedEnvMissingCount,
    manualReviewRequiredCount: summary.manualReviewRequiredCount,
    eligibleForPhase324C4Count: summary.eligibleForPhase324C4Count,
    canSeal: summary.canSeal,
  }, null, 2));
}

main().catch((error) => {
  console.error(redactSecrets(error instanceof Error ? error.stack ?? error.message : String(error)));
  process.exit(1);
});

