import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createModelLibraryStore } from "../../apps/ai-gateway-service/src/model-library/modelLibraryStore.js";
import { createModelVerificationStateStore } from "../../apps/ai-gateway-service/src/model-library/modelVerificationStateStore.js";
import { buildModelUsabilityMatrix } from "../../apps/ai-gateway-service/src/model-library/modelUsabilityMatrix.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const batch2ResultPath = path.join(repoRoot, "docs", "phase324b2-nvidia-smoke-batch-result.json");
const batch3ResultPath = path.join(repoRoot, "docs", "phase324b3-nvidia-smoke-batch-result.json");
const evidenceIndexPath = path.join(repoRoot, "docs", "phase324b2-b3-model-smoke-evidence-index.json");
const inventoryPath = path.join(repoRoot, "docs", "phase324a-nvidia-model-candidate-inventory.json");
const outputJsonPath = path.join(repoRoot, "docs", "phase324c2-selectable-model-review.json");
const outputMdPath = path.join(repoRoot, "docs", "phase324c2-selectable-model-review.md");

const eligibleModelIds = [
  "abacusai/dracarys-llama-3.1-70b-instruct",
  "meta/llama-3.1-70b-instruct",
  "meta/llama-3.1-8b-instruct",
  "meta/llama-3.3-70b-instruct",
  "microsoft/phi-4-mini-instruct",
];

const rejectedModelIds = [
  "meta/llama2-70b",
  "meta/llama3-8b",
  "microsoft/phi-3-mini-4k-instruct",
  "mistralai/mistral-7b-instruct",
  "mistralai/mistral-7b-instruct-v0.3",
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
  const lines = [
    "# Phase324C-2 Selectable Model Review",
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
      `- updatePlan: verificationStatus=smoke_passed; evidenceId=${item.evidenceId}; providerCalled=true; endpointUsed=chat_completions; failureCode=null; failureReason=null`,
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
      `- httpStatus: ${item.httpStatus ?? "n/a"}`,
      `- rejectionReason: ${item.rejectionReason.join("; ")}`,
      "",
    ]),
    "## selectable update plan",
    "",
    "- 只更新 5 个 eligible provider-slot 模型在 `phase-313a-model-verification-state.json` 中的 verified metadata。",
    "- 写入字段：`verificationStatus`、`lastVerifiedAt`、`lastSmokeMode`、`lastSmokeResult`、`failureCode`、`failureReason`、`providerCalled`、`endpointUsed`、`evidenceId`。",
    "- 5 个 rejected models 维持不可选。",
    "- 不修改 selectable gate 逻辑，不修改 Chat Gateway，不修改 provider client。",
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const [batch2, batch3, evidenceIndex, inventory] = await Promise.all([
    readJson(batch2ResultPath),
    readJson(batch3ResultPath),
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
  const batchResults = [...(batch2.results ?? []), ...(batch3.results ?? [])];
  const batchResultByModelId = new Map(batchResults.map((item) => [item.modelId, item]));

  assert((inventory.candidateGroups?.["phase324b-secondary-candidates"] ?? []).length >= 10, "Phase324A secondary candidate source is smaller than expected.");

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

    assert(evidence.data.finalStatus === "smoke_passed", `Eligible model ${modelId} finalStatus is not smoke_passed.`);
    assert(evidence.data.providerCalled === true, `Eligible model ${modelId} providerCalled is not true.`);
    assert(evidence.data.completionVerified === true, `Eligible model ${modelId} completionVerified is not true.`);
    assert(evidence.data.assistantTextPresent === true, `Eligible model ${modelId} assistantTextPresent is not true.`);
    assert(String(evidence.data.evidenceId ?? "").trim().length > 0, `Eligible model ${modelId} evidenceId is empty.`);
    assert(record.providerId === "nvidia", `Eligible model ${modelId} is not in NVIDIA provider slot.`);
    assert(["chat", "reasoning_chat", "code"].includes(record.capabilityBucket), `Eligible model ${modelId} capability bucket is not selectable.`);
    assert(record.requiresSpecialPayload !== true, `Eligible model ${modelId} requires special payload.`);
    assert(!["deprecated", "blocked", "manual_review_required"].includes(record.verificationStatus), `Eligible model ${modelId} has blocked verification status.`);

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

    assert(evidence.data.finalStatus === "smoke_failed", `Rejected model ${modelId} finalStatus is not smoke_failed.`);

    rejectedModels.push({
      modelId,
      evidenceId: evidence.data.evidenceId,
      evidencePath: evidence.repoRelativePath,
      finalStatus: evidence.data.finalStatus,
      providerCalled: evidence.data.providerCalled,
      completionVerified: evidence.data.completionVerified,
      assistantTextPresent: evidence.data.assistantTextPresent,
      httpStatus: evidence.data.httpStatus ?? null,
      rejectionReason: [
        evidence.data.httpStatus === 404 || evidence.data.httpStatus === 410 ? `httpStatus=${evidence.data.httpStatus}` : "completionVerified=false",
        "assistantTextPresent=false",
        "not eligible for selectable",
      ],
      currentVerificationStatus: record.verificationStatus,
      currentSelectable: record.selectable,
    });
  }

  const review = {
    phase: "Phase324C-2",
    generatedAt: new Date().toISOString(),
    sourceFiles: [
      sanitizePath(path.relative(repoRoot, batch2ResultPath)),
      sanitizePath(path.relative(repoRoot, batch3ResultPath)),
      sanitizePath(path.relative(repoRoot, evidenceIndexPath)),
      ...eligibleModels.map((item) => item.evidencePath),
      ...rejectedModels.map((item) => item.evidencePath),
      sanitizePath(path.relative(repoRoot, path.join(repoRoot, "apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json"))),
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
