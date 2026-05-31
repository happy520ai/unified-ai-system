import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createModelLibraryStore } from "../../apps/ai-gateway-service/src/model-library/modelLibraryStore.js";
import { createModelVerificationStateStore } from "../../apps/ai-gateway-service/src/model-library/modelVerificationStateStore.js";
import { buildModelUsabilityMatrix } from "../../apps/ai-gateway-service/src/model-library/modelUsabilityMatrix.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const outputJsonPath = path.join(repoRoot, "docs", "phase324c6-selectable-model-review.json");
const outputMdPath = path.join(repoRoot, "docs", "phase324c6-selectable-model-review.md");

const allowedModels = ["minimaxai/minimax-m2.7"];
const forbiddenModels = [
  "microsoft/phi-3-medium-128k-instruct",
  "microsoft/phi-4-mini-flash-reasoning",
  "microsoft/trellis",
  "minimaxai/minimax-m2.5",
  "google/gemma-7b",
];

const evidencePaths = {
  "minimaxai/minimax-m2.7": "apps/ai-gateway-service/evidence/phase324b7/minimaxai_minimax_m2_7.json",
  "microsoft/phi-3-medium-128k-instruct": "apps/ai-gateway-service/evidence/phase324b7/microsoft_phi_3_medium_128k_instruct.json",
  "microsoft/phi-4-mini-flash-reasoning": "apps/ai-gateway-service/evidence/phase324b7/microsoft_phi_4_mini_flash_reasoning.json",
  "microsoft/trellis": "apps/ai-gateway-service/evidence/phase324b7/microsoft_trellis.json",
  "minimaxai/minimax-m2.5": "apps/ai-gateway-service/evidence/phase324b7/minimaxai_minimax_m2_5.json",
};

const fixedRejectReasons = {
  "microsoft/phi-3-medium-128k-instruct": "phase324b7_http_410_not_eligible",
  "microsoft/phi-4-mini-flash-reasoning": "phase324b7_http_410_not_eligible",
  "microsoft/trellis": "phase324b7_http_404_not_eligible",
  "minimaxai/minimax-m2.5": "phase324b7_timeout_not_eligible",
  "google/gemma-7b": "phase324b6_http_410_not_eligible",
};

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function normalizePath(filePath) {
  return String(filePath).replaceAll("\\", "/");
}

function buildMatrix() {
  return buildModelUsabilityMatrix({
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
}

function failedSetsFromPhase324H(report) {
  const highRisk = new Set();
  const failed = new Set();
  for (const item of report?.reviewQueues?.highRiskHttp410 ?? []) highRisk.add(item.modelId);
  for (const item of report?.reviewQueues?.highRiskTimeout ?? []) highRisk.add(item.modelId);
  for (const item of report?.reviewQueues?.notRecommendedRetry ?? []) failed.add(item.modelId);
  return { highRisk, failed };
}

function evaluateEvidence({ modelId, evidence, record, highRisk, failed }) {
  const reasons = [];
  if (!allowedModels.includes(modelId)) reasons.push("model_not_in_allowlist");
  if (evidence?.modelId !== modelId) reasons.push("modelId_mismatch");
  if (evidence?.phase !== "Phase324B-7") reasons.push("not_phase324b7_evidence");
  if ((evidence?.provider ?? evidence?.providerId) !== "nvidia") reasons.push("not_nvidia_provider");
  if (evidence?.providerCalled !== true) reasons.push("providerCalled_not_true");
  if (evidence?.finalStatus !== "smoke_passed") reasons.push("finalStatus_not_smoke_passed");
  if (evidence?.completionVerified !== true) reasons.push("completionVerified_not_true");
  if (evidence?.assistantTextPresent !== true) reasons.push("assistantTextPresent_not_true");
  if (Number(evidence?.httpStatus) !== 200) reasons.push("httpStatus_not_200");
  if (evidence?.errorCode !== null && evidence?.errorCode !== undefined && evidence?.errorCode !== "") reasons.push("errorCode_present");
  if (!Number.isFinite(Number(evidence?.latencyMs))) reasons.push("latencyMs_invalid");
  if (!evidence?.evidenceId) reasons.push("evidenceId_missing");
  if (!evidence?.evidencePath && !evidencePaths[modelId]) reasons.push("evidencePath_missing");
  if (evidence?.selectableRecommendation !== "eligible_after_phase324c6") reasons.push("selectableRecommendation_not_c6");
  if (!record) reasons.push("registry_record_missing");
  if (record?.selectable === true) reasons.push("already_selectable");
  if (record && !["chat", "reasoning_chat", "code"].includes(record.capabilityBucket)) reasons.push("capability_not_chat");
  if (record?.requiresSpecialPayload === true) reasons.push("requires_special_payload");
  if (["smoke_failed", "blocked", "deprecated", "manual_review_required"].includes(record?.verificationStatus)) reasons.push("blocked_or_failed_status");
  if (failed.has(modelId)) reasons.push("phase324h_failed_queue");
  if (highRisk.has(modelId)) reasons.push("phase324h_high_risk_queue");
  return reasons;
}

function toReviewItem({ modelId, evidence, evidencePath, reviewStatus, decisionReason }) {
  return {
    modelId,
    reviewStatus,
    finalStatus: evidence?.finalStatus ?? "missing",
    providerCalled: evidence?.providerCalled ?? false,
    completionVerified: evidence?.completionVerified ?? false,
    assistantTextPresent: evidence?.assistantTextPresent ?? false,
    httpStatus: evidence?.httpStatus ?? null,
    errorCode: evidence?.errorCode ?? null,
    latencyMs: evidence?.latencyMs ?? null,
    evidenceId: evidence?.evidenceId ?? null,
    evidencePath: normalizePath(evidence?.evidencePath ?? evidencePath ?? ""),
    selectableRecommendation: evidence?.selectableRecommendation ?? "not_eligible",
    decisionReason,
  };
}

function renderMarkdown(review) {
  return [
    "# Phase324C-6 Selectable Model Review",
    "",
    "- Scope: review only Phase324B-7 smoke_passed allowlist model.",
    "- Allowed model: `minimaxai/minimax-m2.7`.",
    "- B-7 failed models stay rejected and are not added to selectable.",
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
      `- finalStatus: ${item.finalStatus}`,
      `- httpStatus: ${item.httpStatus ?? "n/a"}`,
      `- errorCode: ${item.errorCode ?? "none"}`,
      `- evidenceId: ${item.evidenceId ?? "none"}`,
      `- evidencePath: ${item.evidencePath || "none"}`,
      `- decisionReason: ${item.decisionReason}`,
      "",
    ]) : ["- none", ""]),
    "## Boundary",
    "",
    "- Chat main chain was not touched.",
    "- Selectable gate logic was not touched.",
    "- Only Phase324C-6 apply may update Phase313A verification metadata.",
    "",
  ].join("\n");
}

async function main() {
  const matrix = buildMatrix();
  const hReport = await readJson(path.join(repoRoot, "docs", "phase324h-model-library-stability-latency-capability-report.json"));
  const { highRisk, failed } = failedSetsFromPhase324H(hReport);
  const recordByModelId = new Map((matrix.records ?? []).map((record) => [record.modelId, record]));
  const eligible = [];
  const rejected = [];

  for (const modelId of allowedModels) {
    const evidencePath = evidencePaths[modelId];
    const evidence = await readJson(path.join(repoRoot, evidencePath));
    const reasons = evaluateEvidence({ modelId, evidence, record: recordByModelId.get(modelId), highRisk, failed });
    if (reasons.length) {
      rejected.push(toReviewItem({
        modelId,
        evidence,
        evidencePath,
        reviewStatus: "rejected",
        decisionReason: reasons.join("; "),
      }));
    } else {
      eligible.push(toReviewItem({
        modelId,
        evidence,
        evidencePath,
        reviewStatus: "eligible",
        decisionReason: "phase324b7_smoke_passed_evidence_complete",
      }));
    }
  }

  for (const modelId of forbiddenModels) {
    if (modelId === "google/gemma-7b") {
      rejected.push(toReviewItem({
        modelId,
        evidence: {
          modelId,
          finalStatus: "smoke_failed",
          httpStatus: 410,
          errorCode: "nvidia_http_error",
          selectableRecommendation: "not_eligible",
        },
        evidencePath: "apps/ai-gateway-service/evidence/phase324b6/google_gemma_7b.json",
        reviewStatus: "rejected",
        decisionReason: fixedRejectReasons[modelId],
      }));
      continue;
    }
    const evidencePath = evidencePaths[modelId];
    const evidence = await readJson(path.join(repoRoot, evidencePath));
    rejected.push(toReviewItem({
      modelId,
      evidence,
      evidencePath,
      reviewStatus: "rejected",
      decisionReason: fixedRejectReasons[modelId],
    }));
  }

  const review = {
    phase: "Phase324C-6",
    scope: "selectable_review_only_for_phase324b7_smoke_passed_models",
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
      b7FailedModelsExcluded: ["microsoft/phi-3-medium-128k-instruct", "microsoft/phi-4-mini-flash-reasoning", "microsoft/trellis", "minimaxai/minimax-m2.5"].every((modelId) => rejected.some((item) => item.modelId === modelId)),
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
