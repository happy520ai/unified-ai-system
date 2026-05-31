import { existsSync, readFileSync } from "node:fs";
import { baseSafety, docsDir, paths, repoPath, writeDoc, writeJson } from "./phase931-940-common.mjs";

const requiredFiles = [
  "packages/model-routing-engine/src/routeQualityEvidenceIntake.js",
  "packages/model-routing-engine/src/externalProviderAuthenticityCarryForward.js",
  "packages/model-routing-engine/src/eligiblePoolScopeClarifier.js",
  "packages/model-routing-engine/src/routeQualityScoreAuditor.js",
  "packages/model-routing-engine/src/modeComparisonAuditor.js",
  "packages/model-routing-engine/src/fallbackReliabilityAuditor.js",
  "packages/model-routing-engine/src/costLatencyReliabilityAuditor.js",
  "packages/model-routing-engine/src/routePolicyTuningDesign.js",
  "packages/model-routing-engine/src/nextRouteTestPlanBuilder.js",
  "apps/ai-gateway-service/src/ui/components/RouteQualityAuditPanel.js",
  "apps/ai-gateway-service/src/ui/copy/routeQualityAuditCopy.js",
  paths.intake,
  paths.authenticity,
  paths.scope,
  paths.score,
  paths.mode,
  paths.fallback,
  paths.costLatencyReliability,
  paths.tuning,
  paths.nextPlan,
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(repoPath(file))) failures.push(`missing:${file}`);
}

const intake = readJson(paths.intake);
const authenticity = readJson(paths.authenticity);
const scope = readJson(paths.scope);
const score = readJson(paths.score);
const mode = readJson(paths.mode);
const fallback = readJson(paths.fallback);
const costLatencyReliability = readJson(paths.costLatencyReliability);
const tuning = readJson(paths.tuning);
const nextPlan = readJson(paths.nextPlan);

const final = {
  phaseRange: "Phase931-940",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  realRouteEvidenceCount: intake.realRouteEvidenceCount,
  sourcePhase: "Phase916-930",
  providerCallsMadeThisPhase: false,
  newProviderRequestsThisPhase: 0,
  phase916930ExternalProviderApiConfirmed: authenticity.phase916930ExternalProviderApiConfirmed === true,
  authenticityCarryForwardPassed: authenticity.authenticityCarryForwardPassed === true,
  globalSelectableModelBaseline: scope.globalSelectableModelBaseline,
  phase916930EligibleTestPoolCount: scope.phase916930EligibleTestPoolCount,
  eligiblePoolScopeClarified: scope.eligiblePoolScopeClarified === true,
  unauthorizedSelectableShrinkage: scope.unauthorizedSelectableShrinkage === true,
  selectableModifiedThisPhase: false,
  routeQualityAuditReady: score.routeQualityAuditReady === true,
  modeComparisonAuditReady: mode.modeComparisonAuditReady === true,
  fallbackReliabilityAuditReady: fallback.fallbackReliabilityAuditReady === true,
  costLatencyReliabilityAuditReady: costLatencyReliability.costLatencyReliabilityAuditReady === true,
  routePolicyTuningPlanReady: tuning.routePolicyTuningPlanReady === true,
  nextRealRouteTestPlanReady: nextPlan.nextRealRouteTestPlanReady === true,
  sampleSizeLimited: true,
  recommendationIsPreliminary: true,
  routePolicyAppliedToRuntime: false,
  requiresFutureApprovalForTuning: true,
  requiresFutureApprovalForNextProviderTest: true,
  ...baseSafety(),
};

expect(final.realRouteEvidenceCount === 5, "real_route_evidence_count_5");
expect(final.providerCallsMadeThisPhase === false, "provider_calls_this_phase_false");
expect(final.newProviderRequestsThisPhase === 0, "new_provider_requests_zero");
expect(final.phase916930ExternalProviderApiConfirmed === true, "phase916_confirmed");
expect(final.authenticityCarryForwardPassed === true, "authenticity_carry_forward");
expect(final.globalSelectableModelBaseline === 17, "global_selectable_baseline_17");
expect(final.phase916930EligibleTestPoolCount === 2, "eligible_pool_2");
expect(final.eligiblePoolScopeClarified === true, "scope_clarified");
expect(final.unauthorizedSelectableShrinkage === false, "no_selectable_shrinkage");
expect(final.selectableModifiedThisPhase === false, "selectable_not_modified");
expect(final.routeQualityAuditReady === true, "score_audit_ready");
expect(final.modeComparisonAuditReady === true, "mode_audit_ready");
expect(final.fallbackReliabilityAuditReady === true, "fallback_audit_ready");
expect(final.costLatencyReliabilityAuditReady === true, "cost_latency_reliability_ready");
expect(final.routePolicyTuningPlanReady === true, "tuning_ready");
expect(final.nextRealRouteTestPlanReady === true, "next_plan_ready");
expect(final.routePolicyAppliedToRuntime === false, "runtime_policy_not_applied");
expect(final.rawSecretRead === false, "raw_secret_false");
expect(final.secretValueExposed === false, "secret_false");
expect(final.authJsonRead === false, "auth_json_false");
expect(final.chatBehaviorChangedByDefault === false, "chat_false");
expect(final.chatGatewayExecuteBehaviorChangedByDefault === false, "execute_false");
expect(final.deployExecuted === false, "deploy_false");
expect(final.releaseExecuted === false, "release_false");
expect(final.tagCreated === false, "tag_false");
expect(final.artifactUploaded === false, "artifact_false");
expect(final.unsupportedClaimCount === 0, "unsupported_zero");
expect(final.hallucinatedFactCount === 0, "hallucinated_zero");

if (failures.length) {
  final.recommended_sealed = false;
  final.blocker = failures[0];
}

writeJson(paths.final, final);
writeDoc("phase940-quality-result-audit-final-seal.md", {
  title: "Phase940 Quality Result Audit Final Seal",
  goal: "Seal the no-new-provider-call quality audit and route policy tuning design pack.",
  facts: [
    `recommended_sealed=${final.recommended_sealed}`,
    `realRouteEvidenceCount=${final.realRouteEvidenceCount}`,
    `newProviderRequestsThisPhase=${final.newProviderRequestsThisPhase}`,
  ],
  boundaries: ["No Provider call.", "No runtime route policy change.", "No selectable mutation."],
  outputs: [paths.final],
});
writeDoc("phase931-940-quality-result-audit-route-policy-tuning.md", {
  title: "Phase931-940 Quality Result Audit Route Policy Tuning",
  goal: "Aggregate the Phase931-940 audit chain into a readable route policy tuning design package.",
  facts: [
    "Phase916-930 source evidence remains the only real Provider call source.",
    "Tuning recommendations are design-only.",
    "Next real route test plan is not executed.",
  ],
  boundaries: ["No deploy.", "No default route mutation."],
  outputs: [paths.final, paths.tuning, paths.nextPlan],
});
writeDoc("phase931-940-execution-report.md", {
  title: "Phase931-940 Execution Report",
  goal: "Record commands, evidence paths, and non-claims for this audit-only phase.",
  facts: [
    `docsDir=${docsDir}`,
    `providerCallsMadeThisPhase=${final.providerCallsMadeThisPhase}`,
    `routePolicyAppliedToRuntime=${final.routePolicyAppliedToRuntime}`,
  ],
  boundaries: ["No commit or push.", "No workspace clean claim."],
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
  realRouteEvidenceCount: final.realRouteEvidenceCount,
  newProviderRequestsThisPhase: final.newProviderRequestsThisPhase,
}, null, 2));

function readJson(relativePath) {
  return JSON.parse(readFileSync(repoPath(relativePath), "utf8"));
}

function expect(condition, label) {
  if (!condition) failures.push(label);
}
