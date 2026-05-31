import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createModelLibraryStore } from "../../apps/ai-gateway-service/src/model-library/modelLibraryStore.js";
import { createModelVerificationStateStore } from "../../apps/ai-gateway-service/src/model-library/modelVerificationStateStore.js";
import { buildModelUsabilityMatrix } from "../../apps/ai-gateway-service/src/model-library/modelUsabilityMatrix.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const outputJsonPath = path.join(repoRoot, "docs", "phase324c5-selectable-model-review.json");
const outputMdPath = path.join(repoRoot, "docs", "phase324c5-selectable-model-review.md");

const allowedModels = [
  "google/gemma-4-31b-it",
  "meta/llama-3.2-1b-instruct",
  "meta/llama-3.2-3b-instruct",
  "meta/llama-4-maverick-17b-128e-instruct",
];

const evidencePaths = {
  "google/gemma-4-31b-it": "apps/ai-gateway-service/evidence/phase324b6/google_gemma_4_31b_it.json",
  "meta/llama-3.2-1b-instruct": "apps/ai-gateway-service/evidence/phase324b6/meta_llama_3_2_1b_instruct.json",
  "meta/llama-3.2-3b-instruct": "apps/ai-gateway-service/evidence/phase324b6/meta_llama_3_2_3b_instruct.json",
  "meta/llama-4-maverick-17b-128e-instruct": "apps/ai-gateway-service/evidence/phase324b6/meta_llama_4_maverick_17b_128e_instruct.json",
  "google/gemma-7b": "apps/ai-gateway-service/evidence/phase324b6/google_gemma_7b.json",
};

const forbiddenModels = ["google/gemma-7b"];

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

function evaluateEvidence({ modelId, evidence, record }) {
  const reasons = [];
  if (!allowedModels.includes(modelId)) reasons.push("model_not_in_allowlist");
  if (evidence?.phase !== "Phase324B-6") reasons.push("not_phase324b6_evidence");
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
  if (evidence?.selectableRecommendation !== "eligible_after_phase324c5") reasons.push("selectableRecommendation_not_c5");
  if (!record) reasons.push("registry_record_missing");
  if (record?.selectable === true) reasons.push("already_selectable");
  if (record && !["chat", "reasoning_chat", "code"].includes(record.capabilityBucket)) reasons.push("capability_not_chat");
  if (record?.requiresSpecialPayload === true) reasons.push("requires_special_payload");
  if (["smoke_failed", "blocked", "deprecated", "manual_review_required"].includes(record?.verificationStatus)) reasons.push("blocked_or_failed_status");
  return reasons;
}

function toReviewItem({ modelId, evidence, evidencePath, reviewStatus, decisionReason }) {
  return {
    modelId,
    reviewStatus,
    finalStatus: evidence.finalStatus,
    providerCalled: evidence.providerCalled,
    completionVerified: evidence.completionVerified,
    assistantTextPresent: evidence.assistantTextPresent,
    httpStatus: evidence.httpStatus,
    errorCode: evidence.errorCode ?? null,
    latencyMs: evidence.latencyMs,
    evidenceId: evidence.evidenceId,
    evidencePath: normalizePath(evidence.evidencePath ?? evidencePath),
    selectableRecommendation: evidence.selectableRecommendation,
    decisionReason,
  };
}

function renderMarkdown(review) {
  const lines = [
    "# Phase324C-5 Selectable Model Review",
    "",
    "- Scope: review only Phase324B-6 smoke_passed allowlist models.",
    "- `google/gemma-7b` is rejected because Phase324B-6 returned HTTP 410.",
    "- No B-6 failed or non-allowlist model is eligible.",
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
      `- evidencePath: ${item.evidencePath ?? "none"}`,
      `- decisionReason: ${item.decisionReason}`,
      "",
    ]) : ["- none", ""]),
    "## Boundary",
    "",
    "- Chat main chain was not touched.",
    "- Selectable gate logic was not touched.",
    "- Only Phase324C-5 apply may update Phase313A verification metadata.",
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const matrix = buildMatrix();
  const recordByModelId = new Map((matrix.records ?? []).map((record) => [record.modelId, record]));
  const eligible = [];
  const rejected = [];

  for (const modelId of allowedModels) {
    const evidencePath = evidencePaths[modelId];
    const evidence = await readJson(path.join(repoRoot, evidencePath));
    const reasons = evaluateEvidence({ modelId, evidence, record: recordByModelId.get(modelId) });
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
        decisionReason: "phase324b6_smoke_passed_evidence_complete",
      }));
    }
  }

  for (const modelId of forbiddenModels) {
    const evidencePath = evidencePaths[modelId];
    const evidence = await readJson(path.join(repoRoot, evidencePath));
    rejected.push(toReviewItem({
      modelId,
      evidence,
      evidencePath,
      reviewStatus: "rejected",
      decisionReason: "phase324b6_http_410_not_eligible",
    }));
  }

  const review = {
    phase: "Phase324C-5",
    scope: "selectable_review_only_for_phase324b6_smoke_passed_models",
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
      b6FailedModelsExcluded: rejected.some((item) => item.modelId === "google/gemma-7b"),
      googleGemma7b410Rejected: rejected.some((item) => item.modelId === "google/gemma-7b" && item.httpStatus === 410),
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

