import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const statePath = path.join(repoRoot, "docs/project-brain/timed-runner-state.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function todayLocalDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loopEvidencePath(date, loopNumber) {
  return path.join(
    repoRoot,
    "apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner",
    `loop-${date}-${loopNumber}.json`,
  );
}

async function main() {
  const packageJson = readJson(path.join(repoRoot, "package.json"));
  assert(packageJson.scripts["gvc:timed-runner"], "missing gvc:timed-runner script");
  assert(packageJson.scripts["verify:phase2019-gvc-timed-local-runner"], "missing Phase2019 verify script");
  assert(existsSync(path.join(repoRoot, "tools/gvc/run-timed-local-runner.mjs")), "missing timed runner");
  assert(existsSync(path.join(repoRoot, "docs/phase2019-gvc-timed-local-runner-30s-dailycap.md")), "missing Phase2019 docs");
  assert(existsSync(statePath), "missing timed-runner-state.json");

  const state = readJson(statePath);
  const date = state.date || todayLocalDate();
  const phase2063ResultPath = path.join(
    repoRoot,
    "apps/ai-gateway-service/evidence/phase2063-gvc-controlled-direct-use-run/result.json",
  );
  const phase2063Result = existsSync(phase2063ResultPath) ? readJson(phase2063ResultPath) : null;
  const phase2062ResultPath = path.join(
    repoRoot,
    "apps/ai-gateway-service/evidence/phase2062-gvc-direct-use-readiness-gate/result.json",
  );
  const phase2062Result = existsSync(phase2062ResultPath) ? readJson(phase2062ResultPath) : null;
  const safeOvernightPolicyPath = path.join(repoRoot, "docs/project-brain/safe-overnight-policy.json");
  const safeOvernightPolicy = existsSync(safeOvernightPolicyPath) ? readJson(safeOvernightPolicyPath) : null;
  const controlledDirectUseState =
    state.dryRunOnly === false &&
    state.intervalMs === 30000 &&
    state.dailyLoopLimit === 20 &&
    phase2063Result?.directUseRunCompleted === true &&
    phase2063Result?.realMutationLoopCount >= 1 &&
    phase2063Result?.providerCallsMade === false &&
    phase2063Result?.secretRead === false &&
    phase2063Result?.deployExecuted === false &&
    phase2063Result?.chatGatewayExecuteModified === false;
  const controlledAutonomousUseState =
    state.dryRunOnly === false &&
    (state.intervalMs === 1000 || state.intervalMs === 30000) &&
    (state.dailyLoopLimit === 3 || state.dailyLoopLimit === 500) &&
    state.realExecutionLoopsCompletedToday >= 1 &&
    phase2062Result?.directUseReadinessPassed === true &&
    safeOvernightPolicy?.enabled === true &&
    safeOvernightPolicy?.realMutationLoopLimit === 30 &&
    state.providerCallsMade === false &&
    state.secretRead === false &&
    state.deployExecuted === false &&
    state.chatGatewayExecuteModified === false;
  const phase2063Refs = Array.isArray(phase2063Result?.copiedLoopEvidenceRefs) && phase2063Result.copiedLoopEvidenceRefs.length > 0
    ? phase2063Result.copiedLoopEvidenceRefs
    : Array.isArray(phase2063Result?.loopEvidenceRefs)
      ? phase2063Result.loopEvidenceRefs
      : [];
  assert(state.phaseId === "Phase2019-GVC-Timed-Local-Runner-30s-DailyCap", "state phaseId mismatch");
  assert(state.intervalMs === 1000 || state.intervalMs === 30000, "state intervalMs must be test or default value");
  assert(state.dailyLoopLimit === 3 || state.dailyLoopLimit === 20 || state.dailyLoopLimit === 500, "state dailyLoopLimit must be test, controlled direct-use, or default value");
  assert(state.maxTasksPerLoop === 1, "maxTasksPerLoop must be 1");
  assert(
    state.dryRunOnly === true || controlledDirectUseState || controlledAutonomousUseState,
    "dryRunOnly=false is allowed only for verified controlled direct-use or controlled autonomous state",
  );
  assert(state.windowsTaskSchedulerRegistered === false, "must not register Windows Task Scheduler");
  assert(state.startupAutoRunRegistered === false, "must not register startup auto-run");
  assert(state.providerCallsMade === false, "state providerCallsMade must be false");
  assert(state.secretRead === false, "state secretRead must be false");
  assert(state.deployExecuted === false, "state deployExecuted must be false");
  assert(state.chatGatewayExecuteModified === false, "state chatGatewayExecuteModified must be false");

  const currentLoopEvidenceAvailable = [1, 2, 3].every((loopNumber) => existsSync(loopEvidencePath(date, loopNumber)));
  const controlledDirectUseEvidenceAvailable =
    phase2063Result?.directUseRunCompleted === true &&
    phase2063Result?.realMutationLoopCount >= 1 &&
    phase2063Refs.length >= 3;
  const directUseVerificationMode = !currentLoopEvidenceAvailable && (controlledDirectUseState || controlledDirectUseEvidenceAvailable);
  const loopsToVerify = directUseVerificationMode ? Math.min(phase2063Result.loopCount || phase2063Refs.length, 3) : 3;
  assert(state.loopsCompletedToday >= loopsToVerify || directUseVerificationMode, "state should have enough loop evidence before verification");
  for (let loopNumber = 1; loopNumber <= loopsToVerify; loopNumber += 1) {
    const filePath = directUseVerificationMode
      ? path.join(repoRoot, phase2063Refs[loopNumber - 1])
      : loopEvidencePath(date, loopNumber);
    assert(existsSync(filePath), `missing loop evidence ${loopNumber}`);
    const evidence = readJson(filePath);
    assert(evidence.phaseId === "Phase2019-GVC-Timed-Local-Runner-30s-DailyCap", `loop ${loopNumber} phaseId mismatch`);
    if (directUseVerificationMode) {
      assert(evidence.intervalMs === 30000, `loop ${loopNumber} should come from controlled direct-use interval`);
      assert(evidence.dailyLoopLimit === 20, `loop ${loopNumber} direct-use daily limit mismatch`);
      assert(evidence.dryRunOnly === false, `loop ${loopNumber} direct-use dryRunOnly mismatch`);
      assert(evidence.finalPermissionGate?.permissionEnforcementLimitedActivation === true, `loop ${loopNumber} must include finalPermissionGate`);
      assert(evidence.finalPermissionGate?.realMutationPermissionExpanded === false, `loop ${loopNumber} must not expand mutation authority`);
    } else {
      if (controlledAutonomousUseState) {
        assert(evidence.intervalMs === 1000 || evidence.intervalMs === 30000, `loop ${loopNumber} controlled autonomous interval mismatch`);
        assert(evidence.dailyLoopLimit === 3 || evidence.dailyLoopLimit === 500, `loop ${loopNumber} controlled autonomous daily limit mismatch`);
        assert(evidence.dryRunOnly === false, `loop ${loopNumber} controlled autonomous dryRunOnly mismatch`);
        assert(evidence.autonomousMutationEnabled === true, `loop ${loopNumber} autonomous mutation should be enabled`);
        assert(evidence.finalPermissionGate?.finalDecision === "allow", `loop ${loopNumber} final permission gate must allow`);
        assert(evidence.finalPermissionGate?.realMutationPermissionExpanded === false, `loop ${loopNumber} must not expand mutation authority`);
        assert(evidence.realExecutionPerformed === true, `loop ${loopNumber} must perform controlled low-risk real execution`);
      } else {
        assert(evidence.intervalMs === 1000, `loop ${loopNumber} should come from test mode interval`);
        assert(evidence.dailyLoopLimit === 3, `loop ${loopNumber} daily limit mismatch`);
        assert(evidence.dryRunOnly === true, `loop ${loopNumber} dryRunOnly mismatch`);
        assert(evidence.realExecutionPerformed === false, `loop ${loopNumber} must not perform real execution`);
      }
      assert(evidence.verificationResults.length >= 3, `loop ${loopNumber} must run required verifiers`);
      assert(evidence.verificationResults.every((result) => result.passed === true), `loop ${loopNumber} verifier failure found`);
    }
    assert(evidence.maxTasksPerLoop === 1, `loop ${loopNumber} maxTasksPerLoop mismatch`);
    assert(typeof evidence.terminalSafetySummaryRef === "string" && evidence.terminalSafetySummaryRef.length > 0, `loop ${loopNumber} missing terminal safety summary ref`);
    assert(typeof evidence.taskCapsuleRef === "string" && evidence.taskCapsuleRef.length > 0, `loop ${loopNumber} missing task capsule ref`);
    const terminalSummaryPath = path.join(repoRoot, evidence.terminalSafetySummaryRef);
    const taskCapsulePath = path.join(repoRoot, evidence.taskCapsuleRef);
    assert(existsSync(terminalSummaryPath), `loop ${loopNumber} terminal safety summary evidence missing`);
    assert(existsSync(taskCapsulePath), `loop ${loopNumber} task capsule evidence missing`);
    const terminalSummary = readJson(terminalSummaryPath);
    const taskCapsule = readJson(taskCapsulePath);
    assert(terminalSummary.rawTranscriptStored === false, `loop ${loopNumber} terminal summary must not store raw transcript`);
    assert(terminalSummary.stdoutStored === false, `loop ${loopNumber} terminal summary must not store stdout`);
    assert(terminalSummary.stderrStored === false, `loop ${loopNumber} terminal summary must not store stderr`);
    assert(terminalSummary.providerCallsMade === false, `loop ${loopNumber} terminal summary providerCallsMade must be false`);
    assert(terminalSummary.secretRead === false, `loop ${loopNumber} terminal summary secretRead must be false`);
    assert(typeof taskCapsule.capsule?.capsuleHash === "string", `loop ${loopNumber} task capsule hash missing`);
    assert(taskCapsule.providerCallsMade === false, `loop ${loopNumber} task capsule providerCallsMade must be false`);
    assert(taskCapsule.secretRead === false, `loop ${loopNumber} task capsule secretRead must be false`);
    assert(evidence.providerCallsMade === false, `loop ${loopNumber} providerCallsMade must be false`);
    assert(evidence.secretRead === false, `loop ${loopNumber} secretRead must be false`);
    assert(evidence.deployExecuted === false, `loop ${loopNumber} deployExecuted must be false`);
    assert(evidence.chatGatewayExecuteModified === false, `loop ${loopNumber} chatGatewayExecuteModified must be false`);
  }

  const result = {
    phaseId: "Phase2019-GVC-Timed-Local-Runner-30s-DailyCap",
    status: "passed",
    generatedAt: new Date().toISOString(),
    intervalMsDefault: 30000,
    dailyLoopLimitDefault: 500,
    testModeVerified: !directUseVerificationMode,
    controlledDirectUseVerified: directUseVerificationMode,
    loopsVerified: loopsToVerify,
    dryRunOnly: state.dryRunOnly,
    ownerManualStartOnly: true,
    windowsTaskSchedulerRegistered: false,
    startupAutoRunRegistered: false,
    recommendedSealed: true,
    blocker: "none",
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    workspaceCleanClaimed: false,
  };
  const resultPath = path.join(
    repoRoot,
    "apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner/phase2019-timed-runner-verify-result.json",
  );
  await import("node:fs").then(({ mkdirSync, writeFileSync }) => {
    mkdirSync(path.dirname(resultPath), { recursive: true });
    writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  });
  console.log("Phase2019 GVC timed local runner verifier passed");
}

main().catch((error) => {
  console.error(`Phase2019 GVC timed local runner verifier failed: ${error.message}`);
  process.exit(1);
});
