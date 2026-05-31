import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const docsDir = path.join(repoRoot, "docs");
const evidenceRoot = path.join(repoRoot, "apps", "ai-gateway-service", "evidence");
const verificationStatePath = path.join(evidenceRoot, "phase-313a-model-verification-state.json");
const outputJsonPath = path.join(docsDir, "phase324h-model-library-stability-latency-capability-report.json");
const outputMdPath = path.join(docsDir, "phase324h-model-library-stability-latency-capability-report.md");
const tierSummaryPath = path.join(docsDir, "phase324h-model-tiering-summary.md");
const highRiskPath = path.join(docsDir, "phase324h-high-risk-and-review-queue.md");
const executionReportPath = path.join(docsDir, "phase324h-execution-report.md");

const phaseDirs = ["phase324b4", "phase324b5", "phase324b6", "phase324b7"];
const reviewDocs = [
  "phase324c4-selectable-model-review.json",
  "phase324c5-selectable-model-review.json",
];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function listJsonFiles(dirPath) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => path.join(dirPath, entry.name));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function latencyTier(latencyMs) {
  if (!Number.isFinite(latencyMs)) return "unknown";
  if (latencyMs <= 500) return "ultra_fast";
  if (latencyMs <= 1000) return "fast";
  if (latencyMs <= 2500) return "normal";
  if (latencyMs <= 5000) return "slow";
  return "very_slow";
}

function inferCapability(modelId) {
  const lower = String(modelId).toLowerCase();
  const tiers = [];
  const reasons = [];
  if (lower.includes("code")) {
    tiers.push("coding");
    reasons.push("code substring");
  }
  if (lower.includes("reason") || lower.includes("think")) {
    tiers.push("reasoning");
    reasons.push("reason substring");
  }
  if (lower.includes("128k") || lower.includes("long")) {
    tiers.push("long_context");
    reasons.push("long-context heuristic");
  }
  if (lower.includes("mini") || lower.includes("nano") || lower.includes("flash")) {
    tiers.push("low_latency");
    reasons.push("small-model heuristic");
  }
  if (lower.includes("70b") || lower.includes("120b") || lower.includes("maverick") || lower.includes("31b")) {
    tiers.push("large_model");
    reasons.push("large-model heuristic");
  }
  if (!tiers.length) {
    tiers.push("general_chat");
    reasons.push("default chat heuristic");
  }
  return {
    tiers,
    inferenceSource: "model_id_heuristic",
    inferenceReason: reasons.join(", "),
  };
}

function riskTier(item) {
  if (item.selectable === true && item.finalStatus === "smoke_passed") return "stable_selectable";
  if (item.finalStatus === "smoke_passed" && item.selectable !== true && item.latencyTier === "very_slow") return "high_latency_review";
  if (item.finalStatus === "smoke_passed") return "eligible_for_review";
  if (item.finalStatus === "manual_review_required") return "manual_review_required";
  if (item.httpStatus === 410) return "high_risk_http_410";
  if (item.errorCode === "nvidia_request_timeout") return "high_risk_timeout";
  if (item.finalStatus === "smoke_failed") return "failed_not_eligible";
  return "unverified";
}

function buildMarkdown(report) {
  const lines = [
    "# Phase324H Model Library Stability / Latency / Capability Report",
    "",
    "## 当前模型库概览",
    "",
    `- totalModels: ${report.summary.totalModels}`,
    `- selectableModels: ${report.summary.selectableModels}`,
    `- smokePassedModels: ${report.summary.smokePassedModels}`,
    `- failedModels: ${report.summary.failedModels}`,
    `- unverifiedModels: ${report.summary.unverifiedModels}`,
    `- manualReviewRequiredModels: ${report.summary.manualReviewRequiredModels}`,
    `- evidenceCoverage: ${report.summary.evidenceCoverage}`,
    `- passRate: ${report.summary.passRate}`,
    `- failureRate: ${report.summary.failureRate}`,
    "",
    "## selectable 增长趋势",
    "",
    "- Phase324C-4 之后 selectableModels = 12",
    "- Phase324C-5 之后 selectableModels = 16",
    "",
    "## latency tier",
    "",
    ...Object.entries(report.latencyTiers).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## high-risk 清单",
    "",
    ...(report.reviewQueues.highRiskHttp410.length ? report.reviewQueues.highRiskHttp410.map((item) => `- ${item.modelId}`) : ["- none"]),
    ...(report.reviewQueues.highRiskTimeout.length ? report.reviewQueues.highRiskTimeout.map((item) => `- ${item.modelId}`) : []),
    "",
    "## future review queue",
    "",
    ...(report.reviewQueues.eligibleForPhase324C6.length
      ? report.reviewQueues.eligibleForPhase324C6.map((item) => `- ${item.modelId}`)
      : ["- none"]),
    "",
    "## 不建议重试模型",
    "",
    ...(report.reviewQueues.notRecommendedRetry.length
      ? report.reviewQueues.notRecommendedRetry.map((item) => `- ${item.modelId}`)
      : ["- none"]),
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const missingSources = [];
  const verificationState = await readJsonIfExists(verificationStatePath);
  if (!verificationState) missingSources.push("apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json");

  const evidenceRecords = [];
  for (const phaseDir of phaseDirs) {
    const files = await listJsonFiles(path.join(evidenceRoot, phaseDir));
    if (!files) {
      missingSources.push(`apps/ai-gateway-service/evidence/${phaseDir}`);
      continue;
    }
    for (const filePath of files) {
      evidenceRecords.push(await readJson(filePath));
    }
  }

  const reviewSummaries = [];
  for (const fileName of reviewDocs) {
    const doc = await readJsonIfExists(path.join(docsDir, fileName));
    if (!doc) {
      missingSources.push(`docs/${fileName}`);
      continue;
    }
    reviewSummaries.push(doc);
  }

  const recordsByModel = new Map();
  for (const evidence of evidenceRecords) {
    if (!recordsByModel.has(evidence.modelId)) {
      recordsByModel.set(evidence.modelId, []);
    }
    recordsByModel.get(evidence.modelId).push(evidence);
  }

  const verificationRecords = Object.values(verificationState?.records ?? {});
  const verificationByModel = new Map(verificationRecords.map((record) => [record.modelId, record]));

  const analysisRows = [];
  for (const [modelId, records] of recordsByModel.entries()) {
    const latest = [...records].sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""))).at(-1);
    const capability = inferCapability(modelId);
    const selectable = verificationByModel.get(modelId)?.verificationStatus === "smoke_passed";
    const row = {
      modelId,
      phase: latest.phase,
      finalStatus: latest.finalStatus,
      httpStatus: Number(latest.httpStatus ?? 0) || null,
      errorCode: latest.errorCode ?? null,
      latencyMs: Number(latest.latencyMs ?? 0) || null,
      latencyTier: latencyTier(Number(latest.latencyMs ?? 0)),
      selectable,
      provider: latest.provider ?? latest.providerId ?? "unknown",
      capabilityTiers: capability.tiers,
      inferenceSource: capability.inferenceSource,
      inferenceReason: capability.inferenceReason,
    };
    row.riskTier = riskTier(row);
    analysisRows.push(row);
  }

  const latencyValues = analysisRows.map((item) => item.latencyMs).filter((value) => Number.isFinite(value));
  const totalModels = 148;
  const selectableModels = verificationRecords.filter((record) => record.verificationStatus === "smoke_passed").length;
  const smokePassedModels = selectableModels;
  const failedModels = analysisRows.filter((item) => item.finalStatus === "smoke_failed").length;
  const manualReviewRequiredModels = analysisRows.filter((item) => item.finalStatus === "manual_review_required").length;
  const unverifiedModels = Math.max(0, totalModels - smokePassedModels - failedModels - manualReviewRequiredModels);
  const highRiskModels = analysisRows.filter((item) => ["high_risk_http_410", "high_risk_timeout"].includes(item.riskTier)).length;
  const evidenceCoverage = `${analysisRows.length}/${totalModels}`;
  const passRate = analysisRows.length ? Number((analysisRows.filter((item) => item.finalStatus === "smoke_passed").length / analysisRows.length).toFixed(4)) : 0;
  const failureRate = analysisRows.length ? Number((analysisRows.filter((item) => item.finalStatus === "smoke_failed").length / analysisRows.length).toFixed(4)) : 0;

  const latencyTiers = {
    ultra_fast: analysisRows.filter((item) => item.latencyTier === "ultra_fast").length,
    fast: analysisRows.filter((item) => item.latencyTier === "fast").length,
    normal: analysisRows.filter((item) => item.latencyTier === "normal").length,
    slow: analysisRows.filter((item) => item.latencyTier === "slow").length,
    very_slow: analysisRows.filter((item) => item.latencyTier === "very_slow").length,
  };

  const riskTiers = Object.fromEntries(
    ["stable_selectable", "eligible_for_review", "high_latency_review", "failed_not_eligible", "high_risk_http_410", "high_risk_timeout", "unverified", "manual_review_required"]
      .map((tier) => [tier, analysisRows.filter((item) => item.riskTier === tier).length]),
  );

  const capabilityTiers = {};
  for (const row of analysisRows) {
    for (const tier of row.capabilityTiers) {
      capabilityTiers[tier] = (capabilityTiers[tier] ?? 0) + 1;
    }
  }

  const httpStatusDistribution = {};
  const errorCodeDistribution = {};
  const providerDistribution = {};
  const phaseDistribution = {};
  for (const row of analysisRows) {
    const httpKey = String(row.httpStatus ?? "none");
    httpStatusDistribution[httpKey] = (httpStatusDistribution[httpKey] ?? 0) + 1;
    const errorKey = String(row.errorCode ?? "none");
    errorCodeDistribution[errorKey] = (errorCodeDistribution[errorKey] ?? 0) + 1;
    providerDistribution[row.provider] = (providerDistribution[row.provider] ?? 0) + 1;
    phaseDistribution[row.phase] = (phaseDistribution[row.phase] ?? 0) + 1;
  }

  const sortedLatency = [...analysisRows].filter((item) => Number.isFinite(item.latencyMs)).sort((a, b) => a.latencyMs - b.latencyMs);
  const reviewQueues = {
    eligibleForPhase324C6: analysisRows.filter((item) => item.phase === "Phase324B-7" && item.finalStatus === "smoke_passed").map((item) => ({ modelId: item.modelId })),
    highRiskHttp410: analysisRows.filter((item) => item.riskTier === "high_risk_http_410").map((item) => ({ modelId: item.modelId })),
    highRiskTimeout: analysisRows.filter((item) => item.riskTier === "high_risk_timeout").map((item) => ({ modelId: item.modelId })),
    notRecommendedRetry: analysisRows.filter((item) => ["high_risk_http_410", "high_risk_timeout"].includes(item.riskTier)).map((item) => ({ modelId: item.modelId })),
  };

  const report = {
    phase: "Phase324H",
    reportName: "model-library-stability-latency-capability-report",
    runtimeStatus: "read_only_report",
    providerCallsMade: false,
    selectableModified: false,
    summary: {
      totalModels,
      selectableModels,
      smokePassedModels,
      failedModels,
      unverifiedModels,
      manualReviewRequiredModels,
      highRiskModels,
      evidenceCoverage,
      passRate,
      failureRate,
      averageLatencyMs: latencyValues.length ? Number((latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length).toFixed(2)) : null,
      medianLatencyMs: median(latencyValues),
      p95LatencyMs: percentile(latencyValues, 95),
      fastestModels: sortedLatency.slice(0, 5).map((item) => ({ modelId: item.modelId, latencyMs: item.latencyMs })),
      slowestModels: sortedLatency.slice(-5).reverse().map((item) => ({ modelId: item.modelId, latencyMs: item.latencyMs })),
      highLatencyModels: sortedLatency.filter((item) => item.latencyTier === "very_slow").map((item) => ({ modelId: item.modelId, latencyMs: item.latencyMs })),
      httpStatusDistribution,
      errorCodeDistribution,
      providerDistribution,
      phaseDistribution,
    },
    latencyTiers,
    riskTiers,
    capabilityTiers,
    reviewQueues,
    missingSources,
    capabilityInference: {
      inferenceUsed: true,
      inferenceSource: "model_id_heuristic",
    },
    safety: {
      readOnly: true,
      noProviderCall: true,
      noSelectableChange: true,
      noChatMainChainChange: true,
    },
  };

  await mkdir(path.dirname(outputJsonPath), { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(outputMdPath, `${buildMarkdown(report)}\n`, "utf8");
  await writeFile(
    tierSummaryPath,
    [
      "# Phase324H Model Tiering Summary",
      "",
      `- latencyTiers: ${JSON.stringify(latencyTiers)}`,
      `- riskTiers: ${JSON.stringify(riskTiers)}`,
      `- capabilityTiers: ${JSON.stringify(capabilityTiers)}`,
      "- capability inference uses `inferenceSource=model_id_heuristic` and is conservative.",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    highRiskPath,
    [
      "# Phase324H High Risk And Review Queue",
      "",
      "## High Risk",
      "",
      ...(reviewQueues.highRiskHttp410.length ? reviewQueues.highRiskHttp410.map((item) => `- ${item.modelId}`) : ["- none"]),
      ...(reviewQueues.highRiskTimeout.length ? reviewQueues.highRiskTimeout.map((item) => `- ${item.modelId}`) : []),
      "",
      "## Future Review Queue",
      "",
      ...(reviewQueues.eligibleForPhase324C6.length ? reviewQueues.eligibleForPhase324C6.map((item) => `- ${item.modelId}`) : ["- none"]),
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    executionReportPath,
    [
      "# Phase324H Execution Report",
      "",
      "- reportGenerated: true",
      "- readOnly: true",
      "- providerCallsMade: false",
      "- selectableModified: false",
      `- includesC5Review: ${reviewSummaries.some((doc) => doc.phase === "Phase324C-5")}`,
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(JSON.stringify({
    phase: report.phase,
    totalModels: report.summary.totalModels,
    selectableModels: report.summary.selectableModels,
    smokePassedModels: report.summary.smokePassedModels,
    failedModels: report.summary.failedModels,
    averageLatencyMs: report.summary.averageLatencyMs,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

