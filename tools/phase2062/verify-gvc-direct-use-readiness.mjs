import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2062-GVC-Direct-Use-Readiness-Gate";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2062-gvc-direct-use-readiness-gate";
const resultPath = `${evidenceDir}/result.json`;
const docsPath = "docs/phase2062-gvc-direct-use-readiness-gate.md";
const packageScriptName = "verify:phase2062-gvc-direct-use-readiness-gate";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const approval = readJson("docs/approvals/gvc-low-risk-autonomous-mutation-approval.json");
const runnerControl = readJson("docs/project-brain/runner-control.json");
const safePolicy = readJson("docs/project-brain/safe-overnight-policy.json");
const taskQualityPolicy = readJson("docs/project-brain/task-quality-policy.json");
const nextActions = readJson("docs/project-brain/next-actions.json");
const wiringResult = readJson("apps/ai-gateway-service/evidence/phase2061-gvc-full-wiring-verification/result.json");
const phase2058 = readJson("apps/ai-gateway-service/evidence/phase2058-gvc-permission-enforcement-limited-activation/result.json");
const phase2040 = readJson("apps/ai-gateway-service/evidence/phase2040-gvc-runaway-guard/runaway-guard-result.json");
const phase2041 = readJson("apps/ai-gateway-service/evidence/phase2041-gvc-daily-cap-enforcer/daily-cap-enforcer-result.json");

const lowRiskApprovalPresent =
  approval?.approved === true &&
  approval?.scope === "low_risk_only" &&
  approval?.providerAllowed === false &&
  approval?.secretReadAllowed === false &&
  approval?.deployAllowed === false &&
  approval?.chatRouteModificationAllowed === false &&
  approval?.legacyModificationAllowed === false &&
  approval?.projectContextModificationAllowed === false;
const runnerControlReady =
  runnerControl?.paused === false &&
  runnerControl?.stopRequested === false &&
  runnerControl?.dryRunOnly === true &&
  runnerControl?.noProvider === true &&
  runnerControl?.noSecret === true &&
  runnerControl?.noDeploy === true &&
  runnerControl?.maxTasksPerLoop === 1;
const permissionLimitedActivation =
  phase2058?.permissionEnforcementLimitedActivation === true &&
  phase2058?.permissionEngineParticipatesBeforeRealMutation === true &&
  phase2058?.realMutationPermissionExpanded === false;
const safetyBoundaryBlocked =
  approval?.providerAllowed === false &&
  approval?.secretReadAllowed === false &&
  approval?.deployAllowed === false &&
  approval?.chatRouteModificationAllowed === false &&
  safePolicy?.providerCallsMade === false &&
  safePolicy?.secretRead === false &&
  safePolicy?.deployExecuted === false &&
  safePolicy?.chatGatewayExecuteModified === false;
const dailyCapsPresent =
  safePolicy?.dailyLoopLimit === 500 &&
  safePolicy?.realMutationLoopLimit === 30 &&
  approval?.dailyRealExecutionLoopLimit === 100;
const rollbackEnabled =
  approval?.rollbackRequired === true &&
  safePolicy?.stopConditions?.rollbackFailureLimit === 0;
const runawayGuardEnabled =
  safePolicy?.stopConditions?.sameFileTouchLimitPerDay === 3 &&
  safePolicy?.stopConditions?.consecutiveVerifierFailLimit === 2 &&
  phase2040 !== null;
const qualityGateEnabled =
  taskQualityPolicy?.recommendedActions?.allow === "allow" &&
  Array.isArray(nextActions?.actions) &&
  nextActions.actions.every((action) => {
    const recommendedAction = action.quality?.recommendedAction;
    return (
      recommendedAction === "allow" ||
      recommendedAction === "forbidden" ||
      action.status === "approval_required"
    );
  }) &&
  Array.isArray(nextActions?.rejectedByQualityGate);
const noOpGuardEnabled = safePolicy?.stopConditions?.consecutiveNoOpLimit === 3;

check("package_script_registered", packageJson.scripts?.[packageScriptName] === "node tools/phase2062/verify-gvc-direct-use-readiness.mjs");
check("docs_file_exists", existsSync(resolve(docsPath)));
check("wiring_passed", wiringResult?.allCriticalWiringPassed === true);
check("low_risk_approval_present", lowRiskApprovalPresent);
check("runner_control_ready", runnerControlReady);
check("permission_limited_activation", permissionLimitedActivation);
check("provider_secret_deploy_chat_blocked", safetyBoundaryBlocked);
check("daily_caps_present", dailyCapsPresent);
check("rollback_enabled", rollbackEnabled);
check("runaway_guard_enabled", runawayGuardEnabled);
check("daily_cap_enforcer_evidence_present", phase2041 !== null);
check("quality_gate_enabled", qualityGateEnabled);
check("no_op_guard_enabled", noOpGuardEnabled);
check("formal_command_is_real_low_risk", packageJson.scripts?.["gvc:timed-runner"] === "node tools/gvc/run-timed-local-runner.mjs");

const failed = checks.filter((entry) => !entry.pass);
const readinessPassed = failed.length === 0;
const result = {
  phaseId,
  completed: readinessPassed,
  status: readinessPassed ? "passed" : "failed",
  recommendedSealed: readinessPassed,
  blocker: readinessPassed ? "none" : "direct_use_readiness_failed",
  generatedAt: new Date().toISOString(),
  directUseReadinessPassed: readinessPassed,
  lowRiskApprovalPresent,
  runnerPaused: runnerControl?.paused === true,
  runnerStopRequested: runnerControl?.stopRequested === true,
  permissionEnforcementLimitedActivation: permissionLimitedActivation,
  providerSecretDeployChatBlocked: safetyBoundaryBlocked,
  dailyCapsPresent,
  rollbackEnabled,
  runawayGuardEnabled,
  qualityGateEnabled,
  noOpGuardEnabled,
  formalStartCommand: "pnpm run gvc:timed-runner -- --intervalMs=30000 --dailyLoopLimit=500 --maxTasksPerLoop=1 --dryRunOnly=false",
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  checks,
};

writeJson(resultPath, result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  directUseReadinessPassed: result.directUseReadinessPassed,
}, null, 2));
if (!readinessPassed) process.exit(1);

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readJson(relativePath) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
