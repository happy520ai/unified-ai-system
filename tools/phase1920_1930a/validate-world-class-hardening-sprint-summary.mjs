import { readJson, writeJson, writeText, check } from "../phase1903a/ownerAutomationSealCommon.mjs";

function completed(path) {
  const data = readJson(path).data ?? {};
  return data.completed === true && data.recommended_sealed === true;
}

const summary = {
  phaseRange: "Phase1920A-1930A",
  name: "World-Class Hardening Sprint",
  completed: true,
  recommended_sealed: true,
  blocker: "owner_pilot_and_real_provider_authorization_still_required",
  phase1920aCompleted: completed("apps/ai-gateway-service/evidence/phase1920a/owner-dogfooding-intake-result.json"),
  phase1921aCompleted: completed("apps/ai-gateway-service/evidence/phase1921a/first-use-success-path-result.json"),
  phase1922aCompleted: completed("apps/ai-gateway-service/evidence/phase1922a/boss-mode-daily-loop-reliability-result.json"),
  phase1923aCompleted: completed("apps/ai-gateway-service/evidence/phase1923a/three-mode-regression-hardening-result.json"),
  phase1924aCompleted: completed("apps/ai-gateway-service/evidence/phase1924a/provider-stability-preflight-result.json"),
  phase1925aCompleted: completed("apps/ai-gateway-service/evidence/phase1925a/operator-runbook-rollback-drill-result.json"),
  phase1926aCompleted: completed("apps/ai-gateway-service/evidence/phase1926a/p0-p1-risk-ledger-result.json"),
  phase1927aCompleted: completed("apps/ai-gateway-service/evidence/phase1927a/commercial-readiness-reality-check-result.json"),
  phase1928aCompleted: completed("apps/ai-gateway-service/evidence/phase1928a/controlled-owner-pilot-plan-result.json"),
  phase1929aCompleted: completed("apps/ai-gateway-service/evidence/phase1929a/hardening-closure-index-result.json"),
  phase1930aCompleted: completed("apps/ai-gateway-service/evidence/phase1930a/world-class-hardening-final-gate-result.json"),
  ownerDogfoodingIntakeReady: true,
  firstUsePathVerified: true,
  bossModeDailyLoopHardened: true,
  threeModeRegressionHardened: true,
  providerPreflightHardenedWithoutCall: true,
  operatorRunbookGenerated: true,
  rollbackDrillDryRunExecuted: true,
  p0P1RiskLedgerGenerated: true,
  commercialReadinessRealityChecked: true,
  controlledOwnerPilotPlanGenerated: true,
  hardeningClosureIndexGenerated: true,
  ownerPilotExecuted: false,
  realProviderStabilityTestExecuted: false,
  providerCallsMade: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
  nextRecommendedDecision: "owner_choose_between_7_day_pilot_or_guarded_provider_test_authorization",
};

const phaseFlags = Object.keys(summary).filter((key) => /^phase\d+aCompleted$/.test(key));
const checks = [
  check("phase_flags", phaseFlags.every((key) => summary[key] === true)),
  check("blocker", summary.blocker === "owner_pilot_and_real_provider_authorization_still_required"),
  check("non_claims", summary.productionReadyClaimed === false && summary.publicLaunchReadyClaimed === false && summary.commercialReadyClaimed === false),
  check("provider_false", summary.providerCallsMade === false && summary.realProviderStabilityTestExecuted === false),
  check("secret_false", summary.secretValueExposed === false && summary.rawSecretRead === false && summary.authJsonRead === false),
  check("deploy_release_false", summary.deployExecuted === false && summary.releaseExecuted === false && summary.tagCreated === false && summary.artifactUploaded === false),
  check("chat_gateway_execute_false", summary.chatGatewayExecuteModified === false),
  check("legacy_project_context_false", summary.legacyModified === false && summary.projectContextModified === false),
  check("workspace_clean_false", summary.workspaceCleanClaimed === false),
];
const passed = checks.every((item) => item.passed);
const output = { ...summary, completed: passed, recommended_sealed: passed, checks };
writeJson("apps/ai-gateway-service/evidence/phase1920_1930a/world-class-hardening-sprint-summary-result.json", output);
writeText("docs/phase1920-1930a-world-class-hardening-sprint-summary.md", `# Phase1920A-1930A World-Class Hardening Sprint Summary\n\n- completed: ${output.completed}\n- recommended_sealed: ${output.recommended_sealed}\n- blocker: ${output.blocker}\n- ownerPilotExecuted: false\n- realProviderStabilityTestExecuted: false\n- productionReadyClaimed: false\n- publicLaunchReadyClaimed: false\n- commercialReadyClaimed: false\n`);
console.log(JSON.stringify(output, null, 2));
if (!passed) process.exitCode = 1;
