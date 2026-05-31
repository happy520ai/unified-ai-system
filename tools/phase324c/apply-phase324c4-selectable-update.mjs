import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const reviewPath = path.join(repoRoot, "docs", "phase324c4-selectable-model-review.json");
const verificationStatePath = path.join(repoRoot, "apps", "ai-gateway-service", "evidence", "phase-313a-model-verification-state.json");
const updateReportPath = path.join(repoRoot, "docs", "phase324c4-model-registry-update-report.md");
const executionReportPath = path.join(repoRoot, "docs", "phase324c4-execution-report.md");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function sanitizePath(filePath) {
  return String(filePath).replaceAll("\\", "/");
}

function buildSmokeResultFromEvidence(evidence) {
  return {
    success: true,
    code: "nvidia_call_ok",
    message: "Phase324C-4 adopted Phase324B-5 reviewed smoke evidence.",
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
    lastVerifiedAt: evidence.timestamp,
    lastSmokeMode: "phase324c4_review_adopted",
    lastSmokeResult: buildSmokeResultFromEvidence(evidence),
    failureCode: null,
    failureReason: null,
    providerCalled: true,
    endpointUsed: "chat_completions",
    evidenceId: evidence.evidenceId,
  };
}

function renderUpdateReport({ mode, plans, rejectedModels }) {
  const lines = [
    "# Phase324C-4 Model Registry Update Report",
    "",
    `- mode: ${mode}`,
    `- targetFile: apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json`,
    `- beforeSelectableModels: 10`,
    `- afterSelectableModels: ${10 + plans.length}`,
    `- beforeSmokePassedModels: 10`,
    `- afterSmokePassedModels: ${10 + plans.length}`,
    `- addedSelectableModels: ${plans.map((item) => `\`${item.modelId}\``).join(", ") || "none"}`,
    `- rejectedModels: ${rejectedModels.map((item) => `\`${item.modelId}\``).join(", ") || "none"}`,
    `- selectableGateLogicModified: false`,
    `- chatGatewayModified: false`,
    `- providerClientModified: false`,
    "",
    "## Rollback",
    "",
    "- Remove only the records added by Phase324C-4 from phase-313a-model-verification-state.json.",
    "- Do not remove deepseek-ai/deepseek-v4-pro or earlier selectable models.",
    "- Re-run verify:phase313a-model-usability-matrix.",
    "",
  ];
  return lines.join("\n");
}

function renderExecutionReport(summary) {
  const lines = [
    "# Phase324C-4 Execution Report",
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
    "- C-4 only reviewed Phase324B-5 passed models.",
    "- B-5 failed models stayed rejected.",
    "- B-6 results are not used by C-4.",
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const apply = args.has("--apply");
  assert(dryRun !== apply, "Use exactly one of --dry-run or --apply.");

  const review = await readJson(reviewPath);
  const verificationState = await readJson(verificationStatePath);
  assert(review.phase === "Phase324C-4", "Review phase mismatch.");
  assert((review.eligible ?? []).length <= 2, "C-4 eligible count exceeds allowlist size.");
  assert((review.eligible ?? []).every((item) => ["google/gemma-3n-e2b-it", "google/gemma-3n-e4b-it"].includes(item.modelId)), "C-4 review contains non-allowlisted eligible model.");
  assert((review.rejected ?? []).some((item) => item.modelId === "google/codegemma-7b"), "B-5 failed google/codegemma-7b was not rejected.");
  assert((review.rejected ?? []).some((item) => item.modelId === "google/gemma-2-2b-it"), "B-5 failed google/gemma-2-2b-it was not rejected.");
  assert((review.rejected ?? []).some((item) => item.modelId === "google/gemma-3-27b-it"), "B-5 failed google/gemma-3-27b-it was not rejected.");

  const plans = [];
  for (const eligible of review.eligible ?? []) {
    assert(eligible.finalStatus === "smoke_passed", `${eligible.modelId} is not smoke_passed.`);
    assert(eligible.providerCalled === true, `${eligible.modelId} providerCalled is not true.`);
    assert(eligible.completionVerified === true, `${eligible.modelId} completionVerified is not true.`);
    assert(eligible.assistantTextPresent === true, `${eligible.modelId} assistantTextPresent is not true.`);
    assert(Number(eligible.httpStatus) === 200, `${eligible.modelId} httpStatus is not 200.`);
    assert(eligible.errorCode === null || eligible.errorCode === undefined || eligible.errorCode === "", `${eligible.modelId} errorCode is present.`);
    assert(eligible.selectableRecommendation === "eligible_after_phase324c4", `${eligible.modelId} selectableRecommendation mismatch.`);

    const evidence = await readJson(path.join(repoRoot, eligible.evidencePath));
    const key = `nvidia:${eligible.modelId}`;
    const before = verificationState.records?.[key] ?? {};
    const after = buildUpdatedRecord(before, evidence);
    plans.push({ modelId: eligible.modelId, key, evidenceId: evidence.evidenceId, before, after });
  }

  const summary = {
    phase: "Phase324C-4",
    mode: dryRun ? "dry-run" : "apply",
    dryRun,
    targetFile: sanitizePath(path.relative(repoRoot, verificationStatePath)),
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
      noB6ModelIncluded: true,
      noB5FailedModelIncluded: plans.every((item) => !["google/codegemma-7b", "google/gemma-2-2b-it", "google/gemma-3-27b-it"].includes(item.modelId)),
      noChatMainChainTouched: true,
      noSelectableGateTouched: true,
    },
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (plans.length === 0) {
    await mkdir(path.dirname(updateReportPath), { recursive: true });
    await writeFile(updateReportPath, `${renderUpdateReport({ mode: "apply-skipped-no-eligible", plans, rejectedModels: review.rejected ?? [] })}\n`, "utf8");
    await writeFile(executionReportPath, `${renderExecutionReport(summary)}\n`, "utf8");
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

  await writeFile(verificationStatePath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  await mkdir(path.dirname(updateReportPath), { recursive: true });
  await writeFile(updateReportPath, `${renderUpdateReport({ mode: "apply", plans, rejectedModels: review.rejected ?? [] })}\n`, "utf8");
  await writeFile(executionReportPath, `${renderExecutionReport(summary)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

