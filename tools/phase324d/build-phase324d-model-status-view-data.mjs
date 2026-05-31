import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildModelUsabilityMatrix } from "../../apps/ai-gateway-service/src/model-library/modelUsabilityMatrix.js";
import { buildUnifiedModelRegistry } from "../../apps/ai-gateway-service/src/model-library/unifiedModelRegistry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const INPUTS = {
  usabilityMatrix: "apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json",
  verificationState: "apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json",
  phase324bIndex: "docs/phase324b-model-smoke-evidence-index.json",
  phase324b2b3Index: "docs/phase324b2-b3-model-smoke-evidence-index.json",
  phase324cReview: "docs/phase324c-selectable-model-review.json",
  phase324c2Review: "docs/phase324c2-selectable-model-review.json",
  phase324cReport: "docs/phase324c-execution-report.md",
  phase324c2Report: "docs/phase324c2-execution-report.md",
  modelLibraryState: "apps/ai-gateway-service/evidence/phase-312a-model-library-state.json",
};

const OUTPUT_JSON = "docs/phase324d-model-status-view-data.json";
const OUTPUT_MD = "docs/phase324d-model-status-view-data.md";

const FAILED_STATUSES = new Set([
  "smoke_failed",
  "blocked",
  "wrong_endpoint",
  "rate_limited",
  "not_supported",
  "manual_review_required",
]);

function readJson(relativePath, fallback = null) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return fallback;
  return JSON.parse(readFileSync(absolutePath, "utf8"));
}

function readTextPresence(relativePath) {
  return existsSync(resolve(repoRoot, relativePath));
}

function redactShort(value, fallback = null) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/\b(nvapi|sk|pk|ak|sk-proj)[A-Za-z0-9._-]{8,}\b/gi, "[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret|key)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 180);
}

function indexEvidence(...sources) {
  const byModelId = new Map();
  for (const source of sources) {
    for (const item of source?.evidence ?? []) {
      if (!item?.modelId) continue;
      byModelId.set(item.modelId, {
        evidenceId: item.evidenceId ?? null,
        evidencePath: item.evidencePath ?? null,
        finalStatus: item.finalStatus ?? null,
        evidencePhase: item.phase ?? source.phase ?? evidencePhaseFromId(item.evidenceId),
        batchId: item.batchId ?? null,
      });
    }
  }
  return byModelId;
}

function indexReviewModels(...reviews) {
  const byModelId = new Map();
  for (const review of reviews) {
    for (const item of [...(review?.eligibleModels ?? []), ...(review?.rejectedModels ?? [])]) {
      if (!item?.modelId) continue;
      byModelId.set(item.modelId, {
        evidenceId: item.evidenceId ?? null,
        evidencePath: item.evidencePath ?? null,
        finalStatus: item.finalStatus ?? null,
        providerCalled: item.providerCalled === true,
        completionVerified: item.completionVerified === true,
        assistantTextPresent: item.assistantTextPresent === true,
        httpStatus: item.httpStatus ?? null,
        rejectionReason: Array.isArray(item.rejectionReason) ? item.rejectionReason.join("; ") : item.rejectionReason ?? null,
        evidencePhase: evidencePhaseFromId(item.evidenceId),
      });
    }
  }
  return byModelId;
}

function evidencePhaseFromId(evidenceId) {
  const id = String(evidenceId ?? "");
  if (id.startsWith("phase324b3-")) return "Phase324B-3";
  if (id.startsWith("phase324b2-")) return "Phase324B-2";
  if (id.startsWith("phase324b-")) return "Phase324B";
  if (id.startsWith("phase-313a-")) return "Phase313A";
  return null;
}

function inferBadge(record) {
  if (record.selectable === true && record.verificationStatus === "smoke_passed") return "selectable";
  if (record.verificationStatus === "smoke_passed") return "smoke_passed";
  if (record.verificationStatus === "deprecated") return "deprecated";
  if (record.verificationStatus === "blocked") return "blocked";
  if (!record.evidenceId && record.verificationStatus !== "unverified") return "missing_evidence";
  if (record.verificationStatus === "smoke_failed") return "smoke_failed";
  return "unverified";
}

function inferSeverity(record) {
  if (record.selectable === true && record.verificationStatus === "smoke_passed") return "ok";
  if (record.verificationStatus === "smoke_failed" || FAILED_STATUSES.has(record.verificationStatus)) return "error";
  if (record.verificationStatus === "deprecated" || record.verificationStatus === "unverified") return "muted";
  return "warning";
}

function nonSelectableReason(record, reviewInfo) {
  if (record.selectable === true) return null;
  if (record.verificationStatus === "smoke_failed") return redactShort(reviewInfo?.rejectionReason || record.failureReason, "failed verification");
  if (!record.evidenceId && record.verificationStatus !== "unverified") return "missing evidenceId";
  if (record.verificationStatus === "unverified") return "unverified; no valid smoke evidence";
  if (record.verificationStatus === "deprecated") return "deprecated";
  if (record.requiresSpecialPayload === true) return "requires special payload";
  if (record.directChatAllowed !== true) return "capability not direct chat";
  return record.selectableReason || "not eligible for selectable";
}

function buildRows({ records, persistedRecords, evidenceByModel, reviewByModel }) {
  return records.map((record) => {
    const persisted = persistedRecords[`${record.providerId}:${record.modelId}`] ?? {};
    const evidence = evidenceByModel.get(record.modelId) ?? {};
    const review = reviewByModel.get(record.modelId) ?? {};
    const evidenceId = record.evidenceId ?? persisted.evidenceId ?? review.evidenceId ?? evidence.evidenceId ?? null;
    const derivedVerificationStatus = review.finalStatus === "smoke_failed"
      ? "smoke_failed"
      : (record.verificationStatus ?? "unverified");
    const row = {
      modelId: record.modelId,
      providerId: record.providerId,
      selectable: record.selectable === true,
      verificationStatus: derivedVerificationStatus,
      capabilityBucket: record.capabilityBucket ?? "unknown",
      evidenceId,
      evidencePhase: evidencePhaseFromId(evidenceId) ?? review.evidencePhase ?? evidence.evidencePhase ?? null,
      lastVerifiedAt: record.lastVerifiedAt ?? persisted.lastVerifiedAt ?? null,
      failureCode: record.failureCode ?? persisted.failureCode ?? (review.httpStatus ? `http_${review.httpStatus}` : null),
      failureReason: redactShort(record.failureReason ?? persisted.failureReason ?? review.rejectionReason),
      nonSelectableReason: null,
      uiBadge: null,
      uiSeverity: null,
    };
    row.nonSelectableReason = nonSelectableReason({ ...record, evidenceId, verificationStatus: derivedVerificationStatus }, review);
    row.uiBadge = inferBadge(row);
    row.uiSeverity = inferSeverity(row);
    return row;
  });
}

function markdownTable(rows, limit = 40) {
  const lines = [
    "| modelId | status | selectable | capability | evidenceId | reason |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of rows.slice(0, limit)) {
    lines.push(`| ${row.modelId} | ${row.verificationStatus} | ${row.selectable} | ${row.capabilityBucket} | ${row.evidenceId ?? ""} | ${row.nonSelectableReason ?? row.failureReason ?? ""} |`);
  }
  return lines.join("\n");
}

function main() {
  const usabilityMatrix = readJson(INPUTS.usabilityMatrix);
  const verificationState = readJson(INPUTS.verificationState);
  const phase324bIndex = readJson(INPUTS.phase324bIndex, {});
  const phase324b2b3Index = readJson(INPUTS.phase324b2b3Index, {});
  const phase324cReview = readJson(INPUTS.phase324cReview, {});
  const phase324c2Review = readJson(INPUTS.phase324c2Review, {});
  const modelLibraryState = readJson(INPUTS.modelLibraryState, {});
  const cachedDiscovery = Array.isArray(modelLibraryState?.lastDiscoveryRecords) && modelLibraryState.lastDiscoveryRecords.length
    ? {
        records: modelLibraryState.lastDiscoveryRecords,
        discovery: modelLibraryState.lastDiscovery ?? {
          providerId: "nvidia",
          source: "cached-live-discovery",
          blockers: [],
        },
      }
    : undefined;
  const rebuiltMatrix = buildModelUsabilityMatrix({
    registry: buildUnifiedModelRegistry({
      providerConfig: { nvidia: { configured: true, apiKeyConfigured: true } },
      discovery: cachedDiscovery,
    }),
  });
  const records = Array.isArray(usabilityMatrix?.records) && usabilityMatrix.records.length
    ? usabilityMatrix.records
    : rebuiltMatrix.records;
  const persistedRecords = verificationState?.records ?? {};
  const evidenceByModel = indexEvidence(phase324bIndex, phase324b2b3Index);
  const reviewByModel = indexReviewModels(phase324cReview, phase324c2Review);
  const modelStatusRows = buildRows({ records, persistedRecords, evidenceByModel, reviewByModel });
  const selectableModels = modelStatusRows.filter((row) => row.selectable);
  const failedModels = modelStatusRows.filter((row) => FAILED_STATUSES.has(row.verificationStatus));
  const unverifiedModels = modelStatusRows.filter((row) => row.verificationStatus === "unverified");
  const output = {
    phase: "Phase324D",
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      ...INPUTS,
      phase324cReportPresent: readTextPresence(INPUTS.phase324cReport),
      phase324c2ReportPresent: readTextPresence(INPUTS.phase324c2Report),
    },
    summary: {
      totalModels: usabilityMatrix?.totalModels ?? usabilityMatrix?.summary?.totalModels ?? modelStatusRows.length,
      selectableModels: usabilityMatrix?.selectableModels ?? usabilityMatrix?.summary?.selectableModels ?? selectableModels.length,
      smokePassedModels: usabilityMatrix?.smokePassedModels ?? usabilityMatrix?.summary?.smokePassedModels ?? modelStatusRows.filter((row) => row.verificationStatus === "smoke_passed").length,
      failedModels: failedModels.length,
      unverifiedModels: unverifiedModels.length,
      providerScope: "NVIDIA-only",
      futureProvidersEnabled: false,
    },
    selectableModels,
    failedModels,
    modelStatusRows,
    safety: {
      apiCalled: false,
      envRead: false,
      verificationMetadataModified: false,
      selectableGateModified: false,
      chatGatewayModified: false,
    },
  };

  writeOutput(OUTPUT_JSON, `${JSON.stringify(output, null, 2)}\n`);
  writeOutput(OUTPUT_MD, [
    "# Phase324D Model Status View Data",
    "",
    `- generatedAt: ${output.generatedAt}`,
    `- totalModels: ${output.summary.totalModels}`,
    `- selectableModels: ${output.summary.selectableModels}`,
    `- smokePassedModels: ${output.summary.smokePassedModels}`,
    `- failedModels: ${output.summary.failedModels}`,
    `- unverifiedModels: ${output.summary.unverifiedModels}`,
    "- providerScope: NVIDIA-only",
    "- futureProvidersEnabled: false",
    "",
    "## Selectable Models",
    "",
    markdownTable(selectableModels, selectableModels.length),
    "",
    "## Failed Models",
    "",
    markdownTable(failedModels, Math.max(failedModels.length, 1)),
    "",
    "## Model Status Rows Sample",
    "",
    markdownTable(modelStatusRows, 40),
    "",
    "## Safety",
    "",
    "- apiCalled: false",
    "- envRead: false",
    "- verificationMetadataModified: false",
    "- selectableGateModified: false",
    "- chatGatewayModified: false",
    "",
  ].join("\n"));

  console.log(JSON.stringify({
    status: "pass",
    outputJson: OUTPUT_JSON,
    outputMarkdown: OUTPUT_MD,
    summary: output.summary,
    rows: modelStatusRows.length,
  }, null, 2));
}

function writeOutput(relativePath, content) {
  const absolutePath = resolve(repoRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
}

main();
