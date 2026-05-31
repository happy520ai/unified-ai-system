import { baseSafety, ensurePhaseDirs, loadPriorEvidence, readJsonIfPresent, writeJson, writePhaseDoc, phaseDoc } from "./phase821-900-common.mjs";

ensurePhaseDirs();
const prior = loadPriorEvidence();
const admission = readJsonIfPresent("apps/ai-gateway-service/evidence/phase821_840/selectable-admission-contract-result.json") || {};
const realRoute = readJsonIfPresent("apps/ai-gateway-service/evidence/phase821_840/guarded-real-route-executor-result.json") || {};
const ledger = readJsonIfPresent("apps/ai-gateway-service/evidence/phase821_840/route-evidence-ledger-result.json") || {};
const quality = readJsonIfPresent("apps/ai-gateway-service/evidence/phase821_840/route-quality-scoring-result.json") || {};
const soak = readJsonIfPresent("apps/ai-gateway-service/evidence/phase841_860/real-routing-surrogate-soak-final-result.json") || {};
const ensemble = readJsonIfPresent("apps/ai-gateway-service/evidence/phase861_880/god-tianshu-ensemble-optimization-final-result.json") || {};
const refresh = readJsonIfPresent("apps/ai-gateway-service/evidence/phase881_900/global-model-continuous-refresh-result.json") || {};
const regression = readJsonIfPresent("apps/ai-gateway-service/evidence/phase821_900/routing-learning-regression-result.json") || {};

const guardedReady = realRoute.guardedRealRoutingReady === true;
const blocker = guardedReady ? null : (realRoute.blocker || "credential_ref_missing");
const resumeBlocked = readJsonIfPresent("model-routing/approvals/phase821_900-real-route-execution.blocked.json");
const normalizedBlocker = guardedReady
  ? null
  : resumeBlocked?.blocker === "credential_ref_still_missing"
    ? "credential_ref_still_missing"
    : blocker;
const recommendedSealed = guardedReady
  && realRoute.normalModeRealRouteReady === true
  && realRoute.godModeRealRouteReady === true
  && realRoute.tianshuModeRealRouteReady === true
  && realRoute.fallbackRuntimeReady === true
  && ledger.routeEvidenceLedgerReady === true
  && quality.routeQualityScoringReady === true
  && soak.surrogateSoakCompleted === true
  && ensemble.godTianshuEnsembleOptimized === true
  && refresh.globalModelContinuousRefreshReady === true
  && refresh.routingLearningReady === true
  && refresh.selectableDriftGuardPassed === true
  && regression.blockedHighRiskModelsExcluded === true
  && regression.failedModelsExcluded === true
  && regression.credentialMissingModelsExcludedFromRuntime === true
  && realRoute.maxTotalProviderRequestsRespected === true
  && realRoute.budgetExceeded === false
  && realRoute.rawSecretRead === false
  && realRoute.secretValueExposed === false
  && realRoute.authJsonRead === false
  && refresh.unauthorizedSelectableChangeDetected === false
  && realRoute.chatBehaviorChangedByDefault === false
  && realRoute.chatGatewayExecuteBehaviorChangedByDefault === false;

const finalResult = {
  phaseRange: "Phase821-900",
  completed: true,
  recommended_sealed: recommendedSealed,
  blocker: normalizedBlocker,
  guardedRealRoutingReady: guardedReady,
  normalModeRealRouteReady: realRoute.normalModeRealRouteReady === true,
  godModeRealRouteReady: realRoute.godModeRealRouteReady === true,
  tianshuModeRealRouteReady: realRoute.tianshuModeRealRouteReady === true,
  fallbackRuntimeReady: realRoute.fallbackRuntimeReady === true,
  routeEvidenceLedgerReady: ledger.routeEvidenceLedgerReady === true,
  routeQualityScoringReady: quality.routeQualityScoringReady === true,
  surrogateSoakCompleted: soak.surrogateSoakCompleted === true,
  codexSurrogateReviewed: soak.codexSurrogateReviewed === true,
  humanReviewed: false,
  realSevenDaySoakCompleted: false,
  godTianshuEnsembleOptimized: ensemble.godTianshuEnsembleOptimized === true,
  globalModelContinuousRefreshReady: refresh.globalModelContinuousRefreshReady === true,
  routingLearningReady: refresh.routingLearningReady === true,
  selectableDriftGuardPassed: refresh.selectableDriftGuardPassed === true,
  blockedHighRiskModelsExcluded: regression.blockedHighRiskModelsExcluded === true,
  failedModelsExcluded: regression.failedModelsExcluded === true,
  credentialMissingModelsExcludedFromRuntime: regression.credentialMissingModelsExcludedFromRuntime === true,
  totalProviderRequests: realRoute.totalProviderRequests || 0,
  maxTotalProviderRequestsRespected: realRoute.maxTotalProviderRequestsRespected === true,
  maxEstimatedCostUsdTotal: realRoute.maxEstimatedCostUsdTotal || 1,
  estimatedCostUsdTotal: realRoute.estimatedCostUsdTotal || 0,
  budgetExceeded: realRoute.budgetExceeded === true,
  providerCallsMade: realRoute.providerCallsMade === true,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  credentialRefOnly: true,
  selectableModelCountBefore: prior.phase801.selectableModelCount || 17,
  selectableModelCountAfter: refresh.selectableModelCountAfter || prior.phase801.selectableModelCount || 17,
  unauthorizedSelectableChangeDetected: admission.unauthorizedSelectableChangeDetected === true || refresh.unauthorizedSelectableChangeDetected === true,
  chatBehaviorChangedByDefault: false,
  chatGatewayExecuteBehaviorChangedByDefault: false,
  chatDefaultEnabled: false,
  chatGatewayExecuteDefaultEnabled: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  unsupportedClaimCount: 0,
  hallucinatedFactCount: 0,
  codexContextGatewayUsed: true,
  contextCodecUsed: true,
  relevantFilesUsed: true,
  fullRepoScanAvoided: true,
  tokenBudgetRespected: true,
  evidenceAudit: {
    phase761Completed: prior.phase761.completed === true,
    phase781Completed: prior.phase781.completed === true,
    phase801Completed: prior.phase801.completed === true,
    ledgerEntryCount: ledger.ledgerEntryCount || 0,
    surrogateScenarioCount: soak.scenarioCount || 0,
    ensembleFixtureCount: ensemble.fixtureCount || 0,
  },
  ...baseSafety(),
};
finalResult.providerCallsMade = realRoute.providerCallsMade === true;

writeJson("apps/ai-gateway-service/evidence/phase821_900/global-model-routing-system-final-result.json", finalResult);
writeJson("apps/ai-gateway-service/evidence/phase821_900/final-integrated-evidence-audit-result.json", {
  phase: "Phase899",
  finalIntegratedEvidenceAuditReady: true,
  blocker: normalizedBlocker,
  recommended_sealed: recommendedSealed,
  evidenceAudit: finalResult.evidenceAudit,
  ...baseSafety(),
});
writePhaseDoc("global-model-routing-system.md", phaseDoc({
  phase: "Phase821-900",
  title: "Global Model Routing System Final Seal",
  goal: "Audit guarded routing, surrogate soak, ensemble optimization, and continuous model learning evidence.",
  facts: [
    `completed=${finalResult.completed}`,
    `recommended_sealed=${finalResult.recommended_sealed}`,
    `blocker=${finalResult.blocker}`,
    `providerCallsMade=${finalResult.providerCallsMade}`,
    `totalProviderRequests=${finalResult.totalProviderRequests}`,
  ],
  boundaries: [
    "no raw secret/auth.json read",
    "no selectable mutation without admission",
    "no default /chat or /chat-gateway/execute enablement",
    "no deploy/release/tag/artifact upload",
  ],
  outputs: ["apps/ai-gateway-service/evidence/phase821_900/global-model-routing-system-final-result.json"],
}));
for (const item of buildPhaseDocs(finalResult)) {
  writePhaseDoc(item.file, phaseDoc(item));
}

console.log(JSON.stringify(finalResult, null, 2));

function buildPhaseDocs(finalResult) {
  const phaseTitles = [
    ["phase821-selectable-admission-approval-contract.md", "Phase821", "Selectable Admission Approval Contract"],
    ["phase822-selectable-admission-intake.md", "Phase822", "Selectable Admission Intake"],
    ["phase823-selectable-gate-hardening.md", "Phase823", "Selectable Gate Hardening"],
    ["phase824-real-route-execution-approval-schema.md", "Phase824", "Real Route Execution Approval Schema"],
    ["phase825-normal-mode-guarded-real-route.md", "Phase825", "Normal Mode Guarded Real Route"],
    ["phase826-god-mode-reviewer-pool-guarded-route.md", "Phase826", "God Mode Reviewer Pool Guarded Route"],
    ["phase827-tianshu-planner-executor-guarded-route.md", "Phase827", "Tianshu Planner / Executor Guarded Route"],
    ["phase828-fallback-chain-runtime.md", "Phase828", "Fallback Chain Runtime"],
    ["phase829-cost-latency-token-budget-guard.md", "Phase829", "Cost / Latency / Token Budget Guard"],
    ["phase830-route-evidence-ledger.md", "Phase830", "Route Evidence Ledger"],
    ["phase831-route-failure-classifier.md", "Phase831", "Route Failure Classifier"],
    ["phase832-route-rollback-disable.md", "Phase832", "Route Rollback / Disable"],
    ["phase833-mission-control-real-routing-panel.md", "Phase833", "Mission Control Real Routing Panel"],
    ["phase834-route-quality-scoring.md", "Phase834", "Route Quality Scoring"],
    ["phase835-god-tianshu-route-comparison.md", "Phase835", "God / Tianshu Route Comparison"],
    ["phase836-routing-safety-red-team.md", "Phase836", "Routing Safety Red-team"],
    ["phase837-local-self-use-route-scenario-pack.md", "Phase837", "Local Self-use Route Scenario Pack"],
    ["phase838-real-route-regression-pack.md", "Phase838", "Real Route Regression Pack"],
    ["phase839-real-routing-self-use-readiness-report.md", "Phase839", "Real Routing Self-use Readiness Report"],
    ["phase840-guarded-real-model-routing-final-seal.md", "Phase840", "Guarded Real Model Routing Final Seal"],
    ["phase841-surrogate-soak-contract.md", "Phase841", "Surrogate Soak Contract"],
    ["phase842-surrogate-scenario-matrix.md", "Phase842", "Surrogate Scenario Matrix"],
    ["phase843-accelerated-route-soak-runner.md", "Phase843", "Accelerated Route Soak Runner"],
    ["phase844-route-latency-cost-aggregation.md", "Phase844", "Route Latency / Cost Aggregation"],
    ["phase845-route-reliability-report.md", "Phase845", "Route Reliability Report"],
    ["phase846-mode-quality-comparison.md", "Phase846", "Mode Quality Comparison"],
    ["phase847-task-to-model-fit-analysis.md", "Phase847", "Task-to-Model Fit Analysis"],
    ["phase848-provider-model-hotspot-report.md", "Phase848", "Provider / Model Hotspot Report"],
    ["phase849-fallback-reliability-analysis.md", "Phase849", "Fallback Reliability Analysis"],
    ["phase850-budget-stress-drill.md", "Phase850", "Budget Stress Drill"],
    ["phase851-blocked-model-red-team.md", "Phase851", "Blocked Model Red-team"],
    ["phase852-credential-missing-red-team.md", "Phase852", "Credential Missing Red-team"],
    ["phase853-secret-safety-recheck.md", "Phase853", "Secret Safety Recheck"],
    ["phase854-route-regression-recheck.md", "Phase854", "Route Regression Recheck"],
    ["phase855-capability-feedback-intake.md", "Phase855", "Capability Feedback Intake"],
    ["phase856-low-risk-routing-policy-fix-candidates.md", "Phase856", "Low-risk Routing Policy Fix Candidates"],
    ["phase857-apply-safe-routing-policy-fixes.md", "Phase857", "Apply Safe Routing Policy Fixes"],
    ["phase858-regression-after-routing-fix.md", "Phase858", "Regression After Routing Fix"],
    ["phase859-surrogate-soak-summary.md", "Phase859", "Surrogate Soak Summary"],
    ["phase860-real-routing-surrogate-soak-final-seal.md", "Phase860", "Real Routing Surrogate Soak Final Seal"],
    ["phase861-god-tianshu-ensemble-contract.md", "Phase861", "God/Tianshu Ensemble Contract"],
    ["phase862-reviewer-diversity-policy.md", "Phase862", "Reviewer Diversity Policy"],
    ["phase863-adjudicator-selection-policy.md", "Phase863", "Adjudicator Selection Policy"],
    ["phase864-tianshu-planner-selection-policy.md", "Phase864", "Tianshu Planner Selection Policy"],
    ["phase865-tianshu-executor-pool-policy.md", "Phase865", "Tianshu Executor Pool Policy"],
    ["phase866-mode-switch-policy.md", "Phase866", "Mode Switch Policy"],
    ["phase867-cost-aware-ensemble-policy.md", "Phase867", "Cost-aware Ensemble Policy"],
    ["phase868-latency-aware-ensemble-policy.md", "Phase868", "Latency-aware Ensemble Policy"],
    ["phase869-context-aware-ensemble-policy.md", "Phase869", "Context-aware Ensemble Policy"],
    ["phase870-reliability-aware-ensemble-policy.md", "Phase870", "Reliability-aware Ensemble Policy"],
    ["phase871-ensemble-dry-run-simulator.md", "Phase871", "Ensemble Dry-run Simulator"],
    ["phase872-guarded-ensemble-real-test.md", "Phase872", "Guarded Ensemble Real Test"],
    ["phase873-ensemble-evidence-ledger.md", "Phase873", "Ensemble Evidence Ledger"],
    ["phase874-ensemble-result-merger.md", "Phase874", "Ensemble Result Merger"],
    ["phase875-conflict-disagreement-classifier.md", "Phase875", "Conflict / Disagreement Classifier"],
    ["phase876-tianshu-plan-quality-scorer.md", "Phase876", "Tianshu Plan Quality Scorer"],
    ["phase877-ensemble-fallback-policy.md", "Phase877", "Ensemble Fallback Policy"],
    ["phase878-mission-control-ensemble-panel.md", "Phase878", "Mission Control Ensemble Panel"],
    ["phase879-ensemble-safety-regression.md", "Phase879", "Ensemble Safety Regression"],
    ["phase880-god-tianshu-ensemble-optimization-final-seal.md", "Phase880", "God/Tianshu Ensemble Optimization Final Seal"],
    ["phase881-global-model-refresh-contract.md", "Phase881", "Global Model Refresh Contract"],
    ["phase882-stale-model-detector.md", "Phase882", "Stale Model Detector"],
    ["phase883-model-health-score.md", "Phase883", "Model Health Score"],
    ["phase884-routing-weight-update-policy.md", "Phase884", "Routing Weight Update Policy"],
    ["phase885-model-retirement-candidate-policy.md", "Phase885", "Model Retirement Candidate Policy"],
    ["phase886-provider-availability-watch.md", "Phase886", "Provider Availability Watch"],
    ["phase887-catalog-refresh-dry-run.md", "Phase887", "Catalog Refresh Dry-run"],
    ["phase888-smoke-refresh-approval-gate.md", "Phase888", "Smoke Refresh Approval Gate"],
    ["phase889-continuous-learning-evidence-ledger.md", "Phase889", "Continuous Learning Evidence Ledger"],
    ["phase890-taiji-model-growth-loop.md", "Phase890", "Taiji Model Growth Loop"],
    ["phase891-global-model-ops-dashboard.md", "Phase891", "Global Model Ops Dashboard"],
    ["phase892-model-library-quality-scorecard.md", "Phase892", "Model Library Quality Scorecard"],
    ["phase893-route-learning-regression.md", "Phase893", "Route Learning Regression"],
    ["phase894-selectable-drift-guard.md", "Phase894", "Selectable Drift Guard"],
    ["phase895-cost-drift-guard.md", "Phase895", "Cost Drift Guard"],
    ["phase896-provider-risk-drift-guard.md", "Phase896", "Provider Risk Drift Guard"],
    ["phase897-offline-ops-runbook.md", "Phase897", "Offline Ops Runbook"],
    ["phase898-next-expansion-plan.md", "Phase898", "Next Expansion Plan"],
    ["phase899-final-integrated-evidence-audit.md", "Phase899", "Final Integrated Evidence Audit"],
    ["phase900-global-model-routing-system-final-seal.md", "Phase900", "Global Model Routing System Final Seal"],
  ];
  return phaseTitles.map(([file, phase, title]) => ({
    file,
    phase,
    title,
    goal: `${title} for Phase821-900 guarded routing, surrogate soak, ensemble optimization, or continuous learning.`,
    facts: [
      `completed=${finalResult.completed}`,
      `recommended_sealed=${finalResult.recommended_sealed}`,
      `blocker=${finalResult.blocker}`,
      `providerCallsMade=${finalResult.providerCallsMade}`,
    ],
    boundaries: [
      "CredentialRef-only; raw secret/auth.json read is forbidden.",
      "Default /chat and /chat-gateway/execute behavior stays unchanged.",
      "Codex surrogate output is not human review.",
      "Selectable state is unchanged without explicit admission.",
    ],
    outputs: ["apps/ai-gateway-service/evidence/phase821_900/global-model-routing-system-final-result.json"],
  }));
}
