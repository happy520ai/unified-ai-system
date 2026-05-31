import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const reviewPath = path.join(repoRoot, "docs", "phase324c5-selectable-model-review.json");
const verificationStatePath = path.join(repoRoot, "apps", "ai-gateway-service", "evidence", "phase-313a-model-verification-state.json");
const updateReportPath = path.join(repoRoot, "docs", "phase324c5-model-registry-update-report.md");
const executionReportPath = path.join(repoRoot, "docs", "phase324c5-execution-report.md");

const allowedModels = [
  "google/gemma-4-31b-it",
  "meta/llama-3.2-1b-instruct",
  "meta/llama-3.2-3b-instruct",
  "meta/llama-4-maverick-17b-128e-instruct",
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
    message: "Phase324C-5 adopted Phase324B-6 reviewed smoke evidence.",
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
    lastSmokeMode: "phase324c5_review_adopted",
    lastSmokeResult: buildSmokeResultFromEvidence(evidence),
    failureCode: null,
    failureReason: null,
    providerCalled: true,
    endpointUsed: "chat_completions",
    evidenceId: evidence.evidenceId,
  };
}

function renderUpdateReport({ mode, beforeCounts, afterCounts, plans, rejectedModels }) {
  const lines = [
    "# Phase324C-5 Model Registry Update Report",
    "",
    `- mode: ${mode}`,
    `- targetFile: apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json`,
    `- beforeSelectableModels: ${beforeCounts.selectableModels}`,
    `- afterSelectableModels: ${afterCounts.selectableModels}`,
    `- beforeSmokePassedModels: ${beforeCounts.smokePassedModels}`,
    `- afterSmokePassedModels: ${afterCounts.smokePassedModels}`,
    `- addedSelectableModels: ${plans.map((item) => `\`${item.modelId}\``).join(", ") || "none"}`,
    `- rejectedModels: ${rejectedModels.map((item) => `\`${item.modelId}\``).join(", ") || "none"}`,
    `- googleGemma7bRejectedReason: phase324b6_http_410_not_eligible`,
    `- selectableGateLogicModified: false`,
    `- chatGatewayModified: false`,
    `- providerClientModified: false`,
    "",
    "## Rollback",
    "",
    "- Remove only the records added by Phase324C-5 from phase-313a-model-verification-state.json.",
    "- Do not remove the previous 12 selectable models.",
    "- Re-run verify:phase313a-model-usability-matrix.",
    "",
  ];
  return lines.join("\n");
}

function renderExecutionReport(summary) {
  const lines = [
    "# Phase324C-5 Execution Report",
    "",
    `- reviewExecuted: true`,
    `- dryRunSupported: true`,
    `- mode: ${summary.mode}`,
    `- actualAddedModels: ${summary.modelsToModify.map((item) => `\`${item.modelId}\``).join(", ") || "none"}`,
    `- rejectedModels: ${summary.modelsNotModified.map((item) => `\`${item.modelId}\``).join(", ") || "none"}`,
    `- verifierCommand: cmd /c pnpm run verify:phase313a-model-usability-matrix`,
    `- sealRecommended: true`,
    "",
    "## Boundary",
    "",
    "- C-5 only reviewed Phase324B-6 passed allowlist models.",
    "- google/gemma-7b stayed rejected.",
    "- Chat main chain, provider runtime, router runtime, and selectable gate were not modified.",
    "",
  ];
  return lines.join("\n");
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
  assert(review.phase === "Phase324C-5", "Review phase mismatch.");
  assert((review.eligible ?? []).length <= allowedModels.length, "C-5 eligible count exceeds allowlist size.");
  assert((review.eligible ?? []).every((item) => allowedModels.includes(item.modelId)), "C-5 review contains non-allowlisted eligible model.");
  assert((review.rejected ?? []).some((item) => item.modelId === "google/gemma-7b" && Number(item.httpStatus) === 410), "google/gemma-7b 410 was not rejected.");

  const plans = [];
  for (const eligible of review.eligible ?? []) {
    assert(eligible.finalStatus === "smoke_passed", `${eligible.modelId} is not smoke_passed.`);
    assert(eligible.providerCalled === true, `${eligible.modelId} providerCalled is not true.`);
    assert(eligible.completionVerified === true, `${eligible.modelId} completionVerified is not true.`);
    assert(eligible.assistantTextPresent === true, `${eligible.modelId} assistantTextPresent is not true.`);
    assert(Number(eligible.httpStatus) === 200, `${eligible.modelId} httpStatus is not 200.`);
    assert(eligible.errorCode === null || eligible.errorCode === undefined || eligible.errorCode === "", `${eligible.modelId} errorCode is present.`);
    assert(eligible.selectableRecommendation === "eligible_after_phase324c5", `${eligible.modelId} selectableRecommendation mismatch.`);

    const evidence = await readJson(path.join(repoRoot, eligible.evidencePath));
    const key = `nvidia:${eligible.modelId}`;
    const before = verificationState.records?.[key] ?? {};
    assert(before.verificationStatus !== "smoke_passed", `${eligible.modelId} is already smoke_passed/selectable.`);
    const after = buildUpdatedRecord(before, evidence);
    plans.push({ modelId: eligible.modelId, key, evidenceId: evidence.evidenceId, before, after });
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
    phase: "Phase324C-5",
    mode: dryRun ? "dry-run" : "apply",
    dryRun,
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
      noGoogleGemma7bIncluded: plans.every((item) => item.modelId !== "google/gemma-7b"),
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
  for (const plan of plans) {
    nextState.records[plan.key] = plan.after;
  }
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

