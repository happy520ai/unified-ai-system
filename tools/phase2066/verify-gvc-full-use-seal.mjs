import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2066-GVC-Full-Use-Seal";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2066-gvc-full-use-seal";
const resultPath = `${evidenceDir}/result.json`;
const docsPath = "docs/phase2066-gvc-full-use-seal.md";
const ownerGuidePath = "docs/phase2065-gvc-owner-direct-use-guide.md";
const packageScriptName = "verify:phase2066-gvc-full-use-seal";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase2060 = readJson("apps/ai-gateway-service/evidence/phase2060-gvc-timed-runner-real-batch/result.json");
const phase2061 = readJson("apps/ai-gateway-service/evidence/phase2061-gvc-full-wiring-verification/result.json");
const phase2062 = readJson("apps/ai-gateway-service/evidence/phase2062-gvc-direct-use-readiness-gate/result.json");
const phase2063 = readJson("apps/ai-gateway-service/evidence/phase2063-gvc-controlled-direct-use-run/result.json");
const phase2064 = readJson("apps/ai-gateway-service/evidence/phase2064-gvc-direct-use-audit/result.json");

const completedPhases = [
  phase2060?.completed === true ? "Phase2060" : null,
  phase2061?.completed === true ? "Phase2061" : null,
  phase2062?.completed === true ? "Phase2062" : null,
  phase2063?.directUseRunCompleted === true ? "Phase2063" : null,
  phase2064?.completed === true ? "Phase2064" : null,
  existsSync(resolve(ownerGuidePath)) ? "Phase2065" : null,
].filter(Boolean);
const wiringVerified = phase2061?.allCriticalWiringPassed === true;
const directUseReadinessPassed = phase2062?.directUseReadinessPassed === true;
const directUseRunExecuted = phase2063?.directUseRunStarted === true && phase2063?.directUseRunCompleted === true;
const directUseRunLoopCount = Number(phase2063?.loopCount || 0);
const realMutationLoopCount = Number(phase2063?.realMutationLoopCount || 0);
const blockedLoopCount = Number(phase2063?.blockedLoopCount || 0);
const rollbackCount = Number(phase2063?.rollbackCount || 0);
const rollbackFailedCount = Number(phase2063?.rollbackFailedCount || 0);
const autonomousRunnerUsable =
  wiringVerified &&
  directUseReadinessPassed &&
  directUseRunExecuted &&
  realMutationLoopCount > 0 &&
  rollbackFailedCount === 0 &&
  phase2064?.completed === true;

check("package_script_registered", packageJson.scripts?.[packageScriptName] === "node tools/phase2066/verify-gvc-full-use-seal.mjs");
check("docs_file_exists", existsSync(resolve(docsPath)));
check("owner_guide_exists", existsSync(resolve(ownerGuidePath)));
check("phase2060_passed", phase2060?.completed === true);
check("phase2061_wiring_verified", wiringVerified);
check("phase2062_readiness_passed", directUseReadinessPassed);
check("phase2063_direct_use_run_executed", directUseRunExecuted);
check("phase2063_real_mutation_executed", realMutationLoopCount > 0, String(realMutationLoopCount));
check("phase2064_audit_passed", phase2064?.completed === true);
check("rollback_failed_count_zero", rollbackFailedCount === 0, String(rollbackFailedCount));
check("provider_false", phase2063?.providerCallsMade === false && phase2064?.providerCallsMade === false);
check("secret_false", phase2063?.secretRead === false && phase2064?.secretRead === false);
check("deploy_false", phase2063?.deployExecuted === false && phase2064?.deployExecuted === false);
check("chat_false", phase2063?.chatModified === false && phase2063?.chatGatewayExecuteModified === false);
check("legacy_project_context_false", phase2063?.legacyModified === false && phase2063?.projectContextModified === false);
check("authority_not_expanded", phase2063?.realMutationAuthorityExpanded === false);
check("workspace_clean_not_claimed", phase2063?.workspaceCleanClaimed === false);

const failed = checks.filter((entry) => !entry.pass);
let blocker = "none";
if (failed.length > 0) blocker = failed.map((entry) => entry.id).join(", ");
if (!directUseRunExecuted) blocker = "direct_use_run_not_executed";
if (directUseRunExecuted && realMutationLoopCount < 1) blocker = "real_low_risk_mutation_not_executed";
if (phase2063?.providerCallsMade === true || phase2063?.secretRead === true || phase2063?.deployExecuted === true || phase2063?.chatGatewayExecuteModified === true) {
  blocker = "safety_boundary_violation";
}

const result = {
  phaseId,
  completed: failed.length === 0 && autonomousRunnerUsable,
  status: failed.length === 0 && autonomousRunnerUsable ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  completedPhases,
  wiringVerified,
  directUseReadinessPassed,
  directUseRunExecuted,
  directUseRunLoopCount,
  realMutationLoopCount,
  blockedLoopCount,
  rollbackCount,
  rollbackFailedCount,
  autonomousRunnerUsable,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  realMutationAuthorityExpanded: false,
  workspaceCleanClaimed: false,
  blocker,
  recommendedSealed: failed.length === 0 && autonomousRunnerUsable,
  formalStartCommand: "pnpm run gvc:timed-runner -- --intervalMs=30000 --dailyLoopLimit=500 --maxTasksPerLoop=1 --dryRunOnly=false",
  pauseResumeStop: {
    pause: "edit docs/project-brain/runner-control.json and set paused=true",
    resume: "edit docs/project-brain/runner-control.json and set paused=false",
    stop: "edit docs/project-brain/runner-control.json and set stopRequested=true, or press Ctrl+C in the runner terminal",
  },
  checks,
};

writeJson(resultPath, result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  autonomousRunnerUsable: result.autonomousRunnerUsable,
  realMutationLoopCount: result.realMutationLoopCount,
}, null, 2));
if (!result.recommendedSealed) process.exit(1);

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
