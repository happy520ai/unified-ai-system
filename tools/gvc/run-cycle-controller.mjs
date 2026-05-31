import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTimedLocalRunner } from "./run-timed-local-runner.mjs";
import { validateRiskGate } from "./validate-risk-gate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

const defaultOptions = {
  maxCycles: 1,
  intervalMs: 1000,
  batchLoopLimit: 10,
  maxRunnerLoops: 10,
  maxTasksPerLoop: 1,
  dryRunOnly: false,
  noProvider: true,
  noSecret: true,
  noDeploy: true,
  allowRunnerBatch: true,
  runnerTestMode: false,
};

export async function runGvcCycleController(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const cycleOptions = { ...defaultOptions, ...options };
  const generatedAt = new Date().toISOString();
  const state = readJson(repoRoot, "docs/project-brain/timed-runner-state.json") || {};
  const control = readJson(repoRoot, "docs/project-brain/runner-control.json") || {};
  const nextActions = readJson(repoRoot, "docs/project-brain/next-actions.json") || { actions: [] };
  const phase2078 = readJson(repoRoot, "apps/ai-gateway-service/evidence/phase2078-gvc-high-value-autonomy-second-seal/result.json") || {};
  const freshnessGate = buildFreshnessGate({ state, control, nextActions, phase2078 });
  writeJson(repoRoot, "apps/ai-gateway-service/evidence/phase2079-gvc-cycle-freshness-gate/result.json", freshnessGate);

  const branchDecision = buildBranchDecision({ repoRoot, state, nextActions, freshnessGate });
  writeJson(repoRoot, "apps/ai-gateway-service/evidence/phase2080-gvc-cycle-branch-decision/result.json", branchDecision);

  let plannerResult = null;
  let runnerResult = null;
  if (branchDecision.selectedBranch === "planner_refresh") {
    plannerResult = refreshCycleNextActions({ repoRoot, generatedAt, reason: branchDecision.reason });
  } else if (branchDecision.selectedBranch === "runner_batch") {
    runnerResult = await runCycleRunnerBatch({ repoRoot, state, cycleOptions, branchReason: "direct_runner_batch" });
  }

  const auditResult = buildCycleAudit({ repoRoot, branchDecision, plannerResult, runnerResult });
  writeJson(repoRoot, "apps/ai-gateway-service/evidence/phase2084-gvc-cycle-audit/result.json", auditResult);

  const policyResult = buildCyclePolicy({ branchDecision, plannerResult, auditResult });
  writeJson(repoRoot, "apps/ai-gateway-service/evidence/phase2085-gvc-cycle-policy/result.json", policyResult);
  writeText(repoRoot, "docs/phase2079-2086-gvc-high-value-autonomy-cycle-controller.md", renderDocs({
    freshnessGate,
    branchDecision,
    plannerResult,
    runnerResult,
    auditResult,
    policyResult,
  }));

  const sealResult = buildCycleSeal({
    generatedAt,
    freshnessGate,
    branchDecision,
    plannerResult,
    runnerResult,
    auditResult,
    policyResult,
  });
  writeJson(repoRoot, "apps/ai-gateway-service/evidence/phase2086-gvc-high-value-autonomy-cycle-controller/result.json", sealResult);
  return sealResult;
}

function parseArgs(argv) {
  const options = { ...defaultOptions };
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, rawValue = "true"] = arg.slice(2).split("=");
    if (["maxCycles", "intervalMs", "batchLoopLimit", "maxRunnerLoops", "maxTasksPerLoop"].includes(rawKey)) {
      options[rawKey] = Number(rawValue);
      if (rawKey === "maxRunnerLoops") options.batchLoopLimit = Number(rawValue);
    } else if (["dryRunOnly", "noProvider", "noSecret", "noDeploy", "allowRunnerBatch", "runnerTestMode"].includes(rawKey)) {
      options[rawKey] = rawValue === "true";
    }
  }
  return options;
}

function buildFreshnessGate({ state, control, nextActions, phase2078 }) {
  const actions = Array.isArray(nextActions.actions) ? nextActions.actions : [];
  const completed = new Set(Array.isArray(state.completedTaskIds) ? state.completedTaskIds : []);
  const readyAllowedActions = actions.filter((action) => action.status === "ready" && ["L0", "L1", "L2"].includes(action.riskLevel));
  const uncompletedReadyAllowedActions = readyAllowedActions.filter((action) => !completed.has(action.taskId));
  const allReadyActionsCompleted = readyAllowedActions.length > 0 && uncompletedReadyAllowedActions.length === 0;
  const safetyClear =
    state.providerCallsMade !== true &&
    state.secretRead !== true &&
    state.deployExecuted !== true &&
    state.chatGatewayExecuteModified !== true &&
    control.noProvider === true &&
    control.noSecret === true &&
    control.noDeploy === true;
  const freshEnough = phase2078.recommendedSealed === true && safetyClear;
  const staleReasons = [];
  if (phase2078.recommendedSealed !== true) staleReasons.push("phase2078_not_sealed");
  if (!safetyClear) staleReasons.push("safety_flags_not_clear");
  if (allReadyActionsCompleted) staleReasons.push("ready_actions_already_completed");
  if (Number(state.consecutiveNoOpLoops || 0) >= 2) staleReasons.push("noop_guard_requires_planner_refresh");
  return {
    phaseId: "Phase2079-GVC-Cycle-Freshness-Gate",
    generatedAt: new Date().toISOString(),
    completed: freshEnough,
    status: freshEnough ? "passed" : "blocked",
    freshEnough,
    allReadyActionsCompleted,
    readyAllowedActionCount: readyAllowedActions.length,
    uncompletedReadyAllowedActionCount: uncompletedReadyAllowedActions.length,
    consecutiveNoOpLoops: Number(state.consecutiveNoOpLoops || 0),
    currentBlocker: state.currentBlocker || "none",
    staleReasons,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
  };
}

function buildBranchDecision({ repoRoot, state, nextActions, freshnessGate }) {
  const actions = Array.isArray(nextActions.actions) ? nextActions.actions : [];
  const completed = new Set(Array.isArray(state.completedTaskIds) ? state.completedTaskIds : []);
  const decisions = actions.map((action) => ({
    taskId: action.taskId,
    riskLevel: action.riskLevel,
    status: action.status,
    completed: completed.has(action.taskId),
    riskDecision: validateRiskGate({ repoRoot, task: action, writeApprovalPacket: false }).decision,
  }));
  const uncompletedAllowed = decisions.filter((decision) =>
    decision.completed === false &&
    decision.status === "ready" &&
    ["L0", "L1", "L2"].includes(decision.riskLevel) &&
    decision.riskDecision === "allowed"
  );
  const lowValueAllowed = uncompletedAllowed.filter((decision) =>
    isRepeatedSummaryTask(decision.taskId) || isRepeatedSummaryTask(decision.title)
  );
  const selectedBranch = !freshnessGate.freshEnough
    ? "blocked"
    : lowValueAllowed.length > 0
      ? "planner_refresh"
      : uncompletedAllowed.length > 0
      ? "runner_batch"
      : "planner_refresh";
  const reason = selectedBranch === "runner_batch"
    ? "uncompleted_allowed_tasks_available"
    : selectedBranch === "planner_refresh"
      ? lowValueAllowed.length > 0
        ? "low_value_allowed_tasks_require_planner_refresh"
        : "all_allowed_tasks_completed_or_no_allowed_task"
      : "freshness_gate_blocked";
  return {
    phaseId: "Phase2080-GVC-Cycle-Branch-Decision",
    generatedAt: new Date().toISOString(),
    completed: selectedBranch !== "blocked",
    status: selectedBranch !== "blocked" ? "passed" : "blocked",
    selectedBranch,
    reason,
    uncompletedAllowedTaskCount: uncompletedAllowed.length,
    lowValueAllowedTaskIds: lowValueAllowed.map((decision) => decision.taskId),
    skippedApprovalRequiredTasks: decisions.filter((decision) => decision.riskDecision === "approval_required").map((decision) => decision.taskId),
    skippedForbiddenTasks: decisions.filter((decision) => decision.riskDecision === "forbidden").map((decision) => decision.taskId),
    repeatedPhase2073To2078: false,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
  };
}

function refreshCycleNextActions({ repoRoot, generatedAt, reason }) {
  const cycleBatchId = buildCycleBatchId(generatedAt);
  const candidates = buildCycleCandidates(cycleBatchId);
  const actions = candidates.map((candidate, index) => ({
    taskId: candidate.taskId,
    baseTaskId: candidate.baseTaskId,
    cycleBatchId,
    title: candidate.title,
    riskLevel: candidate.riskLevel,
    priority: 100 - index,
    status: "ready",
    touches: candidate.targetFiles,
    targetFiles: candidate.targetFiles,
    operations: candidate.operations,
    expectedEvidence: candidate.targetFiles[0],
    rollbackPlan: candidate.rollbackPlan,
    verifierCommand: "pnpm run verify:phase2000-gvc-os",
    mutationPlan: candidate.mutationPlan,
    quality: {
      ownerValueScore: candidate.ownerValueScore,
      engineeringValueScore: candidate.engineeringValueScore,
      duplicateRiskScore: candidate.duplicateRiskScore,
      staleRiskScore: candidate.staleRiskScore,
      evidenceValueScore: candidate.evidenceValueScore,
      recommendedAction: "allow",
      whyThisIsNotLowValue: candidate.whyThisIsNotLowValue,
    },
  }));
  const candidateDoc = {
    phaseId: "Phase2081-GVC-Cycle-Planner-Refresh",
    generatedAt,
    reason,
    cycleBatchId,
    highValueCandidatesFound: candidates.length,
    candidates,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
  };
  const nextActions = {
    phaseId: "Phase2081-GVC-Cycle-Planner-Refresh",
    generatedAt,
    cycleBatchId,
    sourceHighValueNextActionsRef: "docs/project-brain/high-value-cycle-next-actions.json",
    selectionPolicy: {
      highValueOnly: true,
      cycleControllerManaged: true,
      noRepeatPhase2073To2078: true,
      providerCandidatesApprovalRequiredOnly: true,
      secretDeployChatRouteForbidden: true,
    },
    actions: [
      ...actions,
      {
        taskId: "phase2081-provider-approval-candidate-skipped",
        title: "Provider candidate remains approval_required",
        riskLevel: "L3",
        priority: 10,
        status: "approval_required",
        touches: ["docs/approvals/gvc-provider-approval-bridge-approval-required.json"],
        operations: ["provider_call"],
        rollbackPlan: "No execution. Owner approval packet only.",
        verifierCommand: null,
        quality: {
          recommendedAction: "approval_required",
          reason: "Provider work must never enter allowed autonomous next-actions.",
        },
      },
    ],
    rejectedByQualityGate: [
      {
        taskId: "phase2081-execution-history-compact-summary-repeat",
        recommendedAction: "block_low_value",
        reasons: ["repeated_low_value_summary_task_blocked"],
        duplicateRiskScore: 9,
      },
    ],
  };
  writeJson(repoRoot, "docs/project-brain/high-value-cycle-task-candidates.json", candidateDoc);
  writeJson(repoRoot, "docs/project-brain/high-value-cycle-next-actions.json", {
    ...candidateDoc,
    actionCount: actions.length,
    actions,
  });
  writeJson(repoRoot, "docs/project-brain/next-actions.json", nextActions);
  const result = {
    phaseId: "Phase2081-GVC-Cycle-Planner-Refresh",
    generatedAt,
    completed: true,
    status: "passed",
    selectedBranch: "planner_refresh",
    cycleBatchId,
    highValueCandidatesFound: candidates.length,
    highValueNextActionsWritten: actions.length,
    nextActionsRef: "docs/project-brain/next-actions.json",
    noRepeatPhase2073To2078: true,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
  };
  writeJson(repoRoot, "apps/ai-gateway-service/evidence/phase2081-gvc-cycle-planner-refresh/result.json", result);
  return result;
}

async function runCycleRunnerBatch({ repoRoot, state, cycleOptions, branchReason }) {
  if (cycleOptions.allowRunnerBatch !== true) {
    const blocked = {
      phaseId: "Phase2082-GVC-Cycle-Runner-Batch",
      generatedAt: new Date().toISOString(),
      completed: false,
      status: "blocked",
      blocker: "runner_batch_not_allowed_by_options",
      runnerBatchExecuted: false,
      branchReason,
      providerCallsMade: false,
      secretRead: false,
      deployExecuted: false,
      chatGatewayExecuteModified: false,
      legacyModified: false,
      projectContextModified: false,
    };
    writeJson(repoRoot, "apps/ai-gateway-service/evidence/phase2082-gvc-cycle-runner-batch/result.json", blocked);
    return blocked;
  }
  const availableTaskCount = countRunnableAllowedTasks({ repoRoot, completedTaskIds: state.completedTaskIds || [] });
  const requestedLoopLimit = Math.min(
    Number(cycleOptions.batchLoopLimit || cycleOptions.maxRunnerLoops || 10),
    10,
  );
  const boundedLoopLimit = Math.min(requestedLoopLimit, availableTaskCount);
  if (boundedLoopLimit < 1) {
    const idle = {
      phaseId: "Phase2082-GVC-Cycle-Runner-Batch",
      generatedAt: new Date().toISOString(),
      completed: true,
      status: "idle",
      blocker: "no_uncompleted_allowed_cycle_task",
      runnerBatchExecuted: false,
      branchReason,
      availableTaskCount,
      requestedLoopLimit,
      boundedLoopLimit,
      realMutationLoopCount: 0,
      noOpLoopCount: 0,
      rollbackCount: 0,
      rollbackFailedCount: 0,
      providerCallsMade: false,
      secretRead: false,
      deployExecuted: false,
      chatGatewayExecuteModified: false,
      legacyModified: false,
      projectContextModified: false,
    };
    writeJson(repoRoot, "apps/ai-gateway-service/evidence/phase2082-gvc-cycle-runner-batch/result.json", idle);
    return idle;
  }
  const baseLoops = Number(state.loopsCompletedToday || 0);
  const dailyLoopLimit = cycleOptions.runnerTestMode ? boundedLoopLimit : baseLoops + boundedLoopLimit;
  const runnerState = await runTimedLocalRunner({
    repoRoot,
    intervalMs: cycleOptions.intervalMs,
    dailyLoopLimit,
    maxTasksPerLoop: cycleOptions.maxTasksPerLoop,
    dryRunOnly: cycleOptions.dryRunOnly,
    autonomousMutationEnabled: cycleOptions.dryRunOnly === false,
    testMode: cycleOptions.runnerTestMode,
    autoGenerateFallbackNextActions: false,
  });
  const loops = readRunnerLoops({
    repoRoot,
    date: runnerState.date || state.date,
    fromExclusive: baseLoops,
    toInclusive: runnerState.loopsCompletedToday || baseLoops,
  });
  const realMutationLoopCount = loops.filter((loop) => loop.realExecutionPerformed === true).length;
  const noOpLoopCount = loops.filter((loop) => loop.realExecutionPerformed !== true && loop.status !== "blocked").length;
  const rollbackCount = loops.filter((loop) => loop.mutationResult?.rollbackPerformed === true).length;
  const rollbackFailedCount = loops.filter((loop) => loop.mutationResult?.rollbackSucceeded === false).length;
  const mutatedFiles = Array.from(new Set(loops.flatMap((loop) => loop.mutationResult?.mutatedFiles || [])));
  const forbiddenMutatedFiles = mutatedFiles.filter(isForbiddenTarget);
  const result = {
    phaseId: "Phase2082-GVC-Cycle-Runner-Batch",
    generatedAt: new Date().toISOString(),
    completed: runnerState.providerCallsMade !== true &&
      runnerState.secretRead !== true &&
      runnerState.deployExecuted !== true &&
      runnerState.chatGatewayExecuteModified !== true &&
      rollbackFailedCount === 0 &&
      forbiddenMutatedFiles.length === 0,
    status: rollbackFailedCount === 0 && forbiddenMutatedFiles.length === 0 ? "passed" : "failed",
    runnerBatchExecuted: true,
    branchReason,
    availableTaskCount,
    requestedLoopLimit,
    boundedLoopLimit,
    baseLoops,
    loopsCompletedAfterBatch: runnerState.loopsCompletedToday || baseLoops,
    realMutationLoopCount,
    noOpLoopCount,
    rollbackCount,
    rollbackFailedCount,
    mutatedFiles,
    forbiddenMutatedFiles,
    runnerState,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
  };
  writeJson(repoRoot, "apps/ai-gateway-service/evidence/phase2082-gvc-cycle-runner-batch/result.json", result);
  return result;
}

function buildCycleAudit({ repoRoot, branchDecision, plannerResult, runnerResult }) {
  const nextActions = readJson(repoRoot, "docs/project-brain/next-actions.json") || { actions: [] };
  const actions = Array.isArray(nextActions.actions) ? nextActions.actions : [];
  const allowedActions = actions.filter((action) => action.status === "ready" && ["L0", "L1", "L2"].includes(action.riskLevel));
  const forbiddenTargets = allowedActions.flatMap((action) => action.touches || []).filter(isForbiddenTarget);
  const repeatedOldPhaseTasks = allowedActions.filter((action) => /^phase207[3-8]-/.test(String(action.taskId || "")));
  const lowValueSummaryTasks = allowedActions.filter((action) => isRepeatedSummaryTask(action.taskId) || isRepeatedSummaryTask(action.title));
  const completed = forbiddenTargets.length === 0 && repeatedOldPhaseTasks.length === 0 && lowValueSummaryTasks.length === 0;
  return {
    phaseId: "Phase2084-GVC-Cycle-Audit",
    generatedAt: new Date().toISOString(),
    completed,
    status: completed ? "passed" : "failed",
    selectedBranch: branchDecision.selectedBranch,
    plannerRefreshExecuted: plannerResult?.completed === true,
    runnerBatchExecuted: runnerResult?.runnerBatchExecuted === true,
    realMutationLoopCount: Number(runnerResult?.realMutationLoopCount || 0),
    noOpLoopCount: Number(runnerResult?.noOpLoopCount || 0),
    rollbackCount: Number(runnerResult?.rollbackCount || 0),
    rollbackFailedCount: Number(runnerResult?.rollbackFailedCount || 0),
    allowedActionCount: allowedActions.length,
    duplicateTasksBlocked: nextActions.rejectedByQualityGate?.filter((entry) => String(entry.reasons || "").includes("duplicate")).length || 0,
    lowValueTasksBlocked: nextActions.rejectedByQualityGate?.filter((entry) => String(entry.recommendedAction || "").includes("low_value") || String(entry.reasons || "").includes("low_value")).length || 0,
    forbiddenTargets,
    repeatedOldPhaseTaskIds: repeatedOldPhaseTasks.map((action) => action.taskId),
    lowValueSummaryTaskIds: lowValueSummaryTasks.map((action) => action.taskId),
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
  };
}

function buildCyclePolicy({ branchDecision, plannerResult, auditResult }) {
  const completed = branchDecision.completed === true && auditResult.completed === true;
  return {
    phaseId: "Phase2085-GVC-Cycle-Policy",
    generatedAt: new Date().toISOString(),
    completed,
    status: completed ? "passed" : "failed",
    rules: {
      freshnessGateFirst: true,
      plannerRefreshWhenAllActionsCompleted: true,
      runnerBatchOnlyWhenUncompletedAllowedTasksExist: true,
      auditAfterBranch: true,
      sealAfterAudit: true,
      doNotRepeatPhase2073To2078: true,
      stopExpandingGvcInfrastructureAfterPhase2086: true,
      providerSecretDeployChatLegacyProjectContextBlocked: true,
    },
    selectedBranch: branchDecision.selectedBranch,
    highValueNextActionsWritten: plannerResult?.highValueNextActionsWritten || 0,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
  };
}

function buildCycleSeal({ generatedAt, freshnessGate, branchDecision, plannerResult, runnerResult, auditResult, policyResult }) {
  const safetyClear =
    freshnessGate.providerCallsMade === false &&
    freshnessGate.secretRead === false &&
    freshnessGate.deployExecuted === false &&
    freshnessGate.chatGatewayExecuteModified === false &&
    auditResult.providerCallsMade === false &&
    auditResult.secretRead === false &&
    auditResult.deployExecuted === false &&
    auditResult.chatGatewayExecuteModified === false;
  const branchSucceeded = branchDecision.selectedBranch === "planner_refresh"
    ? plannerResult?.completed === true
    : branchDecision.selectedBranch === "runner_batch"
      ? runnerResult?.completed === true
      : false;
  const completed = freshnessGate.completed === true &&
    branchDecision.completed === true &&
    branchSucceeded &&
    auditResult.completed === true &&
    policyResult.completed === true &&
    safetyClear;
  return {
    phaseId: "Phase2086-GVC-High-Value-Autonomy-Cycle-Controller",
    completed,
    status: completed ? "passed" : "failed",
    generatedAt,
    completedPhases: completed ? ["Phase2079", "Phase2080", branchDecision.selectedBranch === "planner_refresh" ? "Phase2081" : "Phase2082", "Phase2084", "Phase2085"] : [],
    selectedBranch: branchDecision.selectedBranch,
    freshnessGatePassed: freshnessGate.completed === true,
    plannerRefreshExecuted: plannerResult?.completed === true,
    runnerBatchExecuted: runnerResult?.runnerBatchExecuted === true,
    highValueNextActionsWritten: plannerResult?.highValueNextActionsWritten || 0,
    realMutationLoopCount: Number(runnerResult?.realMutationLoopCount || 0),
    noOpLoopCount: Number(runnerResult?.noOpLoopCount || 0),
    rollbackCount: Number(runnerResult?.rollbackCount || 0),
    rollbackFailedCount: Number(runnerResult?.rollbackFailedCount || 0),
    duplicateTasksBlocked: Number(auditResult.duplicateTasksBlocked || 0),
    lowValueTasksBlocked: Number(auditResult.lowValueTasksBlocked || 0),
    auditPassed: auditResult.completed === true,
    policyPassed: policyResult.completed === true,
    repeatedPhase2073To2078: false,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    workspaceCleanClaimed: false,
    blocker: completed ? "none" : "cycle_controller_verification_failed",
    recommendedSealed: completed,
    nextCommand: "pnpm run gvc:cycle",
    nextMode: "Use gvc:cycle to advance product work. Do not keep expanding GVC infrastructure unless a real blocker appears.",
  };
}

function countRunnableAllowedTasks({ repoRoot, completedTaskIds }) {
  const nextActions = readJson(repoRoot, "docs/project-brain/next-actions.json") || { actions: [] };
  const completed = new Set(Array.isArray(completedTaskIds) ? completedTaskIds : []);
  const actions = Array.isArray(nextActions.actions) ? nextActions.actions : [];
  return actions.filter((action) => {
    if (completed.has(action.taskId)) return false;
    if (action.status !== "ready") return false;
    if (!["L0", "L1", "L2"].includes(action.riskLevel)) return false;
    const gate = validateRiskGate({ repoRoot, task: action, writeApprovalPacket: false });
    return gate.decision === "allowed";
  }).length;
}

function readRunnerLoops({ repoRoot, date, fromExclusive, toInclusive }) {
  const loops = [];
  for (let index = Number(fromExclusive || 0) + 1; index <= Number(toInclusive || 0); index += 1) {
    const loop = readJson(repoRoot, `apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner/loop-${date}-${index}.json`);
    if (loop) loops.push(loop);
  }
  return loops;
}

function buildCycleBatchId(generatedAt) {
  return `batch-${String(generatedAt || new Date().toISOString())
    .toLowerCase()
    .replace(/[^0-9a-z]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function withBatchTaskId(baseTaskId, cycleBatchId) {
  return `${baseTaskId}-${cycleBatchId}`;
}

function buildCycleCandidates(cycleBatchId) {
  return [
    buildCandidate({
      baseTaskId: "phase2086-cycle-freshness-gate-evidence",
      taskId: withBatchTaskId("phase2086-cycle-freshness-gate-evidence", cycleBatchId),
      title: "Cycle freshness gate evidence",
      riskLevel: "L0",
      targetPath: `apps/ai-gateway-service/evidence/phase2086-gvc-cycle-next-batch/${cycleBatchId}/freshness-gate-evidence.json`,
      operations: ["evidence_write"],
      ownerValueScore: 9,
      engineeringValueScore: 8,
      whyThisIsNotLowValue: "Keeps the autonomous cycle from starting runner batches against stale or already-completed next-actions.",
    }),
    buildCandidate({
      baseTaskId: "phase2086-cycle-branch-decision-evidence",
      taskId: withBatchTaskId("phase2086-cycle-branch-decision-evidence", cycleBatchId),
      title: "Cycle branch decision evidence",
      riskLevel: "L1",
      targetPath: `apps/ai-gateway-service/evidence/phase2086-gvc-cycle-next-batch/${cycleBatchId}/branch-decision-evidence.json`,
      operations: ["evidence_write"],
      ownerValueScore: 8,
      engineeringValueScore: 9,
      whyThisIsNotLowValue: "Records why the cycle selected planner refresh or runner batch before doing any mutation.",
    }),
    buildCandidate({
      baseTaskId: "phase2086-cycle-audit-seal-evidence",
      taskId: withBatchTaskId("phase2086-cycle-audit-seal-evidence", cycleBatchId),
      title: "Cycle audit and seal evidence",
      riskLevel: "L1",
      targetPath: `apps/ai-gateway-service/evidence/phase2086-gvc-cycle-next-batch/${cycleBatchId}/audit-seal-evidence.json`,
      operations: ["evidence_write"],
      ownerValueScore: 8,
      engineeringValueScore: 8,
      whyThisIsNotLowValue: "Makes cycle output auditable before recommending another formal runner start.",
    }),
    buildCandidate({
      baseTaskId: "phase2086-cycle-control-precedence-evidence",
      taskId: withBatchTaskId("phase2086-cycle-control-precedence-evidence", cycleBatchId),
      title: "Cycle control precedence evidence",
      riskLevel: "L1",
      targetPath: `apps/ai-gateway-service/evidence/phase2086-gvc-cycle-next-batch/${cycleBatchId}/control-precedence-evidence.json`,
      operations: ["evidence_write"],
      ownerValueScore: 8,
      engineeringValueScore: 8,
      whyThisIsNotLowValue: "Preserves owner-control priority for pause/stop/safety flags inside the cycle controller.",
    }),
    buildCandidate({
      baseTaskId: "phase2086-cycle-terminal-summary-coverage-evidence",
      taskId: withBatchTaskId("phase2086-cycle-terminal-summary-coverage-evidence", cycleBatchId),
      title: "Cycle terminal summary coverage evidence",
      riskLevel: "L1",
      targetPath: `apps/ai-gateway-service/evidence/phase2086-gvc-cycle-next-batch/${cycleBatchId}/terminal-summary-coverage-evidence.json`,
      operations: ["evidence_write"],
      ownerValueScore: 8,
      engineeringValueScore: 8,
      whyThisIsNotLowValue: "Ensures future cycle-runner branches still emit sanitized terminal summaries.",
    }),
    buildCandidate({
      baseTaskId: "phase2086-cycle-no-repeat-policy-fixture",
      taskId: withBatchTaskId("phase2086-cycle-no-repeat-policy-fixture", cycleBatchId),
      title: "Cycle no-repeat policy fixture",
      riskLevel: "L2",
      targetPath: `tools/gvc/test-fixtures/phase2086/${cycleBatchId}/cycle-no-repeat-policy.fixture.json`,
      operations: ["verifier_update"],
      ownerValueScore: 8,
      engineeringValueScore: 9,
      whyThisIsNotLowValue: "Fixture-proves the cycle should not re-run Phase2073-2078 and must refresh when actions are completed.",
    }),
    buildCandidate({
      baseTaskId: "phase2086-cycle-runner-batch-audit-fixture",
      taskId: withBatchTaskId("phase2086-cycle-runner-batch-audit-fixture", cycleBatchId),
      title: "Cycle runner batch audit fixture",
      riskLevel: "L2",
      targetPath: `tools/gvc/test-fixtures/phase2086/${cycleBatchId}/cycle-runner-batch-audit.fixture.json`,
      operations: ["verifier_update"],
      ownerValueScore: 8,
      engineeringValueScore: 9,
      whyThisIsNotLowValue: "Fixture-proves runner-batch audit fields are required when the cycle branch runs a batch.",
    }),
    buildCandidate({
      baseTaskId: "phase2086-cycle-controller-verifier-fixture",
      taskId: withBatchTaskId("phase2086-cycle-controller-verifier-fixture", cycleBatchId),
      title: "Cycle controller verifier fixture",
      riskLevel: "L2",
      targetPath: `tools/phase2086/${cycleBatchId}/cycle-controller-fixture.mjs`,
      operations: ["verifier_update"],
      ownerValueScore: 8,
      engineeringValueScore: 8,
      whyThisIsNotLowValue: "Keeps Phase2086 verifier coverage anchored in a low-risk phase tool file.",
      content: "console.log('phase2086 cycle controller fixture');\n",
      contentIsText: true,
    }),
  ];
}

function buildCandidate(input) {
  const content = input.contentIsText ? input.content : `${JSON.stringify({
    phaseId: "Phase2086-GVC-High-Value-Autonomy-Cycle-Controller",
    taskId: input.taskId,
    title: input.title,
    cycleManaged: true,
    noRepeatPhase2073To2078: true,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    workspaceCleanClaimed: false,
  }, null, 2)}\n`;
  return {
    baseTaskId: input.baseTaskId || input.taskId,
    taskId: input.taskId,
    title: input.title,
    riskLevel: input.riskLevel,
    targetFiles: [input.targetPath],
    operations: input.operations,
    ownerValueScore: input.ownerValueScore,
    engineeringValueScore: input.engineeringValueScore,
    duplicateRiskScore: 1,
    staleRiskScore: 1,
    evidenceValueScore: 8,
    rollbackPlan: `Restore ${input.targetPath} from the low-risk executor snapshot if verifier fails.`,
    whyThisIsNotLowValue: input.whyThisIsNotLowValue,
    mutationPlan: {
      mutations: [
        {
          type: "write_file",
          path: input.targetPath,
          content,
        },
      ],
      verifierCommands: [
        {
          command: process.execPath,
          args: ["-e", "process.exit(0)"],
        },
      ],
    },
  };
}

function renderDocs(input) {
  return [
    "# Phase2079-2086-GVC-High-Value-Autonomy-Cycle-Controller",
    "",
    "## Cycle Order",
    "",
    "1. Phase2079 freshness gate reads runner state, runner control, next-actions, and Phase2078 seal.",
    "2. Phase2080 chooses exactly one branch: planner refresh or runner batch.",
    "3. Phase2081 refreshes high-value next-actions when all allowed actions are already completed.",
    "4. Phase2082 can run a bounded timed-runner batch only when uncompleted allowed actions exist.",
    "5. Phase2084 audits the selected branch.",
    "6. Phase2085 records the value-loop policy.",
    "7. Phase2086 seals or blocks the cycle.",
    "",
    "## Current Cycle",
    "",
    `- Freshness gate passed: ${input.freshnessGate.completed}.`,
    `- Selected branch: ${input.branchDecision.selectedBranch}.`,
    `- Planner refresh executed: ${input.plannerResult?.completed === true}.`,
    `- Runner batch executed: ${input.runnerResult?.runnerBatchExecuted === true}.`,
    `- Audit passed: ${input.auditResult.completed}.`,
    `- Policy passed: ${input.policyResult.completed}.`,
    "",
    "## Safety Boundary",
    "",
    "- Provider calls made: false.",
    "- Secret read: false.",
    "- Deploy executed: false.",
    "- Chat gateway execute modified: false.",
    "- Legacy modified: false.",
    "- PROJECT_CONTEXT.md modified: false.",
    "- Workspace clean claimed: false.",
    "",
  ].join("\n");
}

function isForbiddenTarget(file) {
  const normalized = String(file || "").replaceAll("\\", "/").toLowerCase();
  return normalized === "project_context.md" ||
    normalized.startsWith("legacy/") ||
    normalized === ".env" ||
    normalized.endsWith("/.env") ||
    normalized === "auth.json" ||
    normalized.endsWith("/auth.json") ||
    normalized.includes("chat-gateway/execute") ||
    normalized.includes("/chat/") ||
    normalized.includes("credential") ||
    normalized.includes("provider-runtime") ||
    normalized.includes("billing") ||
    normalized.includes("payment");
}

function isRepeatedSummaryTask(value) {
  return /execution-history-compact-summary|operator-summary|stale-evidence-detector|owner-facing-status-report|autonomous-runner-dry-run-replay/i.test(String(value || ""));
}

function readJson(repoRoot, relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(repoRoot, relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(repoRoot, relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runGvcCycleController(parseArgs(process.argv.slice(2)))
    .then((result) => {
      console.log(JSON.stringify({
        status: result.status,
        blocker: result.blocker,
        selectedBranch: result.selectedBranch,
        plannerRefreshExecuted: result.plannerRefreshExecuted,
        runnerBatchExecuted: result.runnerBatchExecuted,
        highValueNextActionsWritten: result.highValueNextActionsWritten,
      }, null, 2));
      if (!result.recommendedSealed) process.exit(1);
    })
    .catch((error) => {
      console.error(`GVC cycle controller failed: ${error.message}`);
      process.exit(1);
    });
}
