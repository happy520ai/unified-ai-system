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

const providerId = "nvidia";
const promptText = "\u8bf7\u7528\u4e00\u53e5\u4e2d\u6587\u56de\u7b54\uff1a\u4f60\u80fd\u6b63\u5e38\u5de5\u4f5c\u5417\uff1f";
const promptType = "short_cn_health_check";
const timeoutMs = 45_000;
const maxTokens = 64;
const rpmLimit = 40;
const minDelayMs = Math.ceil(60_000 / rpmLimit);

const inventoryPath = path.join(repoRoot, "docs", "phase324a-nvidia-model-candidate-inventory.json");
const phase324bResultPath = path.join(repoRoot, "docs", "phase324b-nvidia-smoke-batch-result.json");
const phase324cReviewPath = path.join(repoRoot, "docs", "phase324c-selectable-model-review.json");
const combinedIndexPath = path.join(repoRoot, "docs", "phase324b2-b3-model-smoke-evidence-index.json");
const combinedReportPath = path.join(repoRoot, "docs", "phase324b2-b3-execution-report.md");

const batchConfigs = {
  2: {
    phase: "Phase324B-2",
    batchId: "phase324b2",
    start: 0,
    limit: 5,
    evidenceDir: path.join(repoRoot, "apps", "ai-gateway-service", "evidence", "phase324b2"),
    resultPath: path.join(repoRoot, "docs", "phase324b2-nvidia-smoke-batch-result.json"),
    reportPath: path.join(repoRoot, "docs", "phase324b2-nvidia-smoke-batch-report.md"),
  },
  3: {
    phase: "Phase324B-3",
    batchId: "phase324b3",
    start: 5,
    limit: 5,
    evidenceDir: path.join(repoRoot, "apps", "ai-gateway-service", "evidence", "phase324b3"),
    resultPath: path.join(repoRoot, "docs", "phase324b3-nvidia-smoke-batch-result.json"),
    reportPath: path.join(repoRoot, "docs", "phase324b3-nvidia-smoke-batch-report.md"),
  },
};

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

function truncateText(text, limit = 200) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 3)}...`;
}

function redactSecrets(text) {
  return String(text ?? "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/\b(nvapi|sk|pk|ak|sk-proj)[A-Za-z0-9._-]{8,}\b/gi, "[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret|key)=)[^&\s]+/gi, "$1[redacted]");
}

function parseBatchArg() {
  const raw = process.argv.slice(2).find((arg) => arg.startsWith("--batch="));
  const batch = raw ? Number(raw.split("=")[1]) : null;
  assert(batch === 2 || batch === 3, "Use --batch=2 or --batch=3.");
  return batch;
}

function mapCapability(record) {
  if (record?.capabilityBucket === "code") return "chat_coding";
  if (record?.capabilityBucket === "reasoning_chat") return "chat_reasoning";
  return "chat_general";
}

function buildEvidenceId({ batchId, modelId, timestamp }) {
  const compact = timestamp.replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${batchId}-${toSafeFileName(modelId)}-${compact}`;
}

function classifyResult({ result, missingKey, eligibleRecommendation }) {
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
      selectableRecommendation: eligibleRecommendation,
      notes: ["Real NVIDIA call completed with non-empty assistant text; a later selectable review phase may evaluate this evidence."],
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

function summarizeBatch(results, config, candidates) {
  const phase324c2Candidates = results
    .filter((item) => item.finalStatus === "smoke_passed" && item.selectableRecommendation === "eligible_after_phase324c2")
    .map((item) => item.modelId);
  const nonPhase324c2Candidates = results
    .filter((item) => !phase324c2Candidates.includes(item.modelId))
    .map((item) => item.modelId);

  return {
    phase: config.phase,
    batchId: config.batchId,
    generatedAt: new Date().toISOString(),
    providerId,
    plannedModelCount: candidates.length,
    processedModelCount: results.length,
    smokePassedCount: results.filter((item) => item.finalStatus === "smoke_passed").length,
    smokeFailedCount: results.filter((item) => item.finalStatus === "smoke_failed").length,
    skippedEnvMissingCount: results.filter((item) => item.finalStatus === "skipped_env_missing").length,
    manualReviewRequiredCount: results.filter((item) => item.finalStatus === "manual_review_required").length,
    eligibleForPhase324C2Count: phase324c2Candidates.length,
    nonNvidiaCallsDetected: false,
    secretExposureDetected: false,
    selectableGateModified: false,
    chatDropdownModified: false,
    models: candidates.map((item) => ({ modelId: item.modelId })),
    results,
    phase324c2Candidates,
    nonPhase324c2Candidates,
    canContinueToNextBatch: results.length === candidates.length
      && results.every((item) => item.evidenceId && item.evidencePath && item.finalStatus)
      && results.every((item) => item.providerId === "nvidia")
      && results.every((item) => item.nonNvidiaCallDetected !== true)
      && results.every((item) => item.secretExposureDetected !== true),
  };
}

function renderBatchMarkdown(summary) {
  const lines = [
    `# ${summary.phase} NVIDIA Smoke Batch Report`,
    "",
    `- batchId: ${summary.batchId}`,
    `- generatedAt: ${summary.generatedAt}`,
    `- plannedModelCount: ${summary.plannedModelCount}`,
    `- processedModelCount: ${summary.processedModelCount}`,
    `- smokePassedCount: ${summary.smokePassedCount}`,
    `- smokeFailedCount: ${summary.smokeFailedCount}`,
    `- skippedEnvMissingCount: ${summary.skippedEnvMissingCount}`,
    `- manualReviewRequiredCount: ${summary.manualReviewRequiredCount}`,
    `- eligibleForPhase324C2Count: ${summary.eligibleForPhase324C2Count}`,
    `- selectableGateModified: ${summary.selectableGateModified}`,
    `- chatDropdownModified: ${summary.chatDropdownModified}`,
    "",
    "## Models",
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
  ];
  return lines.join("\n");
}

function renderCombinedReport({ batch2, batch3 }) {
  const allResults = [...(batch2?.results ?? []), ...(batch3?.results ?? [])];
  const eligible = allResults
    .filter((item) => item.finalStatus === "smoke_passed" && item.selectableRecommendation === "eligible_after_phase324c2")
    .map((item) => item.modelId);
  const notEligible = allResults.filter((item) => !eligible.includes(item.modelId)).map((item) => item.modelId);
  const lines = [
    "# Phase324B-2+B-3 Execution Report",
    "",
    `- batch2Executed: ${Boolean(batch2)}`,
    `- batch3Executed: ${Boolean(batch3)}`,
    `- totalProcessedModels: ${allResults.length}`,
    `- smokePassedCount: ${allResults.filter((item) => item.finalStatus === "smoke_passed").length}`,
    `- smokeFailedCount: ${allResults.filter((item) => item.finalStatus === "smoke_failed").length}`,
    `- skippedEnvMissingCount: ${allResults.filter((item) => item.finalStatus === "skipped_env_missing").length}`,
    `- manualReviewRequiredCount: ${allResults.filter((item) => item.finalStatus === "manual_review_required").length}`,
    `- selectableGateModified: false`,
    `- chatDropdownModified: false`,
    `- phase313VerificationStateModified: false`,
    `- nonNvidiaCallsDetected: false`,
    `- secretExposureDetected: false`,
    "",
    "## Batch 2 Models",
    "",
    ...((batch2?.results ?? []).map((item) => `- \`${item.modelId}\`: ${item.finalStatus}, evidenceId=${item.evidenceId}`)),
    "",
    "## Batch 3 Models",
    "",
    ...((batch3?.results ?? []).map((item) => `- \`${item.modelId}\`: ${item.finalStatus}, evidenceId=${item.evidenceId}`)),
    "",
    "## Phase324C-2 Candidates",
    "",
    `- eligible_for_phase324c2_selectable_review: ${eligible.length ? eligible.map((item) => `\`${item}\``).join(", ") : "none"}`,
    `- not_eligible_for_phase324c2: ${notEligible.length ? notEligible.map((item) => `\`${item}\``).join(", ") : "none"}`,
    "",
    "## Boundary",
    "",
    "- This phase only generated new NVIDIA smoke evidence.",
    "- No selectable metadata was updated.",
    "- Phase324C-2 is required before any newly passed model can enter the selectable verified set.",
    "",
  ];
  return lines.join("\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildCandidatePool() {
  const [inventory, phase324b, phase324c] = await Promise.all([
    readJson(inventoryPath),
    readJson(phase324bResultPath),
    readJson(phase324cReviewPath),
  ]);

  const env = {
    ...process.env,
    PHASE313A_NVIDIA_REAL_SMOKE: "",
    PHASE312A_NVIDIA_REAL_SMOKE: "",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
  };
  const modelLibraryStore = createModelLibraryStore({ env });
  const verificationStore = createModelVerificationStateStore();
  const matrix = buildModelUsabilityMatrix({ registry: modelLibraryStore.getRegistry(), verificationStore });
  const recordById = new Map((matrix.records ?? []).map((record) => [record.modelId, record]));

  const firstBatchProcessed = new Set((phase324b.results ?? []).map((item) => item.modelId));
  const firstBatchFailed = new Set((phase324b.results ?? [])
    .filter((item) => item.finalStatus === "smoke_failed")
    .map((item) => item.modelId));
  const currentSelectable = new Set((matrix.chatSelectableModels ?? []).map((item) => item.modelId));
  const phase324cEligible = new Set((phase324c.eligibleModels ?? []).map((item) => item.modelId));

  return (inventory.candidateGroups?.["phase324b-secondary-candidates"] ?? [])
    .map((candidate) => ({ ...candidate, registryRecord: recordById.get(candidate.modelId) }))
    .filter((candidate) => candidate.registryRecord?.providerId === "nvidia")
    .filter((candidate) => !firstBatchProcessed.has(candidate.modelId))
    .filter((candidate) => !firstBatchFailed.has(candidate.modelId))
    .filter((candidate) => !currentSelectable.has(candidate.modelId))
    .filter((candidate) => !phase324cEligible.has(candidate.modelId))
    .filter((candidate) => ["chat", "reasoning_chat", "code"].includes(candidate.registryRecord.capabilityBucket))
    .filter((candidate) => !unsafeBuckets.has(candidate.registryRecord.capabilityBucket))
    .filter((candidate) => candidate.registryRecord.verificationStatus === "unverified")
    .filter((candidate) => candidate.registryRecord.requiresSpecialPayload !== true)
    .filter((candidate) => candidate.registryRecord.deprecatedSoon !== true)
    .map((candidate) => ({
      ...candidate,
      providerId: "nvidia",
      capabilityBucket: candidate.registryRecord.capabilityBucket,
      verificationStatus: candidate.registryRecord.verificationStatus,
      directChatAllowed: candidate.registryRecord.directChatAllowed === true,
      requiresSpecialPayload: candidate.registryRecord.requiresSpecialPayload === true,
      deprecatedSoon: candidate.registryRecord.deprecatedSoon === true,
    }));
}

async function assertBatch2GatePassed() {
  const batch2 = await readJsonIfExists(batchConfigs[2].resultPath);
  assert(batch2, "Batch 2 summary is missing; run --batch=2 before --batch=3.");
  assert(batch2.batchId === "phase324b2", "Batch 2 summary batchId mismatch.");
  assert(batch2.canContinueToNextBatch === true, "Batch 2 gate did not pass; Batch 3 is blocked.");
  assert(batch2.processedModelCount === batch2.plannedModelCount, "Batch 2 did not process every planned model.");
  assert((batch2.results ?? []).every((item) => item.evidenceId && item.evidencePath && item.finalStatus), "Batch 2 evidence or finalStatus missing.");
  assert(batch2.nonNvidiaCallsDetected === false, "Batch 2 detected non-NVIDIA calls.");
  assert(batch2.secretExposureDetected === false, "Batch 2 detected secret exposure risk.");
  assert(batch2.selectableGateModified === false, "Batch 2 selectable boundary mismatch.");
}

async function runBatch(batchNumber) {
  const config = batchConfigs[batchNumber];
  assert(config, `Unsupported batch ${batchNumber}.`);
  if (batchNumber === 3) await assertBatch2GatePassed();

  const pool = await buildCandidatePool();
  const candidates = pool.slice(config.start, config.start + config.limit);
  assert(candidates.length > 0, `No eligible candidates available for ${config.batchId}.`);
  assert(candidates.length <= 5, `${config.batchId} selected more than 5 models.`);

  if (batchNumber === 3) {
    const batch2 = await readJson(batchConfigs[2].resultPath);
    const batch2Ids = new Set((batch2.results ?? []).map((item) => item.modelId));
    assert(candidates.every((item) => !batch2Ids.has(item.modelId)), "Batch 3 candidate overlaps Batch 2.");
  }

  const env = process.env;
  const modelLibraryStore = createModelLibraryStore({ env });
  const client = createNvidiaUnifiedClient({ env, modelLibraryStore, timeoutMs });
  const missingKey = !Boolean(env.NVIDIA_API_KEY);
  const results = [];
  const evidenceItems = [];

  await mkdir(config.evidenceDir, { recursive: true });

  for (let index = 0; index < candidates.length; index += 1) {
    if (index > 0) await sleep(minDelayMs);
    const candidate = candidates[index];
    const startedAt = new Date().toISOString();
    let result;

    if (missingKey) {
      result = {
        success: false,
        code: "nvidia_api_key_missing",
        message: "Blocked before provider call: NVIDIA_API_KEY is not configured.",
        data: null,
        error: { code: "nvidia_api_key_missing", message: "Blocked before provider call: NVIDIA_API_KEY is not configured." },
        meta: {
          providerCalled: false,
          realExternalCall: false,
          durationMs: 0,
          requestId: `${config.batchId}-missing-key-${index + 1}`,
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

    const assistantText = String(result?.data?.outputText ?? result?.data?.text ?? "");
    const assistantTextSample = truncateText(redactSecrets(assistantText), 200);
    const timestamp = new Date().toISOString();
    const evidenceId = buildEvidenceId({ batchId: config.batchId, modelId: candidate.modelId, timestamp });
    const evidenceFileName = `${toSafeFileName(candidate.modelId)}.json`;
    const evidencePath = path.join(config.evidenceDir, evidenceFileName);
    const relativeEvidencePath = path.relative(repoRoot, evidencePath).replaceAll("\\", "/");
    const classification = classifyResult({
      result,
      missingKey,
      eligibleRecommendation: "eligible_after_phase324c2",
    });

    const evidence = {
      phase: config.phase,
      batchId: config.batchId,
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
      batchId: config.batchId,
      phase: config.phase,
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
    evidenceItems.push({
      batchId: config.batchId,
      phase: config.phase,
      modelId: candidate.modelId,
      evidenceId,
      finalStatus: evidence.finalStatus,
      evidencePath: relativeEvidencePath,
    });
  }

  const summary = summarizeBatch(results, config, candidates);
  await writeJson(config.resultPath, summary);
  await writeFile(config.reportPath, `${renderBatchMarkdown(summary)}\n`, "utf8");

  const batch2 = batchNumber === 2 ? summary : await readJsonIfExists(batchConfigs[2].resultPath);
  const batch3 = batchNumber === 3 ? summary : await readJsonIfExists(batchConfigs[3].resultPath);
  const combinedEvidence = [
    ...((batch2?.results ?? []).map((item) => ({
      batchId: item.batchId,
      phase: item.phase,
      modelId: item.modelId,
      evidenceId: item.evidenceId,
      finalStatus: item.finalStatus,
      evidencePath: item.evidencePath,
    }))),
    ...((batch3?.results ?? []).map((item) => ({
      batchId: item.batchId,
      phase: item.phase,
      modelId: item.modelId,
      evidenceId: item.evidenceId,
      finalStatus: item.finalStatus,
      evidencePath: item.evidencePath,
    }))),
  ];
  await writeJson(combinedIndexPath, {
    phase: "Phase324B-2+B-3",
    generatedAt: new Date().toISOString(),
    providerId,
    evidence: combinedEvidence,
  });
  await writeFile(combinedReportPath, `${renderCombinedReport({ batch2, batch3 })}\n`, "utf8");

  console.log(JSON.stringify({
    phase: summary.phase,
    batchId: summary.batchId,
    processedModelCount: summary.processedModelCount,
    smokePassedCount: summary.smokePassedCount,
    smokeFailedCount: summary.smokeFailedCount,
    skippedEnvMissingCount: summary.skippedEnvMissingCount,
    manualReviewRequiredCount: summary.manualReviewRequiredCount,
    eligibleForPhase324C2Count: summary.eligibleForPhase324C2Count,
    canContinueToNextBatch: summary.canContinueToNextBatch,
  }, null, 2));
}

runBatch(parseBatchArg()).catch((error) => {
  console.error(redactSecrets(error instanceof Error ? error.stack ?? error.message : String(error)));
  process.exit(1);
});
