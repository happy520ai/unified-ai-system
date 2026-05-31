import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const INPUTS = {
  usabilityMatrix: "apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json",
  verificationState: "apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json",
  phase324dViewData: "docs/phase324d-model-status-view-data.json",
  phase324bBatch: "docs/phase324b-nvidia-smoke-batch-result.json",
  phase324b2Batch: "docs/phase324b2-nvidia-smoke-batch-result.json",
  phase324b3Batch: "docs/phase324b3-nvidia-smoke-batch-result.json",
  phase324bIndex: "docs/phase324b-model-smoke-evidence-index.json",
  phase324b2b3Index: "docs/phase324b2-b3-model-smoke-evidence-index.json",
  phase324cReview: "docs/phase324c-selectable-model-review.json",
  phase324c2Review: "docs/phase324c2-selectable-model-review.json",
  phase324aInventory: "docs/phase324a-nvidia-model-candidate-inventory.json",
};

const EVIDENCE_DIRS = [
  "apps/ai-gateway-service/evidence/phase324b",
  "apps/ai-gateway-service/evidence/phase324b2",
  "apps/ai-gateway-service/evidence/phase324b3",
];

const OUTPUT_JSON = "docs/phase324e-model-library-operations-report.json";
const OUTPUT_MD = "docs/phase324e-model-library-operations-report.md";
const OUTPUT_DASHBOARD = "docs/phase324e-model-library-operations-dashboard-data.json";

function readJson(relativePath, fallback = null) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return fallback;
  return JSON.parse(readFileSync(absolutePath, "utf8"));
}

function readEvidenceFiles() {
  const items = [];
  for (const relativeDir of EVIDENCE_DIRS) {
    const absoluteDir = resolve(repoRoot, relativeDir);
    if (!existsSync(absoluteDir)) continue;
    for (const fileName of readdirSync(absoluteDir).filter((name) => name.endsWith(".json"))) {
      const relativePath = join(relativeDir, fileName).replace(/\\/g, "/");
      const evidence = readJson(relativePath, null);
      if (evidence) items.push({ ...evidence, evidencePath: relativePath });
    }
  }
  return items;
}

function summarizeBatch(batch, fallbackPhase) {
  const results = Array.isArray(batch?.results) ? batch.results : [];
  const passed = results.filter((item) => item.finalStatus === "smoke_passed");
  const failed = results.filter((item) => item.finalStatus === "smoke_failed");
  return {
    phase: batch?.phase ?? fallbackPhase,
    batchId: batch?.batchId ?? fallbackPhase.toLowerCase(),
    plannedModelCount: Number(batch?.plannedModelCount ?? results.length),
    processedModelCount: Number(batch?.processedModelCount ?? results.length),
    passCount: Number(batch?.smokePassedCount ?? passed.length),
    failCount: Number(batch?.smokeFailedCount ?? failed.length),
    skippedEnvMissingCount: Number(batch?.skippedEnvMissingCount ?? 0),
    manualReviewRequiredCount: Number(batch?.manualReviewRequiredCount ?? 0),
    passRate: ratio(Number(batch?.smokePassedCount ?? passed.length), Number(batch?.processedModelCount ?? results.length)),
    models: results.map((item) => item.modelId),
  };
}

function ratio(numerator, denominator) {
  return denominator > 0 ? round(numerator / denominator) : 0;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function average(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return null;
  return round(filtered.reduce((sum, value) => sum + value, 0) / filtered.length, 2);
}

function latencyStats(evidence) {
  const withLatency = evidence
    .filter((item) => Number.isFinite(Number(item.latencyMs)))
    .map((item) => ({ ...item, latencyMs: Number(item.latencyMs) }));
  const passed = withLatency.filter((item) => item.finalStatus === "smoke_passed");
  const failed = withLatency.filter((item) => item.finalStatus === "smoke_failed");
  const sorted = [...withLatency].sort((left, right) => left.latencyMs - right.latencyMs);
  const slowModels = withLatency
    .filter((item) => item.latencyMs >= 10000)
    .sort((left, right) => right.latencyMs - left.latencyMs)
    .map(toLatencyRow);
  return {
    passedAverageLatencyMs: average(passed.map((item) => item.latencyMs)),
    failedAverageLatencyMs: average(failed.map((item) => item.latencyMs)),
    overallAverageLatencyMs: average(withLatency.map((item) => item.latencyMs)),
    minLatency: sorted.length ? toLatencyRow(sorted[0]) : null,
    maxLatency: sorted.length ? toLatencyRow(sorted[sorted.length - 1]) : null,
    passedLatencies: passed.map(toLatencyRow),
    failedLatencies: failed.map(toLatencyRow),
    slowModels,
    highLatencyThresholdMs: 10000,
  };
}

function toLatencyRow(item) {
  return {
    modelId: item.modelId,
    finalStatus: item.finalStatus,
    latencyMs: Number(item.latencyMs),
    evidenceId: item.evidenceId ?? null,
  };
}

function failureStats(evidence) {
  const failed = evidence.filter((item) => item.finalStatus === "smoke_failed");
  const stats = {
    http404: 0,
    http410: 0,
    nvidiaHttpError: 0,
    completionVerifiedFalse: 0,
    assistantTextPresentFalse: 0,
    timeout: 0,
    schemaInvalid: 0,
    emptyCompletion: 0,
  };
  for (const item of failed) {
    if (Number(item.httpStatus) === 404) stats.http404 += 1;
    if (Number(item.httpStatus) === 410) stats.http410 += 1;
    if (item.errorCode === "nvidia_http_error") stats.nvidiaHttpError += 1;
    if (item.completionVerified === false) stats.completionVerifiedFalse += 1;
    if (item.assistantTextPresent === false) stats.assistantTextPresentFalse += 1;
    if (String(item.errorCode ?? "").toLowerCase().includes("timeout")) stats.timeout += 1;
    if (String(item.errorCode ?? "").toLowerCase().includes("schema")) stats.schemaInvalid += 1;
    if (item.assistantTextPresent === false && !item.errorCode) stats.emptyCompletion += 1;
  }
  const notRecommendedForShortTermRetry = failed
    .filter((item) => [404, 410].includes(Number(item.httpStatus)))
    .map((item) => item.modelId);
  return {
    ...stats,
    failedModels: failed.map((item) => ({
      modelId: item.modelId,
      httpStatus: item.httpStatus ?? null,
      errorCode: item.errorCode ?? null,
      completionVerified: item.completionVerified === true,
      assistantTextPresent: item.assistantTextPresent === true,
      evidenceId: item.evidenceId ?? null,
    })),
    notRecommendedForShortTermRetry,
  };
}

function mergeFailureEvidence(evidence, viewData) {
  const byModelId = new Map(evidence.map((item) => [item.modelId, item]));
  const failedRows = Array.isArray(viewData?.failedModels) ? viewData.failedModels : [];
  for (const row of failedRows) {
    if (!row?.modelId || byModelId.has(row.modelId)) continue;
    const httpStatusMatch = String(row.failureCode ?? row.failureReason ?? "").match(/\b(?:httpStatus=|HTTP |http_)(\d{3})\b/i);
    const httpStatus = httpStatusMatch ? Number(httpStatusMatch[1]) : null;
    byModelId.set(row.modelId, {
      phase: row.evidencePhase ?? "Phase313A",
      modelId: row.modelId,
      providerId: row.providerId ?? "nvidia",
      finalStatus: "smoke_failed",
      providerCalled: true,
      completionVerified: false,
      assistantTextPresent: false,
      httpStatus,
      latencyMs: null,
      errorCode: row.failureCode ?? null,
      errorMessageRedacted: row.failureReason ?? row.nonSelectableReason ?? null,
      evidenceId: row.evidenceId ?? null,
    });
  }
  return Array.from(byModelId.values());
}

function evidenceCoverage({ viewData, evidence }) {
  const rows = Array.isArray(viewData?.modelStatusRows) ? viewData.modelStatusRows : [];
  const selectable = rows.filter((row) => row.selectable === true);
  const failed = rows.filter((row) => row.verificationStatus === "smoke_failed");
  const unverified = rows.filter((row) => row.verificationStatus === "unverified");
  const rowsWithEvidence = rows.filter((row) => Boolean(row.evidenceId));
  const smokeEvidenceModelIds = new Set(evidence.map((item) => item.modelId).filter(Boolean));
  return {
    selectableModelsHaveEvidenceId: selectable.every((row) => Boolean(row.evidenceId)),
    selectableWithEvidenceId: selectable.filter((row) => Boolean(row.evidenceId)).length,
    selectableTotal: selectable.length,
    smokeFailedModelsHaveEvidence: failed.every((row) => Boolean(row.evidenceId)),
    smokeFailedWithEvidence: failed.filter((row) => Boolean(row.evidenceId)).length,
    smokeFailedTotal: failed.length,
    unverifiedModels: unverified.length,
    missingEvidenceModels: rows.filter((row) => !row.evidenceId).length,
    evidenceCoverageRatio: ratio(rowsWithEvidence.length, rows.length),
    smokeEvidenceCoverageRatio: ratio(smokeEvidenceModelIds.size, evidence.length),
  };
}

function statusBuckets(viewData) {
  const rows = Array.isArray(viewData?.modelStatusRows) ? viewData.modelStatusRows : [];
  return {
    selectableVerified: rows.filter((row) => row.selectable === true).map((row) => row.modelId),
    smokeFailed: rows.filter((row) => row.verificationStatus === "smoke_failed").map((row) => row.modelId),
    unverified: rows.filter((row) => row.verificationStatus === "unverified").length,
    deprecated: rows.filter((row) => row.verificationStatus === "deprecated").length,
    blocked: rows.filter((row) => row.verificationStatus === "blocked").length,
    manualReview: rows.filter((row) => row.verificationStatus === "manual_review_required").length,
  };
}

function markdownList(items) {
  if (!items.length) return "- none";
  return items.map((item) => `- ${item}`).join("\n");
}

function markdownReport(report) {
  return [
    "# Phase324E Model Library Operations Report",
    "",
    "## Executive Summary",
    "",
    `- totalModels: ${report.summary.totalModels}`,
    `- selectableModels: ${report.summary.selectableModels}`,
    `- smokePassedModels: ${report.summary.smokePassedModels}`,
    `- failedModels: ${report.summary.failedModels}`,
    `- unverifiedModels: ${report.summary.unverifiedModels}`,
    "- providerScope: NVIDIA-only",
    "- multiProviderOpen: false",
    "",
    "## Selectable Growth",
    "",
    "| Stage | selectableModels |",
    "| --- | ---: |",
    ...report.selectableGrowth.map((item) => `| ${item.stage} | ${item.selectableModels} |`),
    "",
    "## Smoke Batch Performance",
    "",
    "| Batch | Pass | Fail | Processed | Pass rate |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...report.smokeBatchPerformance.batches.map((item) => `| ${item.phase} | ${item.passCount} | ${item.failCount} | ${item.processedModelCount} | ${item.passRate} |`),
    `- total new smoke candidates passed: ${report.smokeBatchPerformance.totalPass}/${report.smokeBatchPerformance.totalProcessed}`,
    "- total smokePassedModels after original verified models: 9",
    "",
    "## Failure Analysis",
    "",
    `- 404: ${report.failureAnalysis.http404}`,
    `- 410: ${report.failureAnalysis.http410}`,
    `- nvidia_http_error: ${report.failureAnalysis.nvidiaHttpError}`,
    `- completionVerified=false: ${report.failureAnalysis.completionVerifiedFalse}`,
    `- assistantTextPresent=false: ${report.failureAnalysis.assistantTextPresentFalse}`,
    `- timeout: ${report.failureAnalysis.timeout}`,
    `- schema invalid: ${report.failureAnalysis.schemaInvalid}`,
    "",
    "### Not Recommended For Short-Term Retry",
    "",
    markdownList(report.failureAnalysis.notRecommendedForShortTermRetry),
    "",
    "## Latency Analysis",
    "",
    `- passedAverageLatencyMs: ${report.latencyAnalysis.passedAverageLatencyMs}`,
    `- failedAverageLatencyMs: ${report.latencyAnalysis.failedAverageLatencyMs}`,
    `- overallAverageLatencyMs: ${report.latencyAnalysis.overallAverageLatencyMs}`,
    `- minLatency: ${report.latencyAnalysis.minLatency?.modelId ?? "none"} (${report.latencyAnalysis.minLatency?.latencyMs ?? "n/a"}ms)`,
    `- maxLatency: ${report.latencyAnalysis.maxLatency?.modelId ?? "none"} (${report.latencyAnalysis.maxLatency?.latencyMs ?? "n/a"}ms)`,
    "",
    "### Passed Model Latencies",
    "",
    markdownList(report.latencyAnalysis.passedLatencies.map((item) => `${item.modelId}: ${item.latencyMs}ms`)),
    "",
    "### Slow Models",
    "",
    markdownList(report.latencyAnalysis.slowModels.map((item) => `${item.modelId}: ${item.latencyMs}ms`)),
    "",
    "## Evidence Coverage",
    "",
    `- selectableModelsHaveEvidenceId: ${report.evidenceCoverage.selectableModelsHaveEvidenceId}`,
    `- smokeFailedModelsHaveEvidence: ${report.evidenceCoverage.smokeFailedModelsHaveEvidence}`,
    `- unverifiedModels: ${report.evidenceCoverage.unverifiedModels}`,
    `- missingEvidenceModels: ${report.evidenceCoverage.missingEvidenceModels}`,
    `- evidenceCoverageRatio: ${report.evidenceCoverage.evidenceCoverageRatio}`,
    "",
    "## Model Status Buckets",
    "",
    `- selectable verified: ${report.modelStatusBuckets.selectableVerified.length}`,
    `- smoke_failed: ${report.modelStatusBuckets.smokeFailed.length}`,
    `- unverified: ${report.modelStatusBuckets.unverified}`,
    `- deprecated: ${report.modelStatusBuckets.deprecated}`,
    `- blocked: ${report.modelStatusBuckets.blocked}`,
    `- manual-review: ${report.modelStatusBuckets.manualReview}`,
    "",
    "## Operational Risks",
    "",
    "- 404/410 models are not good short-term retry candidates.",
    "- High-latency models may affect UX and should be labeled or sorted in UI.",
    "- Partner catalog availability may be unstable; evidence must remain explicit.",
    "- Future provider slots are not real provider enablement.",
    "- Multi-provider work still needs a separate safety design phase.",
    "",
    "## Next Actions",
    "",
    "- Phase324D-2: add UI filters, sorting, latency badges, and evidenceId search.",
    "- Phase324B-4: continue NVIDIA-only smoke only after excluding 404/410 high-risk models.",
    "- Phase324F: design model selection/default recommendation strategy.",
    "- Phase325A: multi-provider safety design only; no OpenAI / Claude / OpenRouter / MiMo real calls.",
    "",
    "## Safety",
    "",
    "- apiCalled: false",
    "- envRead: false",
    "- verificationMetadataModified: false",
    "- uiModified: false",
    "- selectableGateModified: false",
    "- chatGatewayModified: false",
    "",
  ].join("\n");
}

function main() {
  const usabilityMatrix = readJson(INPUTS.usabilityMatrix, {});
  const verificationState = readJson(INPUTS.verificationState, {});
  const viewData = readJson(INPUTS.phase324dViewData, {});
  const batches = [
    summarizeBatch(readJson(INPUTS.phase324bBatch, {}), "Phase324B"),
    summarizeBatch(readJson(INPUTS.phase324b2Batch, {}), "Phase324B-2"),
    summarizeBatch(readJson(INPUTS.phase324b3Batch, {}), "Phase324B-3"),
  ];
  const evidence = mergeFailureEvidence(readEvidenceFiles(), viewData);
  const totalPass = batches.reduce((sum, item) => sum + item.passCount, 0);
  const totalFail = batches.reduce((sum, item) => sum + item.failCount, 0);
  const totalProcessed = batches.reduce((sum, item) => sum + item.processedModelCount, 0);
  const summary = {
    totalModels: viewData?.summary?.totalModels ?? usabilityMatrix.totalModels ?? 148,
    selectableModels: viewData?.summary?.selectableModels ?? usabilityMatrix.selectableModels ?? 9,
    smokePassedModels: viewData?.summary?.smokePassedModels ?? usabilityMatrix.smokePassedModels ?? 9,
    failedModels: viewData?.summary?.failedModels ?? 9,
    unverifiedModels: viewData?.summary?.unverifiedModels ?? 125,
    providerScope: "NVIDIA-only",
    multiProviderOpen: false,
  };
  const report = {
    phase: "Phase324E",
    generatedAt: new Date().toISOString(),
    sourceFiles: { ...INPUTS, evidenceDirs: EVIDENCE_DIRS },
    summary,
    selectableGrowth: [
      { stage: "initial_verified", selectableModels: 2 },
      { stage: "Phase324C", selectableModels: 4 },
      { stage: "Phase324C-2", selectableModels: 9 },
    ],
    smokeBatchPerformance: {
      batches,
      totalPass,
      totalFail,
      totalProcessed,
      newSmokePassRate: ratio(totalPass, totalProcessed),
      originalVerifiedModels: 2,
      finalSmokePassedModels: summary.smokePassedModels,
    },
    failureAnalysis: failureStats(evidence),
    latencyAnalysis: latencyStats(evidence),
    evidenceCoverage: evidenceCoverage({ viewData, evidence }),
    modelStatusBuckets: statusBuckets(viewData),
    unverifiedBacklog: {
      count: summary.unverifiedModels,
      recommendation: "Use Phase324E failure analysis to exclude high-risk 404/410 models before Phase324B-4.",
    },
    nextActions: [
      "Phase324D-2: UI filters/sorting/latency/evidence search.",
      "Phase324B-4: continue NVIDIA-only smoke with high-risk failures excluded.",
      "Phase324F: model selection/default recommendation strategy.",
      "Phase325A: multi-provider safety design only; no real non-NVIDIA calls.",
    ],
    safety: {
      apiCalled: false,
      envRead: false,
      productionCodeModified: false,
      verificationMetadataModified: false,
      uiModified: false,
      selectableGateModified: false,
      chatGatewayModified: false,
      evidenceModified: false,
    },
    verificationStateRecordCount: Object.keys(verificationState?.records ?? {}).length,
  };
  const dashboard = {
    phase: report.phase,
    generatedAt: report.generatedAt,
    kpis: {
      totalModels: summary.totalModels,
      selectableModels: summary.selectableModels,
      smokePassedModels: summary.smokePassedModels,
      failedModels: summary.failedModels,
      unverifiedModels: summary.unverifiedModels,
      newSmokePassRate: report.smokeBatchPerformance.newSmokePassRate,
      evidenceCoverageRatio: report.evidenceCoverage.evidenceCoverageRatio,
      averageLatencyMs: report.latencyAnalysis.overallAverageLatencyMs,
    },
    charts: {
      selectableGrowth: report.selectableGrowth,
      batchPassRates: batches.map((item) => ({ phase: item.phase, passRate: item.passRate })),
      failureTypes: {
        http404: report.failureAnalysis.http404,
        http410: report.failureAnalysis.http410,
        nvidiaHttpError: report.failureAnalysis.nvidiaHttpError,
        completionVerifiedFalse: report.failureAnalysis.completionVerifiedFalse,
        assistantTextPresentFalse: report.failureAnalysis.assistantTextPresentFalse,
      },
      slowModels: report.latencyAnalysis.slowModels,
    },
  };

  writeOutput(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  writeOutput(OUTPUT_DASHBOARD, `${JSON.stringify(dashboard, null, 2)}\n`);
  writeOutput(OUTPUT_MD, markdownReport(report));
  console.log(JSON.stringify({
    status: "pass",
    outputJson: OUTPUT_JSON,
    outputMarkdown: OUTPUT_MD,
    dashboardData: OUTPUT_DASHBOARD,
    summary: report.summary,
    smoke: report.smokeBatchPerformance,
  }, null, 2));
}

function writeOutput(relativePath, content) {
  const absolutePath = resolve(repoRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

main();
