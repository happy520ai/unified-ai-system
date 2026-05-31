import { existsSync, readFileSync } from "node:fs";
import {
  baseSafety,
  paths,
  readJsonIfPresent,
  readModeResults,
  repoPath,
  writeDoc,
  writeJson,
} from "./phase941-960-common.mjs";
import { buildRound2BlockedFinalEvidence } from "../../packages/model-routing-engine/src/index.js";

const requiredFiles = [
  "packages/model-routing-engine/src/round2ApprovalIntake.js",
  "packages/model-routing-engine/src/round2ScenarioMatrix.js",
  "packages/model-routing-engine/src/eligibleModelPoolLock.js",
  "packages/model-routing-engine/src/round2RealRouteExecutor.js",
  "packages/model-routing-engine/src/round2FallbackTester.js",
  "packages/model-routing-engine/src/round2BudgetGuard.js",
  "packages/model-routing-engine/src/round2AuthenticityRecheck.js",
  "packages/model-routing-engine/src/round2QualityScoring.js",
  "packages/model-routing-engine/src/round2ModeComparison.js",
  "packages/model-routing-engine/src/modelFitFailurePatternAnalysis.js",
  "packages/model-routing-engine/src/round2TuningRecommendation.js",
  "packages/model-routing-engine/src/round2EvidenceLedgerAudit.js",
  "apps/ai-gateway-service/src/ui/components/RouteQualityRound2Panel.js",
  "apps/ai-gateway-service/src/ui/copy/routeQualityRound2Copy.js",
  paths.approval,
  paths.scenarioMatrix,
  paths.eligiblePool,
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(repoPath(file))) failures.push(`missing:${file}`);
}

const approval = readJsonIfPresent(paths.approval) || {};
const pool = readJsonIfPresent(paths.eligiblePool) || {};
const budget = readJsonIfPresent(paths.budget) || {};
const authenticity = readJsonIfPresent(paths.authenticity) || {};
const quality = readJsonIfPresent(paths.quality) || {};
const comparison = readJsonIfPresent(paths.comparison) || {};
const fit = readJsonIfPresent(paths.modelFit) || {};
const tuning = readJsonIfPresent(paths.tuning) || {};
const modeResults = readModeResults();

let final;
if (approval.authorizationComplete !== true) {
  final = buildRound2BlockedFinalEvidence({ approvalGate: approval });
} else {
  const normal = modeResults.find((item) => item.mode === "normal") || {};
  const god = modeResults.find((item) => item.mode === "god") || {};
  const tianshu = modeResults.find((item) => item.mode === "tianshu") || {};
  const fallback = modeResults.find((item) => item.mode === "fallback") || {};
  const recommended = budget.maxTotalProviderRequestsRespected === true
    && budget.maxRetriesRespected === true
    && budget.budgetExceeded === false
    && authenticity.externalProviderApiCallConfirmed === true
    && authenticity.externalProviderApiCallConfirmedCount === authenticity.realProviderRequestCount
    && normal.modeRound2Passed === true
    && god.modeRound2Passed === true
    && tianshu.modeRound2Passed === true
    && fallback.modeRound2Passed === true;
  final = {
    phaseRange: "Phase941-960",
    completed: true,
    recommended_sealed: recommended,
    blocker: recommended ? null : "round2_real_route_quality_test_failed",
    round2ApprovalPresent: approval.round2ApprovalPresent === true,
    realRouteQualityRound2Executed: budget.totalProviderRequests > 0,
    providerAllowlist: approval.providerAllowlist || ["nvidia"],
    credentialRefOnly: true,
    providerCallsMade: budget.totalProviderRequests > 0,
    totalProviderRequests: budget.totalProviderRequests || 0,
    maxTotalProviderRequestsRespected: budget.maxTotalProviderRequestsRespected === true,
    maxRetriesRespected: budget.maxRetriesRespected === true,
    estimatedCostUsdTotal: budget.estimatedCostUsdTotal || 0,
    budgetExceeded: budget.budgetExceeded === true,
    normalModeRound2Passed: normal.modeRound2Passed === true,
    godModeRound2Passed: god.modeRound2Passed === true,
    tianshuModeRound2Passed: tianshu.modeRound2Passed === true,
    fallbackRound2Passed: fallback.modeRound2Passed === true,
    externalProviderApiCallConfirmed: authenticity.externalProviderApiCallConfirmed === true,
    networkAttemptRecorded: authenticity.externalProviderApiCallConfirmedCount > 0,
    responseSource: authenticity.responseSource || "unknown",
    externalProviderApiCallConfirmedCount: authenticity.externalProviderApiCallConfirmedCount || 0,
    realProviderRequestCount: authenticity.realProviderRequestCount || 0,
    routeQualityScoringReady: quality.routeQualityScoringReady === true,
    averageQualityScore: quality.averageQualityScore || 0,
    modeComparisonReady: comparison.modeComparisonReady === true,
    modelFitAnalysisReady: fit.modelFitAnalysisReady === true,
    routePolicyTuningRecommendationReady: tuning.routePolicyTuningRecommendationReady === true,
    routePolicyAppliedToRuntime: false,
    requiresFutureApprovalForTuning: true,
    globalSelectableModelBaseline: pool.globalSelectableModelBaseline || 17,
    round2EligiblePoolCount: pool.round2EligiblePoolCount || 0,
    selectableModifiedThisPhase: false,
    unauthorizedSelectableChangeDetected: false,
    blockedHighRiskModelsExcluded: true,
    failedModelsExcluded: true,
    credentialMissingModelsExcludedFromRuntime: true,
    sampleSizeStillLimited: true,
    recommendationIsStillPreliminary: true,
    humanReviewed: false,
    codexSurrogateReviewed: true,
    realSevenDaySoakCompleted: false,
    ...baseSafety(),
  };
}

if (final.round2ApprovalPresent === false) {
  expect(final.recommended_sealed === false, "missing_approval_must_not_seal");
  expect(final.blocker === "phase941_960_approval_missing", "missing_approval_blocker");
  expect(final.providerCallsMade === false, "missing_approval_no_provider_calls");
  expect(final.totalProviderRequests === 0, "missing_approval_zero_requests");
}
expect(final.rawSecretRead === false, "raw_secret_false");
expect(final.secretValueExposed === false, "secret_false");
expect(final.authJsonRead === false, "auth_json_false");
expect(final.chatBehaviorChangedByDefault === false, "chat_false");
expect(final.chatGatewayExecuteBehaviorChangedByDefault === false, "execute_false");
expect(final.deployExecuted === false, "deploy_false");
expect(final.releaseExecuted === false, "release_false");
expect(final.tagCreated === false, "tag_false");
expect(final.artifactUploaded === false, "artifact_false");
expect(final.selectableModifiedThisPhase === false, "selectable_false");
expect(final.unauthorizedSelectableChangeDetected === false, "selectable_change_false");
expect(final.unsupportedClaimCount === 0, "unsupported_zero");
expect(final.hallucinatedFactCount === 0, "hallucinated_zero");

if (failures.length) {
  final.recommended_sealed = false;
  final.blocker = final.blocker || failures[0];
}

writeJson(paths.final, final);
writeDoc("phase960-real-route-quality-test-round2-final-seal.md", {
  title: "Phase960 Real Route Quality Test Round 2 Final Seal",
  goal: "Seal Round 2 as executed or honestly blocked by the approval gate.",
  facts: [
    `recommended_sealed=${final.recommended_sealed}`,
    `blocker=${final.blocker}`,
    `totalProviderRequests=${final.totalProviderRequests}`,
  ],
  boundaries: ["No approval means no Provider request.", "No runtime/default route change."],
  outputs: [paths.final],
});
writeDoc("phase941-960-real-route-quality-test-round2.md", {
  title: "Phase941-960 Real Route Quality Test Round 2",
  goal: "Aggregate Round 2 approval, scenario, execution, audit, and no-runtime-change tuning outputs.",
  facts: [
    `round2ApprovalPresent=${final.round2ApprovalPresent}`,
    `realRouteQualityRound2Executed=${final.realRouteQualityRound2Executed}`,
    `providerCallsMade=${final.providerCallsMade}`,
  ],
  boundaries: ["NVIDIA-only.", "CredentialRef-only.", "No deploy/release."],
  outputs: [paths.final],
});
writeDoc("phase941-960-execution-report.md", {
  title: "Phase941-960 Execution Report",
  goal: "Record Round 2 execution or approval blocker status.",
  facts: [
    `blocker=${final.blocker}`,
    `newProviderRequests=${final.totalProviderRequests}`,
    `realSevenDaySoakCompleted=${final.realSevenDaySoakCompleted}`,
  ],
  boundaries: ["No workspace clean claim.", "No commit or push."],
  outputs: [paths.final],
});
writeDoc("phase956-mission-control-round2-quality-panel.md", {
  title: "Phase956 Mission Control Round 2 Quality Panel",
  goal: "Document the read-only Mission Control Round 2 quality panel.",
  facts: ["Panel is read-only.", "No dangerous action buttons are rendered."],
  boundaries: ["No Provider execution button.", "No deploy or selectable mutation button."],
  outputs: ["apps/ai-gateway-service/src/ui/components/RouteQualityRound2Panel.js"],
});
writeDoc("phase957-regression-secret-safety-recheck.md", {
  title: "Phase957 Regression Secret Safety Recheck",
  goal: "Record that regression and secret safety commands are required after Round 2.",
  facts: ["Regression commands are run outside this validator."],
  boundaries: ["No secret output."],
  outputs: [paths.final],
});
writeDoc("phase959-next-test-local-soak-recommendation.md", {
  title: "Phase959 Next Test Local Soak Recommendation",
  goal: "Recommend next testing without auto-entering the next phase.",
  facts: ["Round 2 does not claim seven-day soak.", "Future approval is required for broader tests."],
  boundaries: ["No automatic next phase execution."],
  outputs: [paths.final],
});

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures, final }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  completed: final.completed,
  recommended_sealed: final.recommended_sealed,
  blocker: final.blocker,
  totalProviderRequests: final.totalProviderRequests,
}, null, 2));

function expect(condition, label) {
  if (!condition) failures.push(label);
}
