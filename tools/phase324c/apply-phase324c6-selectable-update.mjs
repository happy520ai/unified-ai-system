import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const reviewPath = path.join(repoRoot, "docs", "phase324c6-selectable-model-review.json");
const verificationStatePath = path.join(repoRoot, "apps", "ai-gateway-service", "evidence", "phase-313a-model-verification-state.json");
const updateReportPath = path.join(repoRoot, "docs", "phase324c6-model-registry-update-report.md");
const executionReportPath = path.join(repoRoot, "docs", "phase324c6-execution-report.md");

const allowedModels = ["minimaxai/minimax-m2.7"];
const forbiddenModels = [
  "microsoft/phi-3-medium-128k-instruct",
  "microsoft/phi-4-mini-flash-reasoning",
  "microsoft/trellis",
  "minimaxai/minimax-m2.5",
  "google/gemma-7b",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function normalizePath(filePath) {
  return String(filePath).replaceAll("\\", "/");
}

function buildSmokeResultFromEvidence(evidence) {
  return {
    success: true,
    code: "nvidia_call_ok",
    message: "Phase324C-6 adopted Phase324B-7 reviewed smoke evidence.",
    httpStatus: Number(evidence.httpStatus ?? 200),
    endpointType: "chat_completions",
    providerCalled: evidence.providerCalled === true,
    modelCalled: evidence.modelId,
    realExternalCall: true,
    durationMs: Number(evidence.latencyMs ?? 0),
    outputPreview: String(evidence.assistantTextSample ?? "").slice(0, 160),
  };
}

function buildUpdatedRecord(existingRecord, evidence) {
  return {
    ...(existingRecord ?? {}),
    modelId: evidence.modelId,
    providerId: "nvidia",
    verificationStatus: "smoke_passed",
    lastVerifiedAt: evidence.createdAt,
    lastSmokeMode: "phase324c6_review_adopted",
    lastSmokeResult: buildSmokeResultFromEvidence(evidence),
    failureCode: null,
    failureReason: null,
    providerCalled: true,
    endpointUsed: "chat_completions",
    evidenceId: evidence.evidenceId,
  };
}

function renderUpdateReport({ mode, beforeCounts, afterCounts, plans, rejectedModels }) {
  return [
    "# Phase324C-6 Model Registry Update Report",
    "",
    `- mode: ${mode}`,
    "- targetFile: apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json",
    `- beforeSelectableModels: ${beforeCounts.selectableModels}`,
    `- afterSelectableModels: ${afterCounts.selectableModels}`,
    `- beforeSmokePassedModels: ${beforeCounts.smokePassedModels}`,
    `- afterSmokePassedModels: ${afterCounts.smokePassedModels}`,
    `- addedSelectableModels: ${plans.map((item) => `\`${item.modelId}\``).join(", ") || "none"}`,
    `- rejectedModels: ${rejectedModels.map((item) => `\`${item.modelId}\``).join(", ") || "none"}`,
    "- b7FailedModelsRejected:",
    ...rejectedModels.filter((item) => item.modelId !== "google/gemma-7b").map((item) => `  - ${item.modelId}: ${item.decisionReason}`),
    "- selectableGateLogicModified: false",
    "- chatGatewayModified: false",
    "- providerClientModified: false",
    "",
    "## Rollback",
    "",
    "- Remove only `nvidia:minimaxai/minimax-m2.7` if it was added by Phase324C-6.",
    "- Do not remove the previous 16 selectable models.",
    "- Re-run verify:phase313a-model-usability-matrix.",
    "",
  ].join("\n");
}

function renderExecutionReport(summary) {
  return [
    "# Phase324C-6 Execution Report",
    "",
    "- reviewExecuted: true",
    "- dryRunSupported: true",
    `- mode: ${summary.mode}`,
    `- actualAddedModels: ${summary.modelsToModify.map((item) => `\`${item.modelId}\``).join(", ") || "none"}`,
    `- rejectedModels: ${summary.modelsNotModified.map((item) => `\`${item.modelId}\``).join(", ") || "none"}`,
    "- verifierCommand: cmd /c pnpm run verify:phase313a-model-usability-matrix",
    `- sealRecommended: ${summary.applyExecuted && summary.modelsToModify.length === 1}`,
    "",
    "## Boundary",
    "",
    "- C-6 only reviewed Phase324B-7 passed allowlist model.",
    "- B-7 failed models stayed rejected.",
    "- Chat main chain, provider runtime, router runtime, and selectable gate were not modified.",
    "",
  ].join("\n");
}

function countSmokePassed(records) {
  return Object.values(records ?? {}).filter((record) => record?.verificationStatus === "smoke_passed").length;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const apply = args.has("--apply");
  assert(dryRun !== apply, "Use exactly one of --dry-run or --apply.");

  const review = await readJson(reviewPath);
  const verificationState = await readJson(verificationStatePath);
  assert(review.phase === "Phase324C-6", "Review phase mismatch.");
  assert((review.eligible ?? []).length <= allowedModels.length, "C-6 eligible count exceeds allowlist size.");
  assert((review.eligible ?? []).every((item) => allowedModels.includes(item.modelId)), "C-6 review contains non-allowlisted eligible model.");
  assert(!(review.eligible ?? []).some((item) => forbiddenModels.includes(item.modelId)), "C-6 eligible contains forbidden model.");
  assert(forbiddenModels.every((modelId) => (review.rejected ?? []).some((item) => item.modelId === modelId)), "C-6 forbidden model rejection coverage is incomplete.");

  const plans = [];
  for (const eligible of review.eligible ?? []) {
    assert(eligible.modelId === "minimaxai/minimax-m2.7", "C-6 may only apply minimaxai/minimax-m2.7.");
    assert(eligible.finalStatus === "smoke_passed", `${eligible.modelId} is not smoke_passed.`);
    assert(eligible.providerCalled === true, `${eligible.modelId} providerCalled is not true.`);
    assert(eligible.completionVerified === true, `${eligible.modelId} completionVerified is not true.`);
    assert(eligible.assistantTextPresent === true, `${eligible.modelId} assistantTextPresent is not true.`);
    assert(Number(eligible.httpStatus) === 200, `${eligible.modelId} httpStatus is not 200.`);
    assert(eligible.errorCode === null || eligible.errorCode === undefined || eligible.errorCode === "", `${eligible.modelId} errorCode is present.`);
    assert(eligible.selectableRecommendation === "eligible_after_phase324c6", `${eligible.modelId} selectableRecommendation mismatch.`);

    const evidence = await readJson(path.join(repoRoot, eligible.evidencePath));
    const key = `nvidia:${eligible.modelId}`;
    const before = verificationState.records?.[key] ?? {};
    assert(before.verificationStatus !== "smoke_passed", `${eligible.modelId} is already smoke_passed/selectable.`);
    plans.push({ modelId: eligible.modelId, key, evidenceId: evidence.evidenceId, before, after: buildUpdatedRecord(before, evidence) });
  }

  const beforeCounts = {
    selectableModels: review.summary.previousSelectableModels,
    smokePassedModels: review.summary.previousSmokePassedModels,
  };
  const afterCounts = {
    selectableModels: beforeCounts.selectableModels + plans.length,
    smokePassedModels: beforeCounts.smokePassedModels + plans.length,
  };
  const summary = {
    phase: "Phase324C-6",
    mode: dryRun ? "dry-run" : "apply",
    dryRun,
    applyExecuted: apply,
    targetFile: normalizePath(path.relative(repoRoot, verificationStatePath)),
    beforeCounts,
    afterCounts,
    modelsToModify: plans.map((item) => ({
      modelId: item.modelId,
      evidenceId: item.evidenceId,
      beforeVerificationStatus: item.before.verificationStatus ?? "missing",
      afterVerificationStatus: item.after.verificationStatus,
    })),
    modelsNotModified: (review.rejected ?? []).map((item) => ({
      modelId: item.modelId,
      reason: item.decisionReason,
    })),
    safety: {
      noB7FailedModelIncluded: plans.every((item) => !forbiddenModels.includes(item.modelId)),
      onlyAllowlistIncluded: plans.every((item) => allowedModels.includes(item.modelId)),
      noChatMainChainTouched: true,
      noSelectableGateTouched: true,
    },
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const nextState = {
    ...verificationState,
    updatedAt: new Date().toISOString(),
    records: { ...(verificationState.records ?? {}) },
  };
  for (const plan of plans) nextState.records[plan.key] = plan.after;
  assert(countSmokePassed(nextState.records) >= countSmokePassed(verificationState.records), "Smoke passed record count unexpectedly decreased.");

  await writeFile(verificationStatePath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  await mkdir(path.dirname(updateReportPath), { recursive: true });
  await writeFile(updateReportPath, `${renderUpdateReport({ mode: "apply", beforeCounts, afterCounts, plans, rejectedModels: review.rejected ?? [] })}\n`, "utf8");
  await writeFile(executionReportPath, `${renderExecutionReport(summary)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
