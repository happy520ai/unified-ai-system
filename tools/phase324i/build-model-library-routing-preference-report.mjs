import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createModelLibraryStore } from "../../apps/ai-gateway-service/src/model-library/modelLibraryStore.js";
import { createModelVerificationStateStore } from "../../apps/ai-gateway-service/src/model-library/modelVerificationStateStore.js";
import { buildModelUsabilityMatrix } from "../../apps/ai-gateway-service/src/model-library/modelUsabilityMatrix.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const jsonPath = path.join(repoRoot, "docs", "phase324i-model-library-routing-preference-report.json");
const mdPath = path.join(repoRoot, "docs", "phase324i-model-library-routing-preference-report.md");
const tiersPath = path.join(repoRoot, "docs", "phase324i-recommended-model-tiers.md");
const policyPath = path.join(repoRoot, "docs", "phase324i-routing-policy-suggestions.json");
const riskNotesPath = path.join(repoRoot, "docs", "phase324i-model-selection-risk-notes.md");
const executionPath = path.join(repoRoot, "docs", "phase324i-execution-report.md");

async function readJsonIfExists(relativePath, missingSources) {
  const filePath = path.join(repoRoot, relativePath);
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    missingSources.push(relativePath);
    return null;
  }
}

async function readTextIfExists(relativePath, missingSources) {
  const filePath = path.join(repoRoot, relativePath);
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    missingSources.push(relativePath);
    return "";
  }
}

function buildMatrix() {
  return buildModelUsabilityMatrix({
    registry: createModelLibraryStore({
      env: {
        ...process.env,
        PHASE313A_NVIDIA_REAL_SMOKE: "",
        PHASE312A_NVIDIA_REAL_SMOKE: "",
        PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
      },
    }).getRegistry(),
    verificationStore: createModelVerificationStateStore(),
  });
}

function latencyOf(record) {
  return Number(record?.lastSmokeResult?.durationMs ?? Number.MAX_SAFE_INTEGER);
}

function isLarge(modelId) {
  return /70b|120b|128e|49b|31b|253b|large|super/i.test(modelId);
}

function isReasoning(modelId) {
  return /nemotron|reason|deepseek|dracarys|minimax|llama-3\.3/i.test(modelId);
}

function isCoding(modelId) {
  return /code|coder|deepseek|dracarys|phi|llama/i.test(modelId);
}

function isLongContext(modelId) {
  return /128k|128e|long|maverick|minimax/i.test(modelId);
}

function recommendationItem(record, reason, extra = {}) {
  return {
    modelId: record.modelId,
    providerId: record.providerId,
    evidenceId: record.evidenceId,
    latencyMs: latencyOf(record),
    reason,
    evidenceReason: record.evidenceId ? "smoke_passed_evidence_present" : "missing_evidence",
    capabilityTierReason: extra.capabilityTierReason ?? "capability inferred from verification metadata and model id",
    riskReason: "not in failed or high-risk exclusion queues",
    fallbackReason: extra.fallbackReason ?? "eligible selectable fallback candidate",
    inferenceSource: extra.inferenceSource ?? "model_id_heuristic",
  };
}

function take(records, count, reason, predicate = () => true, extra = {}) {
  return records.filter(predicate).slice(0, count).map((record) => recommendationItem(record, reason, extra));
}

function renderList(title, items) {
  return [
    `## ${title}`,
    "",
    ...(items.length ? items.map((item) => `- ${item.modelId}: ${item.reason}; evidence=${item.evidenceId}`) : ["- none"]),
    "",
  ];
}

function renderMarkdown(report) {
  return [
    "# Phase324I Model Library Routing Preference Report",
    "",
    "- Runtime status: read-only recommendation report.",
    "- Provider calls made: false.",
    "- Selectable and router runtime were not modified.",
    "- Capability labels that come from names are marked as `model_id_heuristic`.",
    "",
    ...renderList("Default General Chat", report.recommendations.defaultGeneralChat),
    ...renderList("Low Latency", report.recommendations.lowLatency),
    ...renderList("Reasoning", report.recommendations.reasoning),
    ...renderList("Coding", report.recommendations.coding),
    ...renderList("Long Context", report.recommendations.longContext),
    ...renderList("Large Model", report.recommendations.largeModel),
    ...renderList("Stable Fallback Chain", report.recommendations.stableFallbackChain),
    ...renderList("God Mode Candidate Pool", report.recommendations.godModeCandidatePool),
    ...renderList("Tianshu Candidate Pool", report.recommendations.tianshuCandidatePool),
    "## Missing Sources",
    "",
    ...(report.missingSources.length ? report.missingSources.map((item) => `- ${item}`) : ["- none"]),
    "",
  ].join("\n");
}

function renderTiers(report) {
  return [
    "# Phase324I Recommended Model Tiers",
    "",
    "- default_general_chat_recommendation uses stable selectable models with evidence.",
    "- low_latency_recommendation sorts by recorded smoke latency.",
    "- reasoning/coding/long_context/large_model use conservative model-id heuristic notes, not real benchmark claims.",
    "",
    ...Object.entries(report.recommendations).flatMap(([key, items]) => [
      `## ${key}`,
      "",
      ...(items.length ? items.map((item, index) => `${index + 1}. ${item.modelId} (${item.inferenceSource})`) : ["- none"]),
      "",
    ]),
  ].join("\n");
}

function renderRiskNotes(report) {
  return [
    "# Phase324I Model Selection Risk Notes",
    "",
    "- Failed, HTTP 404/410, timeout, high-risk, manual_review_required, and unverified models are excluded from recommendation lists.",
    "- Phase324B-7 passed model is recommended only if Phase324C-6 apply made it smoke_passed/selectable in verification metadata.",
    "- Capability tags are recommendation hints when `inferenceSource=model_id_heuristic`; they are not measured benchmark results.",
    "",
    "## High Risk Exclusion List",
    "",
    ...(report.exclusions.highRisk.length ? report.exclusions.highRisk.map((item) => `- ${item.modelId}: ${item.reason}`) : ["- none"]),
    "",
    "## Failed Exclusion List",
    "",
    ...(report.exclusions.failed.length ? report.exclusions.failed.map((item) => `- ${item.modelId}: ${item.reason}`) : ["- none"]),
    "",
  ].join("\n");
}

async function main() {
  const missingSources = [];
  const matrix = buildMatrix();
  const hReport = await readJsonIfExists("docs/phase324h-model-library-stability-latency-capability-report.json", missingSources);
  await readTextIfExists("docs/phase324h-high-risk-and-review-queue.md", missingSources);
  await readTextIfExists("docs/phase324h-model-tiering-summary.md", missingSources);
  const c6Review = await readJsonIfExists("docs/phase324c6-selectable-model-review.json", missingSources);
  await readTextIfExists("docs/phase324c6-model-registry-update-report.md", missingSources);

  const highRiskIds = new Set([
    ...(hReport?.reviewQueues?.highRiskHttp410 ?? []).map((item) => item.modelId),
    ...(hReport?.reviewQueues?.highRiskTimeout ?? []).map((item) => item.modelId),
  ]);
  const failedIds = new Set([...(hReport?.reviewQueues?.notRecommendedRetry ?? []).map((item) => item.modelId)]);
  const manualReviewIds = new Set((matrix.records ?? []).filter((record) => record.verificationStatus === "manual_review_required").map((record) => record.modelId));

  const eligibleRecords = (matrix.records ?? [])
    .filter((record) => record.providerId === "nvidia")
    .filter((record) => record.verificationStatus === "smoke_passed")
    .filter((record) => record.selectable === true)
    .filter((record) => Boolean(record.evidenceId))
    .filter((record) => !failedIds.has(record.modelId) && !highRiskIds.has(record.modelId) && !manualReviewIds.has(record.modelId))
    .sort((a, b) => latencyOf(a) - latencyOf(b));

  const c6Applied = eligibleRecords.some((record) => record.modelId === "minimaxai/minimax-m2.7");
  const recommendations = {
    defaultGeneralChat: take(eligibleRecords, 5, "stable selectable smoke_passed model with evidence"),
    lowLatency: take(eligibleRecords, 5, "lowest recorded smoke latency among selectable models"),
    reasoning: take(eligibleRecords, 5, "reasoning-oriented candidate by model id heuristic", (record) => isReasoning(record.modelId)),
    coding: take(eligibleRecords, 5, "coding-oriented candidate by model id heuristic", (record) => isCoding(record.modelId)),
    longContext: take(eligibleRecords, 5, "long-context candidate by model id heuristic", (record) => isLongContext(record.modelId)),
    largeModel: take(eligibleRecords, 5, "large-model candidate by model id heuristic", (record) => isLarge(record.modelId)),
    stableFallbackChain: take(eligibleRecords, 7, "fallback chain candidate ordered by latency and smoke evidence", () => true, { fallbackReason: "ordered fallback candidate after primary model failure" }),
    godModeCandidatePool: take(eligibleRecords, 8, "candidate for future God Mode dry-run pool; runtime not enabled", (record) => isReasoning(record.modelId) || isCoding(record.modelId) || isLarge(record.modelId)),
    tianshuCandidatePool: take(eligibleRecords, 8, "candidate for future Tianshu capability index seed; runtime not enabled", () => true),
  };

  const exclusions = {
    highRisk: [...highRiskIds].map((modelId) => ({ modelId, reason: "phase324h_high_risk_exclusion" })),
    failed: [...failedIds].map((modelId) => ({ modelId, reason: "phase324h_failed_or_not_recommended_retry" })),
    unverified: (matrix.records ?? []).filter((record) => record.verificationStatus === "unverified").map((record) => ({ modelId: record.modelId, reason: "unverified_not_selectable" })),
    manualReviewRequired: [...manualReviewIds].map((modelId) => ({ modelId, reason: "manual_review_required_not_recommended" })),
  };

  const report = {
    phase: "Phase324I",
    reportName: "model-library-routing-preference-report",
    runtimeStatus: "read_only_recommendation_report",
    generatedAt: new Date().toISOString(),
    providerCallsMade: false,
    selectableModified: false,
    routingRuntimeModified: false,
    missingSources,
    summary: {
      selectableCandidatesConsidered: eligibleRecords.length,
      phase324c6Applied: c6Applied,
      phase324c6EligibleCount: c6Review?.summary?.eligibleCount ?? null,
      minimaxM27Selectable: c6Applied,
      note: c6Applied ? "minimaxai/minimax-m2.7 may be considered with evidenceSource=phase324b7" : "minimaxai/minimax-m2.7 is not recommended as selectable runtime option because C-6 apply was not observed",
    },
    recommendations,
    exclusions,
    safety: {
      readOnly: true,
      noProviderCall: true,
      noSelectableChange: true,
      noRouterRuntimeChange: true,
    },
  };

  const policy = {
    phase: "Phase324I",
    runtimeStatus: "read_only_policy_suggestions",
    normalModeSuggestedPolicy: {
      primary: recommendations.defaultGeneralChat[0]?.modelId ?? null,
      fallbackChain: recommendations.stableFallbackChain.map((item) => item.modelId),
      rule: "select only smoke_passed/selectable/evidence-backed models",
    },
    godModeSuggestedPolicy: {
      candidatePool: recommendations.godModeCandidatePool.map((item) => item.modelId),
      runtimeEnabled: false,
      confidence: "medium",
      uncertaintyNotes: "Capability fit is partly inferred from model ids, not benchmarked.",
    },
    tianshuModeSuggestedPolicy: {
      candidatePool: recommendations.tianshuCandidatePool.map((item) => item.modelId),
      runtimeEnabled: false,
      confidence: "medium",
      uncertaintyNotes: "Capability index should remain dry-run until user-owned provider validation exists.",
    },
    fallbackChainSuggestions: recommendations.stableFallbackChain,
    exclusionRules: [
      "exclude verificationStatus != smoke_passed",
      "exclude selectable != true",
      "exclude missing evidenceId",
      "exclude HTTP 404/410/timeout/high-risk/manual_review_required/unverified",
    ],
    confidence: "medium",
    uncertaintyNotes: [
      "Latency comes from smoke evidence, not production SLA.",
      "Capability labels use model_id_heuristic when no benchmark exists.",
    ],
  };

  await mkdir(path.dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
  await writeFile(mdPath, `${renderMarkdown(report)}\n`, "utf8");
  await writeFile(tiersPath, `${renderTiers(report)}\n`, "utf8");
  await writeFile(riskNotesPath, `${renderRiskNotes(report)}\n`, "utf8");
  await writeFile(executionPath, [
    "# Phase324I Execution Report",
    "",
    "- reportGenerated: true",
    "- readOnly: true",
    "- providerCallsMade: false",
    "- selectableModified: false",
    "- routingRuntimeModified: false",
    `- missingSources: ${missingSources.join(", ") || "none"}`,
    `- selectableCandidatesConsidered: ${eligibleRecords.length}`,
    "",
  ].join("\n"), "utf8");

  console.log(JSON.stringify({
    phase: report.phase,
    selectableCandidatesConsidered: eligibleRecords.length,
    missingSources,
    providerCallsMade: false,
    selectableModified: false,
    routingRuntimeModified: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
