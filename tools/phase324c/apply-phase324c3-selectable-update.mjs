import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const reviewPath = path.join(repoRoot, "docs", "phase324c3-selectable-model-review.json");
const verificationStatePath = path.join(repoRoot, "apps", "ai-gateway-service", "evidence", "phase-313a-model-verification-state.json");
const updateReportPath = path.join(repoRoot, "docs", "phase324c3-model-registry-update-report.md");
const executionReportPath = path.join(repoRoot, "docs", "phase324c3-execution-report.md");

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
    message: "Phase324C-3 adopted Phase324B-4 reviewed smoke evidence.",
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
    lastSmokeMode: "phase324c3_review_adopted",
    lastSmokeResult: buildSmokeResultFromEvidence(evidence),
    failureCode: null,
    failureReason: null,
    providerCalled: true,
    endpointUsed: "chat_completions",
    evidenceId: evidence.evidenceId,
  };
}

function renderUpdateReport({ mode, targetFile, plans, rejectedModelIds }) {
  const lines = [
    "# Phase324C-3 Model Registry Update Report",
    "",
    `- mode: ${mode}`,
    `- targetFile: ${targetFile}`,
    `- modifiedModelCount: ${plans.length}`,
    `- modifiedModels: ${plans.map((item) => `\`${item.modelId}\``).join(", ")}`,
    `- rejectedModelsStayedNonSelectable: ${rejectedModelIds.map((item) => `\`${item}\``).join(", ")}`,
    `- selectableGateLogicModified: false`,
    `- chatDropdownCodeModified: false`,
    `- chatGatewayModified: false`,
    `- providerClientModified: false`,
    "",
    "## Field Summary",
    "",
    ...plans.flatMap((item) => [
      `### ${item.modelId}`,
      "",
      `- evidenceId: ${item.evidenceId}`,
      `- before.verificationStatus: ${item.before.verificationStatus ?? "missing"}`,
      `- after.verificationStatus: ${item.after.verificationStatus}`,
      `- before.evidenceId: ${item.before.evidenceId ?? "none"}`,
      `- after.evidenceId: ${item.after.evidenceId}`,
      `- before.providerCalled: ${item.before.providerCalled ?? false}`,
      `- after.providerCalled: ${item.after.providerCalled}`,
      `- before.failureCode: ${item.before.failureCode ?? "none"}`,
      `- after.failureCode: ${item.after.failureCode ?? "none"}`,
      "",
    ]),
  ];
  return lines.join("\n");
}

function renderExecutionReport(summary) {
  const lines = [
    "# Phase324C-3 Execution Report",
    "",
    `- mode: ${summary.mode}`,
    `- modifiedModelCount: ${summary.modelsToModify.length}`,
    `- modifiedModels: ${summary.modelsToModify.map((item) => `\`${item.modelId}\``).join(", ")}`,
    `- rejectedModelCount: ${summary.modelsNotModified.length}`,
    `- selectableGateModified: false`,
    `- chatGatewayModified: false`,
    `- providerClientModified: false`,
    "",
    "## Boundary",
    "",
    "- Only deepseek-ai/deepseek-v4-pro is allowed in this phase.",
    "- The four failed Phase324B-4 models remain non-selectable.",
    "- No Chat send, /chat-gateway/execute, provider client, or UI code is changed.",
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

  assert(review.evidenceMissing !== true, "Phase324C-3 review found missing evidence.");
  assert(review.evidenceModelMismatch !== true, "Phase324C-3 review found evidence/modelId mismatch.");
  assert((review.eligibleModels ?? []).length === 1, "Phase324C-3 review eligible model count is not 1.");
  assert((review.rejectedModels ?? []).length === 4, "Phase324C-3 review rejected model count is not 4.");
  assert(review.eligibleModels[0].modelId === "deepseek-ai/deepseek-v4-pro", "Phase324C-3 review contains an unexpected eligible model.");

  const eligible = review.eligibleModels[0];
  assert(eligible.providerCalled === true, "Eligible model providerCalled is not true.");
  assert(eligible.completionVerified === true, "Eligible model completionVerified is not true.");
  assert(eligible.assistantTextPresent === true, "Eligible model assistantTextPresent is not true.");
  assert(Number(eligible.httpStatus) === 200, "Eligible model httpStatus is not 200.");
  assert(String(eligible.evidenceId ?? "").trim().length > 0, "Eligible model evidenceId is empty.");

  for (const rejected of review.rejectedModels ?? []) {
    assert(rejected.modelId !== "deepseek-ai/deepseek-v4-pro", "Rejected list contains the eligible model.");
  }

  const evidence = await readJson(path.join(repoRoot, eligible.evidencePath));
  const key = `nvidia:${eligible.modelId}`;
  const before = verificationState.records?.[key] ?? null;
  const after = buildUpdatedRecord(before, evidence);
  const plans = [{
    modelId: eligible.modelId,
    key,
    evidenceId: evidence.evidenceId,
    before: before ?? {},
    after,
  }];

  assert(plans.length === 1, "Dry-run/apply plan contains more than one model.");

  const summary = {
    phase: "Phase324C-3",
    mode: dryRun ? "dry-run" : "apply",
    targetFile: sanitizePath(path.relative(repoRoot, verificationStatePath)),
    modelsToModify: plans.map((item) => ({
      modelId: item.modelId,
      evidenceId: item.evidenceId,
      beforeVerificationStatus: item.before.verificationStatus ?? "missing",
      afterVerificationStatus: item.after.verificationStatus,
    })),
    modelsNotModified: (review.rejectedModels ?? []).map((item) => ({
      modelId: item.modelId,
      reason: item.rejectionReason.join("; "),
    })),
    providerSlotsNotModified: ["openai", "claude", "openrouter", "mimo", "local"],
    productionFilesNotModified: [
      "apps/ai-gateway-service/src/chat-gateway/",
      "apps/ai-gateway-service/src/providers/nvidia/",
      "apps/ai-gateway-service/src/ui/consolePage.js",
      "apps/ai-gateway-service/src/ui/workbench/apiClient.js",
      "apps/ai-gateway-service/src/httpServer.js",
    ],
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const nextState = {
    ...verificationState,
    updatedAt: new Date().toISOString(),
    records: {
      ...(verificationState.records ?? {}),
    },
  };
  nextState.records[key] = after;

  await writeFile(verificationStatePath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  await mkdir(path.dirname(updateReportPath), { recursive: true });
  await writeFile(
    updateReportPath,
    `${renderUpdateReport({
      mode: "apply",
      targetFile: sanitizePath(path.relative(repoRoot, verificationStatePath)),
      plans,
      rejectedModelIds: (review.rejectedModels ?? []).map((item) => item.modelId),
    })}\n`,
    "utf8",
  );
  await writeFile(executionReportPath, `${renderExecutionReport(summary)}\n`, "utf8");

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

