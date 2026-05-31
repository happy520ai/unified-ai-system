import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createModelLibraryStore } from "../../apps/ai-gateway-service/src/model-library/modelLibraryStore.js";
import { createModelVerificationStateStore } from "../../apps/ai-gateway-service/src/model-library/modelVerificationStateStore.js";
import { buildModelUsabilityMatrix } from "../../apps/ai-gateway-service/src/model-library/modelUsabilityMatrix.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const batchResultPath = path.join(repoRoot, "docs", "phase324b4-nvidia-smoke-batch-result.json");
const evidenceIndexPath = path.join(repoRoot, "docs", "phase324b4-model-smoke-evidence-index.json");
const inventoryPath = path.join(repoRoot, "docs", "phase324a-nvidia-model-candidate-inventory.json");
const outputJsonPath = path.join(repoRoot, "docs", "phase324c3-selectable-model-review.json");
const outputMdPath = path.join(repoRoot, "docs", "phase324c3-selectable-model-review.md");

const eligibleModelId = "deepseek-ai/deepseek-v4-pro";
const expectedEvidenceId = "phase324b4-deepseek_ai_deepseek_v4_pro-20260506151431";
const rejectedModels = [
  {
    modelId: "bytedance/seed-oss-36b-instruct",
    expectedReason: ["completionVerified=false", "assistantTextPresent=false"],
  },
  {
    modelId: "deepseek-ai/deepseek-v3.1-terminus",
    expectedReason: ["httpStatus=410"],
  },
  {
    modelId: "deepseek-ai/deepseek-v3.2",
    expectedReason: ["httpStatus=410"],
  },
  {
    modelId: "deepseek-ai/deepseek-v4-flash",
    expectedReason: ["nvidia_request_timeout"],
  },
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

function renderMarkdown(review) {
  const eligible = review.eligibleModels[0];
  const lines = [
    "# Phase324C-3 Selectable Model Review",
    "",
    `- generatedAt: ${review.generatedAt}`,
    `- eligibleModelCount: ${review.eligibleModels.length}`,
    `- rejectedModelCount: ${review.rejectedModels.length}`,
    `- evidenceMissing: ${review.evidenceMissing}`,
    `- evidenceModelMismatch: ${review.evidenceModelMismatch}`,
    "",
    "## Eligible Model",
    "",
    `### ${eligible.modelId}`,
    "",
    `- evidenceId: ${eligible.evidenceId}`,
    `- evidencePath: ${eligible.evidencePath}`,
    `- finalStatus: ${eligible.finalStatus}`,
    `- providerCalled: ${eligible.providerCalled}`,
    `- completionVerified: ${eligible.completionVerified}`,
    `- assistantTextPresent: ${eligible.assistantTextPresent}`,
    `- httpStatus: ${eligible.httpStatus}`,
    `- capabilityBucket: ${eligible.capabilityBucket}`,
    `- requiresSpecialPayload: ${eligible.requiresSpecialPayload}`,
    `- updatePlan: verificationStatus=smoke_passed; evidenceId=${eligible.evidenceId}; providerCalled=true; endpointUsed=chat_completions; failureCode=null; failureReason=null`,
    "",
    "## Rejected Models",
    "",
    ...review.rejectedModels.flatMap((item) => [
      `### ${item.modelId}`,
      "",
      `- evidenceId: ${item.evidenceId}`,
      `- finalStatus: ${item.finalStatus}`,
      `- providerCalled: ${item.providerCalled}`,
      `- completionVerified: ${item.completionVerified}`,
      `- assistantTextPresent: ${item.assistantTextPresent}`,
      `- httpStatus: ${item.httpStatus ?? "n/a"}`,
      `- errorCode: ${item.errorCode ?? "none"}`,
      `- rejectionReason: ${item.rejectionReason.join("; ")}`,
      "",
    ]),
    "## Selectable Update Plan",
    "",
    "- Only `deepseek-ai/deepseek-v4-pro` will be updated in `phase-313a-model-verification-state.json`.",
    "- The four failed Phase324B-4 models stay non-selectable.",
    "- No selectable gate logic, Chat Gateway code, provider client, or UI code is modified.",
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const [batchResult, evidenceIndex, inventory] = await Promise.all([
    readJson(batchResultPath),
    readJson(evidenceIndexPath),
    readJson(inventoryPath),
  ]);

  const env = {
    ...process.env,
    PHASE313A_NVIDIA_REAL_SMOKE: "",
    PHASE312A_NVIDIA_REAL_SMOKE: "",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
  };
  const modelLibraryStore = createModelLibraryStore({ env });
  const verificationStore = createModelVerificationStateStore();
  const matrix = buildModelUsabilityMatrix({
    registry: modelLibraryStore.getRegistry(),
    verificationStore,
  });
  const byModelId = new Map((matrix.records ?? []).map((record) => [record.modelId, record]));
  const evidenceIndexByModelId = new Map((evidenceIndex.evidence ?? []).map((item) => [item.modelId, item]));
  const batchResultByModelId = new Map((batchResult.results ?? []).map((item) => [item.modelId, item]));

  assert((batchResult.phase324c3Candidates ?? []).length === 1, "Phase324B-4 candidate set size mismatch.");
  assert(batchResult.phase324c3Candidates[0] === eligibleModelId, "Phase324B-4 eligible candidate mismatch.");
  assert((batchResult.nonPhase324c3Candidates ?? []).length === 4, "Phase324B-4 rejected candidate count mismatch.");
  assert((inventory.candidateGroups?.["phase324b-secondary-candidates"] ?? []).length >= 10, "Phase324A secondary candidate source is smaller than expected.");

  const indexedEligible = evidenceIndexByModelId.get(eligibleModelId);
  const batchEligible = batchResultByModelId.get(eligibleModelId);
  const recordEligible = byModelId.get(eligibleModelId);
  assert(indexedEligible, `Missing evidence index entry for eligible model ${eligibleModelId}.`);
  assert(batchEligible, `Missing batch result entry for eligible model ${eligibleModelId}.`);
  assert(recordEligible, `Missing registry record for eligible model ${eligibleModelId}.`);

  const eligibleEvidence = await readEvidence(indexedEligible.evidencePath);
  assert(eligibleEvidence.data.modelId === eligibleModelId, "Eligible evidence/modelId mismatch.");
  assert(eligibleEvidence.data.evidenceId === expectedEvidenceId, "Eligible evidenceId mismatch.");
  assert(eligibleEvidence.data.finalStatus === "smoke_passed", "Eligible model finalStatus is not smoke_passed.");
  assert(eligibleEvidence.data.providerCalled === true, "Eligible model providerCalled is not true.");
  assert(eligibleEvidence.data.completionVerified === true, "Eligible model completionVerified is not true.");
  assert(eligibleEvidence.data.assistantTextPresent === true, "Eligible model assistantTextPresent is not true.");
  assert(Number(eligibleEvidence.data.httpStatus) === 200, "Eligible model httpStatus is not 200.");
  assert(["chat", "reasoning_chat", "code"].includes(recordEligible.capabilityBucket), "Eligible model capability bucket is not selectable.");
  assert(recordEligible.requiresSpecialPayload !== true, "Eligible model requires special payload.");
  assert(!["deprecated", "blocked", "manual_review_required"].includes(recordEligible.verificationStatus), "Eligible model verification status is blocked.");

  const eligibleModels = [{
    modelId: eligibleModelId,
    evidenceId: eligibleEvidence.data.evidenceId,
    evidencePath: eligibleEvidence.repoRelativePath,
    finalStatus: eligibleEvidence.data.finalStatus,
    providerCalled: eligibleEvidence.data.providerCalled,
    completionVerified: eligibleEvidence.data.completionVerified,
    assistantTextPresent: eligibleEvidence.data.assistantTextPresent,
    httpStatus: eligibleEvidence.data.httpStatus,
    capabilityBucket: recordEligible.capabilityBucket,
    requiresSpecialPayload: recordEligible.requiresSpecialPayload === true,
    currentVerificationStatus: recordEligible.verificationStatus,
    currentSelectable: recordEligible.selectable,
  }];

  const rejectedReview = [];
  let evidenceMissing = false;
  let evidenceModelMismatch = false;

  for (const rejected of rejectedModels) {
    const indexed = evidenceIndexByModelId.get(rejected.modelId);
    const batch = batchResultByModelId.get(rejected.modelId);
    const record = byModelId.get(rejected.modelId);
    assert(indexed, `Missing evidence index entry for rejected model ${rejected.modelId}.`);
    assert(batch, `Missing batch result entry for rejected model ${rejected.modelId}.`);
    assert(record, `Missing registry record for rejected model ${rejected.modelId}.`);
    const evidence = await readEvidence(indexed.evidencePath);
    evidenceMissing = evidenceMissing || !indexed.evidencePath;
    evidenceModelMismatch = evidenceModelMismatch || evidence.data.modelId !== rejected.modelId;

    assert(evidence.data.finalStatus === "smoke_failed", `Rejected model ${rejected.modelId} finalStatus is not smoke_failed.`);

    const rejectionReason = [];
    if (evidence.data.completionVerified === false) rejectionReason.push("completionVerified=false");
    if (evidence.data.assistantTextPresent === false) rejectionReason.push("assistantTextPresent=false");
    if (Number(evidence.data.httpStatus ?? 0) === 410) rejectionReason.push("httpStatus=410");
    if (String(evidence.data.errorCode ?? "") === "nvidia_request_timeout") rejectionReason.push("nvidia_request_timeout");
    if (rejectionReason.length === 0) rejectionReason.push("not eligible for selectable");

    rejectedReview.push({
      modelId: rejected.modelId,
      evidenceId: evidence.data.evidenceId,
      evidencePath: evidence.repoRelativePath,
      finalStatus: evidence.data.finalStatus,
      providerCalled: evidence.data.providerCalled,
      completionVerified: evidence.data.completionVerified,
      assistantTextPresent: evidence.data.assistantTextPresent,
      httpStatus: evidence.data.httpStatus ?? null,
      errorCode: evidence.data.errorCode ?? null,
      rejectionReason,
      currentVerificationStatus: record.verificationStatus,
      currentSelectable: record.selectable,
    });
  }

  const review = {
    phase: "Phase324C-3",
    generatedAt: new Date().toISOString(),
    sourceFiles: [
      sanitizePath(path.relative(repoRoot, batchResultPath)),
      sanitizePath(path.relative(repoRoot, evidenceIndexPath)),
      eligibleEvidence.repoRelativePath,
      ...rejectedReview.map((item) => item.evidencePath),
      sanitizePath(path.relative(repoRoot, path.join(repoRoot, "apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json"))),
      sanitizePath(path.relative(repoRoot, path.join(repoRoot, "apps/ai-gateway-service/src/model-library"))),
      sanitizePath(path.relative(repoRoot, inventoryPath)),
    ],
    eligibleModels,
    rejectedModels: rejectedReview,
    evidenceMissing,
    evidenceModelMismatch,
    selectableUpdatePlan: {
      targetFile: "apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json",
      eligibleModelIds: [eligibleModelId],
      rejectedModelIds: rejectedModels.map((item) => item.modelId),
      fieldsToUpdate: [
        "verificationStatus",
        "lastVerifiedAt",
        "lastSmokeMode",
        "lastSmokeResult",
        "failureCode",
        "failureReason",
        "providerCalled",
        "endpointUsed",
        "evidenceId",
      ],
      noChangesTo: [
        "apps/ai-gateway-service/src/chat-gateway/",
        "apps/ai-gateway-service/src/providers/nvidia/",
        "apps/ai-gateway-service/src/ui/consolePage.js",
        "apps/ai-gateway-service/src/ui/workbench/apiClient.js",
        "apps/ai-gateway-service/src/httpServer.js",
      ],
    },
  };

  await mkdir(path.dirname(outputJsonPath), { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  await writeFile(outputMdPath, `${renderMarkdown(review)}\n`, "utf8");

  console.log(JSON.stringify({
    phase: review.phase,
    eligibleModelCount: review.eligibleModels.length,
    rejectedModelCount: review.rejectedModels.length,
    evidenceMissing: review.evidenceMissing,
    evidenceModelMismatch: review.evidenceModelMismatch,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

