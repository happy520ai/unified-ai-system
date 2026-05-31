import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2063-GVC-Controlled-Direct-Use-Run";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2063-gvc-controlled-direct-use-run";
const resultPath = `${evidenceDir}/result.json`;
const command = "pnpm run gvc:timed-runner -- --intervalMs=30000 --dailyLoopLimit=20 --maxTasksPerLoop=1 --dryRunOnly=false --phase=2063";

const state = readJson("docs/project-brain/timed-runner-state.json") || {};
const stateDate = state.date || null;
const loopCount = Number(state.loopsCompletedToday || 0);
const loopEvidenceRefs = [];
const copiedLoopEvidenceRefs = [];
const loops = [];

for (let index = 1; stateDate && index <= loopCount; index += 1) {
  const ref = `apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner/loop-${stateDate}-${index}.json`;
  const loop = readJson(ref);
  if (loop) {
    loopEvidenceRefs.push(ref);
    const copiedRef = `${evidenceDir}/loop-snapshots/loop-${stateDate}-${index}.json`;
    writeJson(copiedRef, {
      ...loop,
      phase2063RunId: "phase2063-controlled-direct-use",
      copiedFrom: ref,
    });
    copiedLoopEvidenceRefs.push(copiedRef);
    loops.push(loop);
  }
}

const realMutationLoops = loops.filter((loop) => loop.realExecutionPerformed === true);
const blockedLoops = loops.filter((loop) => ["blocked", "stopped"].includes(loop.status));
const rollbackLoops = loops.filter((loop) => loop.mutationResult?.rollbackPerformed === true);
const rollbackFailedLoops = loops.filter((loop) => loop.mutationResult?.rollbackSucceeded === false);
const skippedApprovalRequiredCount = loops.reduce((total, loop) => total + (loop.skippedApprovalRequiredTasks?.length || 0), 0);
const permissionEngineParticipated = loops.length > 0 && loops.every((loop) => loop.finalPermissionGate?.permissionEnforcementLimitedActivation === true);
const safetyViolation =
  loops.some((loop) =>
    loop.providerCallsMade === true ||
    loop.secretRead === true ||
    loop.deployExecuted === true ||
    loop.chatModified === true ||
    loop.chatGatewayExecuteModified === true ||
    loop.legacyModified === true ||
    loop.projectContextModified === true
  );

let blocker = "none";
if (loopCount < 1) blocker = "direct_use_run_not_executed";
if (loopCount >= 1 && realMutationLoops.length < 1) blocker = "real_low_risk_mutation_not_executed";
if (rollbackFailedLoops.length > 0) blocker = "rollback_failed";
if (safetyViolation) blocker = "safety_boundary_violation";

const result = {
  phaseId,
  completed: blocker === "none",
  status: blocker === "none" ? "passed" : "failed",
  recommendedSealed: blocker === "none",
  blocker,
  generatedAt: new Date().toISOString(),
  command,
  directUseRunStarted: loopCount > 0,
  directUseRunCompleted: loopCount > 0,
  runnerExecuted: loopCount > 0,
  permissionEngineParticipated,
  stateDate,
  loopCount,
  realMutationLoopCount: realMutationLoops.length,
  blockedLoopCount: blockedLoops.length,
  skippedApprovalRequiredCount,
  rollbackCount: rollbackLoops.length,
  rollbackFailedCount: rollbackFailedLoops.length,
  stoppedReason: state.currentBlocker || "none",
  loopEvidenceRefs,
  copiedLoopEvidenceRefs,
  lastLoopEvidenceRef: state.lastLoopEvidenceRef || null,
  realMutationFiles: Array.from(new Set(realMutationLoops.flatMap((loop) => loop.mutationResult?.mutatedFiles || []))),
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  realMutationAuthorityExpanded: loops.some((loop) => loop.finalPermissionGate?.realMutationPermissionExpanded === true),
  permissionEngineCanIndependentlyAllow: loops.some((loop) => loop.finalPermissionGate?.permissionEngineCanIndependentlyAllow === true),
  workspaceCleanClaimed: false,
};

writeJson(resultPath, result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  loopCount: result.loopCount,
  realMutationLoopCount: result.realMutationLoopCount,
  blockedLoopCount: result.blockedLoopCount,
}, null, 2));
if (blocker !== "none") process.exit(1);

function readJson(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
