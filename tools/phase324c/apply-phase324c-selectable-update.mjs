import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const reviewPath = path.join(repoRoot, "docs", "phase324c-selectable-model-review.json");
const verificationStatePath = path.join(repoRoot, "apps", "ai-gateway-service", "evidence", "phase-313a-model-verification-state.json");
const updateReportPath = path.join(repoRoot, "docs", "phase324c-model-registry-update-report.md");

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

function buildSmokeResultFromEvidence(evidence) {
  return {
    success: true,
    code: "nvidia_call_ok",
    message: "Phase324C adopted Phase324B reviewed smoke evidence.",
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
    lastSmokeMode: "phase324b_review_adopted",
    lastSmokeResult: buildSmokeResultFromEvidence(evidence),
    failureCode: null,
    failureReason: null,
    providerCalled: true,
    endpointUsed: "chat_completions",
    evidenceId: evidence.evidenceId,
  };
}

function renderReport({ mode, verificationStateRelativePath, plans, rejectedModelIds }) {
  const lines = [
    "# Phase324C Model Registry Update Report",
    "",
    `- mode: ${mode}`,
    `- targetFile: ${verificationStateRelativePath}`,
    `- modifiedModelCount: ${plans.length}`,
    `- modifiedModels: ${plans.map((item) => `\`${item.modelId}\``).join(", ")}`,
    `- rejectedModelsStayedNonSelectable: ${rejectedModelIds.map((item) => `\`${item}\``).join(", ")}`,
    `- selectableGateLogicModified: false`,
    `- chatDropdownCodeModified: false`,
    `- chatGatewayModified: false`,
    `- providerClientModified: false`,
    "",
    "## 修改前后字段摘要",
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

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const apply = args.has("--apply");
  assert(dryRun !== apply, "Use exactly one of --dry-run or --apply.");

  const review = await readJson(reviewPath);
  const verificationState = await readJson(verificationStatePath);

  assert(review.evidenceMissing !== true, "Phase324C review found missing evidence.");
  assert(review.evidenceModelMismatch !== true, "Phase324C review found evidence/modelId mismatch.");
  assert((review.eligibleModels ?? []).length === 2, "Phase324C review eligible model count is not 2.");
  assert((review.rejectedModels ?? []).length === 3, "Phase324C review rejected model count is not 3.");

  const plans = [];
  for (const eligible of review.eligibleModels ?? []) {
    assert(eligible.providerCalled === true, `Eligible model ${eligible.modelId} providerCalled is not true.`);
    assert(eligible.completionVerified === true, `Eligible model ${eligible.modelId} completionVerified is not true.`);
    assert(eligible.assistantTextPresent === true, `Eligible model ${eligible.modelId} assistantTextPresent is not true.`);
    assert(String(eligible.evidenceId ?? "").trim().length > 0, `Eligible model ${eligible.modelId} evidenceId is empty.`);

    const evidence = await readJson(path.join(repoRoot, eligible.evidencePath));
    const key = `nvidia:${eligible.modelId}`;
    const before = verificationState.records?.[key] ?? null;
    const after = buildUpdatedRecord(before, evidence);
    plans.push({
      modelId: eligible.modelId,
      key,
      evidenceId: evidence.evidenceId,
      before: before ?? {},
      after,
    });
  }

  assert(plans.length === 2, "Dry-run/apply plan contains more than 2 models.");

  const summary = {
    phase: "Phase324C",
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
      reason: "smoke_failed remains non-selectable",
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

  for (const plan of plans) {
    nextState.records[plan.key] = plan.after;
  }

  await writeFile(verificationStatePath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  await mkdir(path.dirname(updateReportPath), { recursive: true });
  await writeFile(
    updateReportPath,
    `${renderReport({
      mode: "apply",
      verificationStateRelativePath: sanitizePath(path.relative(repoRoot, verificationStatePath)),
      plans,
      rejectedModelIds: (review.rejectedModels ?? []).map((item) => item.modelId),
    })}\n`,
    "utf8",
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
