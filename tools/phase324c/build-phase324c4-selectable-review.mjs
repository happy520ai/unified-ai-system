import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createModelLibraryStore } from "../../apps/ai-gateway-service/src/model-library/modelLibraryStore.js";
import { createModelVerificationStateStore } from "../../apps/ai-gateway-service/src/model-library/modelVerificationStateStore.js";
import { buildModelUsabilityMatrix } from "../../apps/ai-gateway-service/src/model-library/modelUsabilityMatrix.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const batchResultPath = path.join(repoRoot, "docs", "phase324b5-nvidia-smoke-batch-result.json");
const evidenceIndexPath = path.join(repoRoot, "docs", "phase324b5-model-smoke-evidence-index.json");
const outputJsonPath = path.join(repoRoot, "docs", "phase324c4-selectable-model-review.json");
const outputMdPath = path.join(repoRoot, "docs", "phase324c4-selectable-model-review.md");

const allowedModels = [
  "google/gemma-3n-e2b-it",
  "google/gemma-3n-e4b-it",
];

const forbiddenModels = [
  "google/codegemma-7b",
  "google/gemma-2-2b-it",
  "google/gemma-3-27b-it",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function sanitizePath(filePath) {
  return String(filePath).replaceAll("\\", "/");
}

async function readEvidence(repoRelativePath) {
  const absolutePath = path.join(repoRoot, repoRelativePath);
  return {
    absolutePath,
    repoRelativePath: sanitizePath(repoRelativePath),
    data: await readJson(absolutePath),
  };
}

function evaluateEligible({ modelId, evidence, record }) {
  const reasons = [];
  if (!allowedModels.includes(modelId)) reasons.push("model_not_in_allowlist");
  if (!evidence?.evidenceId) reasons.push("evidenceId_missing");
  if (evidence?.phase !== "Phase324B-5") reasons.push("not_phase324b5_evidence");
  if ((evidence?.providerId ?? evidence?.provider) !== "nvidia") reasons.push("not_nvidia_provider");
  if (evidence?.providerCalled !== true) reasons.push("providerCalled_not_true");
  if (evidence?.finalStatus !== "smoke_passed") reasons.push("finalStatus_not_smoke_passed");
  if (evidence?.completionVerified !== true) reasons.push("completionVerified_not_true");
  if (evidence?.assistantTextPresent !== true) reasons.push("assistantTextPresent_not_true");
  if (Number(evidence?.httpStatus) !== 200) reasons.push("httpStatus_not_200");
  if (evidence?.errorCode !== null && evidence?.errorCode !== undefined && evidence?.errorCode !== "") reasons.push("errorCode_present");
  if (!Number.isFinite(Number(evidence?.latencyMs))) reasons.push("latencyMs_invalid");
  if (evidence?.selectableRecommendation !== "eligible_after_phase324c4") reasons.push("selectableRecommendation_not_c4");
  if (!record) reasons.push("registry_record_missing");
  if (record && !["chat", "reasoning_chat", "code"].includes(record.capabilityBucket)) reasons.push("capability_not_chat");
  if (record?.requiresSpecialPayload === true) reasons.push("requires_special_payload");
  if (["deprecated", "blocked", "manual_review_required"].includes(record?.verificationStatus)) reasons.push("blocked_status");
  if (record?.selectable === true) reasons.push("already_selectable");
  return reasons;
}

function renderMarkdown(review) {
  const lines = [
    "# Phase324C-4 Selectable Model Review",
    "",
    "- Scope: review only Phase324B-5 smoke_passed models.",
    "- B-5 failed models are not eligible.",
    "- B-6 outputs are excluded from this phase.",
    "",
    `- previousSelectableModels: ${review.summary.previousSelectableModels}`,
    `- plannedSelectableModels: ${review.summary.plannedSelectableModels}`,
    `- previousSmokePassedModels: ${review.summary.previousSmokePassedModels}`,
    `- plannedSmokePassedModels: ${review.summary.plannedSmokePassedModels}`,
    "",
    "## Eligible",
    "",
    ...(review.eligible.length ? review.eligible.flatMap((item) => [
      `### ${item.modelId}`,
      "",
      `- evidenceId: ${item.evidenceId}`,
      `- evidencePath: ${item.evidencePath}`,
      `- latencyMs: ${item.latencyMs}`,
      `- selectableRecommendation: ${item.selectableRecommendation}`,
      `- decisionReason: ${item.decisionReason}`,
      "",
    ]) : ["- none", ""]),
    "## Rejected",
    "",
    ...(review.rejected.length ? review.rejected.flatMap((item) => [
      `### ${item.modelId}`,
      "",
      `- evidenceId: ${item.evidenceId ?? "none"}`,
      `- evidencePath: ${item.evidencePath ?? "none"}`,
      `- finalStatus: ${item.finalStatus ?? "unknown"}`,
      `- httpStatus: ${item.httpStatus ?? "n/a"}`,
      `- errorCode: ${item.errorCode ?? "none"}`,
      `- decisionReason: ${item.decisionReason}`,
      "",
    ]) : ["- none", ""]),
    "## Boundary",
    "",
    "- No B-6 result is reviewed.",
    "- No failed B-5 model is selectable.",
    "- No selectable gate, Chat Gateway, provider client, or UI code is touched.",
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const [batchResult, evidenceIndex] = await Promise.all([
    readJson(batchResultPath),
    readJson(evidenceIndexPath),
  ]);

  const matrix = buildModelUsabilityMatrix({
    registry: createModelLibraryStore({
      env: {
        ...process.env,
        PHASE313A_NVIDIA_REAL_SMOKE: "",
        PHASE312A_NVIDIA_REAL_SMOKE: "",
        PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
      },
    }).getRegistry(),
    verificationStore: createModelVerificationStateStore(),
  });
  const recordByModelId = new Map((matrix.records ?? []).map((record) => [record.modelId, record]));
  const evidenceByModelId = new Map((evidenceIndex.evidence ?? []).map((item) => [item.modelId, item]));
  const batchByModelId = new Map((batchResult.results ?? []).map((item) => [item.modelId, item]));

  assert((batchResult.phase324c4Candidates ?? []).length === 2, "Phase324B-5 c4 candidate count mismatch.");
  assert(allowedModels.every((modelId) => (batchResult.phase324c4Candidates ?? []).includes(modelId)), "Phase324B-5 c4 candidate allowlist mismatch.");

  const eligible = [];
  const rejected = [];

  for (const modelId of allowedModels) {
    const indexed = evidenceByModelId.get(modelId);
    const batch = batchByModelId.get(modelId);
    const record = recordByModelId.get(modelId);
    assert(indexed, `Missing evidence index for ${modelId}.`);
    assert(batch, `Missing batch result for ${modelId}.`);
    const evidence = await readEvidence(indexed.evidencePath);
    const reasons = evaluateEligible({ modelId, evidence: evidence.data, record });
    const item = {
      modelId,
      reviewStatus: reasons.length ? "rejected" : "eligible",
      finalStatus: evidence.data.finalStatus,
      providerCalled: evidence.data.providerCalled,
      completionVerified: evidence.data.completionVerified,
      assistantTextPresent: evidence.data.assistantTextPresent,
      httpStatus: evidence.data.httpStatus,
      errorCode: evidence.data.errorCode,
      latencyMs: evidence.data.latencyMs,
      evidenceId: evidence.data.evidenceId,
      evidencePath: evidence.repoRelativePath,
      selectableRecommendation: evidence.data.selectableRecommendation,
      decisionReason: reasons.length ? reasons.join("; ") : "phase324b5_smoke_passed_evidence_complete",
    };
    if (reasons.length) rejected.push(item);
    else eligible.push(item);
  }

  for (const modelId of forbiddenModels) {
    const indexed = evidenceByModelId.get(modelId);
    const batch = batchByModelId.get(modelId);
    const evidence = indexed ? await readEvidence(indexed.evidencePath) : { repoRelativePath: null, data: batch ?? {} };
    rejected.push({
      modelId,
      reviewStatus: "rejected",
      finalStatus: evidence.data.finalStatus ?? batch?.finalStatus ?? "unknown",
      providerCalled: evidence.data.providerCalled ?? batch?.providerCalled ?? null,
      completionVerified: evidence.data.completionVerified ?? batch?.completionVerified ?? null,
      assistantTextPresent: evidence.data.assistantTextPresent ?? batch?.assistantTextPresent ?? null,
      httpStatus: evidence.data.httpStatus ?? batch?.httpStatus ?? null,
      errorCode: evidence.data.errorCode ?? batch?.errorCode ?? null,
      latencyMs: evidence.data.latencyMs ?? batch?.latencyMs ?? null,
      evidenceId: evidence.data.evidenceId ?? batch?.evidenceId ?? null,
      evidencePath: evidence.repoRelativePath ?? batch?.evidencePath ?? null,
      selectableRecommendation: evidence.data.selectableRecommendation ?? batch?.selectableRecommendation ?? "not_eligible",
      decisionReason: "phase324b5_failed_model_forbidden",
    });
  }

  const review = {
    phase: "Phase324C-4",
    scope: "selectable_review_only_for_phase324b5_smoke_passed_models",
    generatedAt: new Date().toISOString(),
    allowedModels,
    forbiddenModels,
    eligible,
    rejected,
    summary: {
      eligibleCount: eligible.length,
      rejectedCount: rejected.length,
      previousSelectableModels: matrix.summary.selectableModels,
      plannedSelectableModels: matrix.summary.selectableModels + eligible.length,
      previousSmokePassedModels: matrix.summary.smokePassedModels,
      plannedSmokePassedModels: matrix.summary.smokePassedModels + eligible.length,
    },
    safety: {
      onlyAllowedModelsReviewed: eligible.every((item) => allowedModels.includes(item.modelId)),
      b5FailedModelsExcluded: forbiddenModels.every((modelId) => rejected.some((item) => item.modelId === modelId)),
      b6ResultsExcluded: true,
      noChatMainChainTouched: true,
      noSelectableGateTouched: true,
    },
  };

  await mkdir(path.dirname(outputJsonPath), { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  await writeFile(outputMdPath, `${renderMarkdown(review)}\n`, "utf8");

  console.log(JSON.stringify({
    phase: review.phase,
    eligibleCount: review.summary.eligibleCount,
    rejectedCount: review.summary.rejectedCount,
    plannedSelectableModels: review.summary.plannedSelectableModels,
    plannedSmokePassedModels: review.summary.plannedSmokePassedModels,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

