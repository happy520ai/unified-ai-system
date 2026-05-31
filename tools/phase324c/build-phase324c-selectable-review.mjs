import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createModelLibraryStore } from "../../apps/ai-gateway-service/src/model-library/modelLibraryStore.js";
import { createModelVerificationStateStore } from "../../apps/ai-gateway-service/src/model-library/modelVerificationStateStore.js";
import { buildModelUsabilityMatrix } from "../../apps/ai-gateway-service/src/model-library/modelUsabilityMatrix.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const batchResultPath = path.join(repoRoot, "docs", "phase324b-nvidia-smoke-batch-result.json");
const evidenceIndexPath = path.join(repoRoot, "docs", "phase324b-model-smoke-evidence-index.json");
const inventoryPath = path.join(repoRoot, "docs", "phase324a-nvidia-model-candidate-inventory.json");
const outputJsonPath = path.join(repoRoot, "docs", "phase324c-selectable-model-review.json");
const outputMdPath = path.join(repoRoot, "docs", "phase324c-selectable-model-review.md");

const eligibleModelIds = [
  "nvidia/nemotron-3-super-120b-a12b",
  "nvidia/nemotron-mini-4b-instruct",
];

const rejectedModelIds = [
  "nvidia/llama-3.3-nemotron-super-49b-v1.5",
  "nvidia/nemotron-3-nano-30b-a3b",
  "nvidia/nvidia-nemotron-nano-9b-v2",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
  const lines = [
    "# Phase324C Selectable Model Review",
    "",
    `- generatedAt: ${review.generatedAt}`,
    `- eligibleModelCount: ${review.eligibleModels.length}`,
    `- rejectedModelCount: ${review.rejectedModels.length}`,
    `- evidenceMissing: ${review.evidenceMissing}`,
    `- evidenceModelMismatch: ${review.evidenceModelMismatch}`,
    "",
    "## eligibleModels",
    "",
    ...review.eligibleModels.flatMap((item) => [
      `### ${item.modelId}`,
      "",
      `- evidenceId: ${item.evidenceId}`,
      `- evidencePath: ${item.evidencePath}`,
      `- finalStatus: ${item.finalStatus}`,
      `- providerCalled: ${item.providerCalled}`,
      `- completionVerified: ${item.completionVerified}`,
      `- assistantTextPresent: ${item.assistantTextPresent}`,
      `- capabilityBucket: ${item.capabilityBucket}`,
      `- updatePlan: verificationStatus=smoke_passed; evidenceId=${item.evidenceId}; providerCalled=true; failureCode=null; failureReason=null`,
      "",
    ]),
    "## rejectedModels",
    "",
    ...review.rejectedModels.flatMap((item) => [
      `### ${item.modelId}`,
      "",
      `- evidenceId: ${item.evidenceId}`,
      `- finalStatus: ${item.finalStatus}`,
      `- providerCalled: ${item.providerCalled}`,
      `- completionVerified: ${item.completionVerified}`,
      `- assistantTextPresent: ${item.assistantTextPresent}`,
      `- rejectionReason: ${item.rejectionReason.join("; ")}`,
      "",
    ]),
    "## selectable update plan",
    "",
    "- 只更新 2 个 eligible NVIDIA 模型在 `phase-313a-model-verification-state.json` 中的 verified metadata。",
    "- 写入字段：`verificationStatus`、`lastVerifiedAt`、`lastSmokeMode`、`lastSmokeResult`、`failureCode`、`failureReason`、`providerCalled`、`endpointUsed`、`evidenceId`。",
    "- 不修改 3 个 rejected models。",
    "- 不修改 selectable gate 逻辑，不修改 Chat Gateway，不修改 provider client。",
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

  assert(JSON.stringify(batchResult.phase324CCandidates ?? []) === JSON.stringify(eligibleModelIds), "Phase324B eligible candidate set mismatch.");
  assert(JSON.stringify(batchResult.nonPhase324CCandidates ?? []) === JSON.stringify(rejectedModelIds), "Phase324B rejected candidate set mismatch.");
  assert((inventory.candidateGroups?.["phase324b-priority-candidates"] ?? []).length === 5, "Phase324A priority candidate source mismatch.");

  const eligibleModels = [];
  const rejectedModels = [];
  let evidenceMissing = false;
  let evidenceModelMismatch = false;

  for (const modelId of eligibleModelIds) {
    const indexed = evidenceIndexByModelId.get(modelId);
    const batch = batchResultByModelId.get(modelId);
    const record = byModelId.get(modelId);
    assert(indexed, `Missing evidence index entry for eligible model ${modelId}.`);
    assert(batch, `Missing batch result entry for eligible model ${modelId}.`);
    assert(record, `Missing registry record for eligible model ${modelId}.`);
    const evidence = await readEvidence(indexed.evidencePath);
    evidenceMissing = evidenceMissing || !indexed.evidencePath;
    evidenceModelMismatch = evidenceModelMismatch || evidence.data.modelId !== modelId;

    assert(evidence.data.providerId === "nvidia", `Eligible model ${modelId} is not NVIDIA in evidence.`);
    assert(evidence.data.finalStatus === "smoke_passed", `Eligible model ${modelId} evidence finalStatus is not smoke_passed.`);
    assert(evidence.data.providerCalled === true, `Eligible model ${modelId} evidence providerCalled is not true.`);
    assert(evidence.data.completionVerified === true, `Eligible model ${modelId} evidence completionVerified is not true.`);
    assert(evidence.data.assistantTextPresent === true, `Eligible model ${modelId} evidence assistantTextPresent is not true.`);
    assert(String(evidence.data.evidenceId ?? "").trim().length > 0, `Eligible model ${modelId} evidenceId is empty.`);
    assert(record.providerId === "nvidia", `Eligible model ${modelId} provider is not NVIDIA in registry.`);
    assert(record.capabilityBucket === "chat" || record.capabilityBucket === "reasoning_chat" || record.capabilityBucket === "code", `Eligible model ${modelId} capabilityBucket is not selectable.`);
    assert(record.verificationStatus !== "deprecated" && record.verificationStatus !== "blocked" && record.verificationStatus !== "manual_review_required", `Eligible model ${modelId} has blocked verification status.`);
    assert(record.requiresSpecialPayload !== true, `Eligible model ${modelId} requires special payload.`);

    eligibleModels.push({
      modelId,
      evidenceId: evidence.data.evidenceId,
      evidencePath: evidence.repoRelativePath,
      finalStatus: evidence.data.finalStatus,
      providerCalled: evidence.data.providerCalled,
      completionVerified: evidence.data.completionVerified,
      assistantTextPresent: evidence.data.assistantTextPresent,
      capabilityBucket: record.capabilityBucket,
      currentVerificationStatus: record.verificationStatus,
      currentSelectable: record.selectable,
    });
  }

  for (const modelId of rejectedModelIds) {
    const indexed = evidenceIndexByModelId.get(modelId);
    const batch = batchResultByModelId.get(modelId);
    const record = byModelId.get(modelId);
    assert(indexed, `Missing evidence index entry for rejected model ${modelId}.`);
    assert(batch, `Missing batch result entry for rejected model ${modelId}.`);
    assert(record, `Missing registry record for rejected model ${modelId}.`);
    const evidence = await readEvidence(indexed.evidencePath);
    evidenceMissing = evidenceMissing || !indexed.evidencePath;
    evidenceModelMismatch = evidenceModelMismatch || evidence.data.modelId !== modelId;

    assert(evidence.data.finalStatus === "smoke_failed", `Rejected model ${modelId} evidence finalStatus is not smoke_failed.`);

    rejectedModels.push({
      modelId,
      evidenceId: evidence.data.evidenceId,
      evidencePath: evidence.repoRelativePath,
      finalStatus: evidence.data.finalStatus,
      providerCalled: evidence.data.providerCalled,
      completionVerified: evidence.data.completionVerified,
      assistantTextPresent: evidence.data.assistantTextPresent,
      rejectionReason: [
        "completionVerified=false",
        "assistantTextPresent=false",
        "not eligible for selectable",
      ],
      currentVerificationStatus: record.verificationStatus,
      currentSelectable: record.selectable,
    });
  }

  const review = {
    phase: "Phase324C",
    generatedAt: new Date().toISOString(),
    sourceFiles: [
      sanitizePath(path.relative(repoRoot, batchResultPath)),
      sanitizePath(path.relative(repoRoot, evidenceIndexPath)),
      ...eligibleModels.map((item) => item.evidencePath),
      ...rejectedModels.map((item) => item.evidencePath),
      sanitizePath(path.relative(repoRoot, path.join(repoRoot, "apps/ai-gateway-service/src/model-library"))),
      sanitizePath(path.relative(repoRoot, inventoryPath)),
    ],
    eligibleModels,
    rejectedModels,
    evidenceMissing,
    evidenceModelMismatch,
    selectableUpdatePlan: {
      targetFile: "apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json",
      eligibleModelIds,
      rejectedModelIds,
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
