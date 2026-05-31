import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readProjectBrain } from "./read-project-brain.mjs";
import { validateRiskGate } from "./validate-risk-gate.mjs";
import { readRunnerControl } from "./read-runner-control.mjs";
import { generateNextActions } from "./generate-next-actions.mjs";
import { executeLowRiskMutationPlan, validateLowRiskMutationPlan } from "./low-risk-autonomous-executor.mjs";
import {
  buildTimedRunnerFinalPermissionGate,
  buildTimedRunnerEnforcementDryRun,
  buildTimedRunnerPermissionDecision,
  createTaskCapsule,
  reconcilePermissionWithRiskGate,
  summarizeTerminalTranscript,
} from "../../packages/gvc-permission-engine/src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

const defaultOptions = {
  intervalMs: 30000,
  dailyLoopLimit: 500,
  maxTasksPerLoop: 1,
  dryRunOnly: true,
  autonomousMutationEnabled: false,
  realMutationLoopLimit: 100,
  verificationCommands: null,
  autoGenerateFallbackNextActions: true,
  testMode: false,
};

const requiredVerificationCommands = [
  ["pnpm", ["run", "verify:phase2000-gvc-os"]],
  ["pnpm", ["run", "verify:phase107a-secret-safety"]],
  ["pnpm", ["run", "verify:phase321a-workbench-product-recovery"]],
];

function parseArgs(argv) {
  const options = { ...defaultOptions };
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, rawValue = "true"] = arg.slice(2).split("=");
    if (["intervalMs", "dailyLoopLimit", "maxTasksPerLoop", "realMutationLoopLimit"].includes(rawKey)) {
      options[rawKey] = Number(rawValue);
    } else if (["dryRunOnly", "testMode", "autonomousMutationEnabled"].includes(rawKey)) {
      options[rawKey] = rawValue === "true";
    }
  }
  return options;
}

function todayLocalDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statePath(repoRoot) {
  return path.join(repoRoot, "docs/project-brain/timed-runner-state.json");
}

function evidenceDir(repoRoot) {
  return path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner");
}

function mutationSummaryDir(repoRoot) {
  return path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner/mutation-summaries");
}

function phase2056DecisionDir(repoRoot) {
  return path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2056-gvc-permission-engine-timed-runner-decision-path");
}

function phase2057EnforcementDir(repoRoot) {
  return path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2057-gvc-permission-enforcement-dryrun");
}

function phase2058GateDir(repoRoot) {
  return path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2058-gvc-permission-enforcement-limited-activation");
}

function phase2053TerminalSummaryDir(repoRoot) {
  return path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2053-terminal-transcript-safety-summary/timed-runner");
}

function phase2054TaskCapsuleDir(repoRoot) {
  return path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2054-agent-loop-memory-snapshot/timed-runner");
}

function safeOvernightPolicyPath(repoRoot) {
  return path.join(repoRoot, "docs/project-brain/safe-overnight-policy.json");
}

function readJsonIfExists(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readSafeOvernightPolicy(repoRoot) {
  const filePath = safeOvernightPolicyPath(repoRoot);
  if (!existsSync(filePath)) {
    return {
      enabled: false,
      filePath,
      stopConditions: {},
      emergencyStopFile: "docs/project-brain/runner-control.json",
    };
  }
  return {
    ...JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")),
    filePath,
  };
}

function initialState(options, now = new Date()) {
  const date = todayLocalDate(now);
  return {
    phaseId: "Phase2019-GVC-Timed-Local-Runner-30s-DailyCap",
    status: "initialized",
    date,
    dailyLoopLimit: options.dailyLoopLimit,
    intervalMs: options.intervalMs,
    maxTasksPerLoop: options.maxTasksPerLoop,
    dryRunOnly: options.dryRunOnly,
    autonomousMutationEnabled: options.autonomousMutationEnabled,
    realExecutionLoopLimit: options.realMutationLoopLimit || 100,
    realExecutionLoopsCompletedToday: 0,
    consecutiveNoOpLoops: 0,
    consecutiveLowValueBlockedLoops: 0,
    fileTouchCounts: {},
    completedTaskIds: [],
    ownerManualStartOnly: true,
    windowsTaskSchedulerRegistered: false,
    startupAutoRunRegistered: false,
    loopsCompletedToday: 0,
    consecutiveVerifierFailures: 0,
    lastLoopEvidenceRef: null,
    lastSelectedTaskId: null,
    currentBlocker: "none",
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    gracefulShutdown: false,
    updatedAt: now.toISOString(),
  };
}

function loadState(repoRoot, options, now = new Date()) {
  const currentDate = todayLocalDate(now);
  if (options.testMode === true) {
    return initialState(options, now);
  }
  const existing = readJsonIfExists(statePath(repoRoot), null);
  if (!existing || existing.date !== currentDate) {
    return initialState(options, now);
  }
  if (options.dryRunOnly === false && existing.dryRunOnly !== false) {
    return initialState(options, now);
  }
  return {
    ...existing,
    dailyLoopLimit: options.dailyLoopLimit,
    intervalMs: options.intervalMs,
    maxTasksPerLoop: options.maxTasksPerLoop,
    dryRunOnly: options.dryRunOnly,
    autonomousMutationEnabled: options.autonomousMutationEnabled,
    realExecutionLoopLimit: Math.min(existing.realExecutionLoopLimit || 100, 100),
    realExecutionLoopsCompletedToday: existing.realExecutionLoopsCompletedToday || 0,
    consecutiveNoOpLoops: existing.consecutiveNoOpLoops || 0,
    consecutiveLowValueBlockedLoops: existing.consecutiveLowValueBlockedLoops || 0,
    fileTouchCounts: isRecord(existing.fileTouchCounts) ? existing.fileTouchCounts : {},
    completedTaskIds: Array.isArray(existing.completedTaskIds) ? existing.completedTaskIds : [],
    windowsTaskSchedulerRegistered: false,
    startupAutoRunRegistered: false,
  };
}

function approvalPath(repoRoot) {
  return path.join(repoRoot, "docs/approvals/gvc-low-risk-autonomous-mutation-approval.json");
}

function readLowRiskApproval(repoRoot) {
  const filePath = approvalPath(repoRoot);
  if (!existsSync(filePath)) {
    return {
      filePath,
      valid: false,
      approval: null,
      reasons: ["approval_file_missing"],
    };
  }
  try {
    const approval = JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
    const reasons = [];
    if (approval.approved !== true) reasons.push("approval_not_true");
    if (approval.scope !== "low_risk_only") reasons.push("approval_scope_not_low_risk_only");
    if (approval.providerAllowed !== false) reasons.push("provider_must_remain_blocked");
    if (approval.secretReadAllowed !== false) reasons.push("secret_read_must_remain_blocked");
    if (approval.deployAllowed !== false) reasons.push("deploy_must_remain_blocked");
    if (approval.chatRouteModificationAllowed !== false) reasons.push("chat_route_must_remain_blocked");
    if (approval.legacyModificationAllowed !== false) reasons.push("legacy_must_remain_blocked");
    if (approval.projectContextModificationAllowed !== false) reasons.push("project_context_must_remain_blocked");
    return {
      filePath,
      valid: reasons.length === 0,
      approval,
      reasons,
    };
  } catch {
    return {
      filePath,
      valid: false,
      approval: null,
      reasons: ["approval_json_parse_failed"],
    };
  }
}

function resolveRealExecutionLoopLimit(lowRiskApproval, safeOvernightPolicy, runnerOptions) {
  const approvalLimit = lowRiskApproval.approval?.dailyRealExecutionLoopLimit || 100;
  const policyLimit = safeOvernightPolicy.enabled === true
    ? safeOvernightPolicy.realMutationLoopLimit || 30
    : runnerOptions.realMutationLoopLimit || 100;
  return Math.min(approvalLimit, policyLimit, 100);
}

function runCommand(repoRoot, command, args) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 120000,
  });
  return {
    command: [command, ...args].join(" "),
    startedAt,
    exitCode: result.status ?? 1,
    passed: result.status === 0,
    stdoutTail: (result.stdout || "").slice(-1200),
    stderrTail: (result.stderr || "").slice(-1200),
  };
}

function selectAllowedTask(repoRoot, completedTaskIds = []) {
  const brain = readProjectBrain({ repoRoot });
  const completed = new Set(completedTaskIds);
  const decisions = brain.nextActions.actions.map((action) => {
    const gate = validateRiskGate({ repoRoot, task: action, writeApprovalPacket: action.status === "approval_required" });
    return {
      taskId: action.taskId,
      title: action.title,
      riskLevel: action.riskLevel,
      priority: action.priority,
      status: action.status,
      decision: gate.decision,
      touches: action.touches || [],
      operations: action.operations || [],
      command: action.command || null,
      verifierCommand: action.verifierCommand || null,
      mutationPlan: action.mutationPlan || null,
      approvalPacketPath: gate.approvalPacketPath,
      reasons: gate.reasons,
    };
  });

  const allowed = decisions
    .filter((entry) => !completed.has(entry.taskId))
    .filter((entry) => entry.decision === "allowed")
    .filter((entry) => ["L0", "L1", "L2"].includes(entry.riskLevel))
    .sort((left, right) => {
      const rank = { L0: 0, L1: 1, L2: 2 };
      const riskDelta = rank[left.riskLevel] - rank[right.riskLevel];
      if (riskDelta !== 0) return riskDelta;
      return right.priority - left.priority;
    });

  return {
    selected: allowed[0] || null,
    decisions,
    skippedApprovalRequiredTasks: decisions.filter((entry) => entry.decision === "approval_required").map((entry) => entry.taskId),
    skippedForbiddenTasks: decisions.filter((entry) => entry.decision === "forbidden").map((entry) => entry.taskId),
  };
}

function detectSafetyRisk(loop) {
  const selectedOps = loop.selectedTask?.operations || [];
  const selectedTouches = loop.selectedTask?.touches || [];
  const ownerControl = loop.ownerControl || {};
  return {
    providerRisk:
      ownerControl.noProvider === true &&
      (selectedOps.includes("provider_call") || selectedOps.includes("paid_api_call")),
    secretRisk:
      ownerControl.noSecret === true &&
      (selectedOps.some((op) => op.includes("secret") || op === "auth_json_read") ||
        selectedTouches.some((touch) => /(^|\/)(\.env|auth\.json)$/i.test(String(touch).replaceAll("\\", "/")))),
    deployRisk:
      ownerControl.noDeploy === true &&
      selectedOps.some((op) => ["deploy", "release", "tag", "artifact_upload", "push", "commit"].includes(op)),
    chatRouteRisk: selectedOps.includes("chat_modify") || selectedOps.includes("chat_gateway_execute_modify"),
  };
}

function writeLoopEvidence(repoRoot, date, loopNumber, evidence) {
  const filePath = path.join(evidenceDir(repoRoot), `loop-${date}-${loopNumber}.json`);
  writeJson(filePath, evidence);
  return filePath;
}

function writeMutationSummaryEvidence(repoRoot, date, loopNumber, summary) {
  const filePath = path.join(mutationSummaryDir(repoRoot), `mutation-summary-${date}-${loopNumber}.json`);
  writeJson(filePath, summary);
  return filePath;
}

function writePhase2056PermissionDecisionEvidence(repoRoot, date, loopNumber, decisionEvidence) {
  const filePath = path.join(phase2056DecisionDir(repoRoot), `decision-${date}-${loopNumber}.json`);
  writeJson(filePath, decisionEvidence);
  return filePath;
}

function writePhase2056ConflictEvidence(repoRoot, date, loopNumber, conflictEvidence) {
  const filePath = path.join(phase2056DecisionDir(repoRoot), `conflict-${date}-${loopNumber}.json`);
  writeJson(filePath, conflictEvidence);
  return filePath;
}

function writePhase2057EnforcementDryRunEvidence(repoRoot, date, loopNumber, enforcementEvidence) {
  const filePath = path.join(phase2057EnforcementDir(repoRoot), `enforcement-${date}-${loopNumber}.json`);
  writeJson(filePath, enforcementEvidence);
  return filePath;
}

function writePhase2058FinalPermissionGateEvidence(repoRoot, date, loopNumber, gateEvidence) {
  const filePath = path.join(phase2058GateDir(repoRoot), `gate-${date}-${loopNumber}.json`);
  writeJson(filePath, gateEvidence);
  return filePath;
}

function writeTerminalSafetySummaryEvidence(repoRoot, date, loopNumber, summaryEvidence) {
  const filePath = path.join(phase2053TerminalSummaryDir(repoRoot), `terminal-summary-${date}-${loopNumber}.json`);
  writeJson(filePath, summaryEvidence);
  return filePath;
}

function writeTaskCapsuleEvidence(repoRoot, date, loopNumber, capsuleEvidence) {
  const filePath = path.join(phase2054TaskCapsuleDir(repoRoot), `task-capsule-${date}-${loopNumber}.json`);
  writeJson(filePath, capsuleEvidence);
  return filePath;
}

function sanitizeCommandResults(results = []) {
  return results.map((result) => ({
    commandCategory: result.command ? "recorded" : "not_recorded",
    exitCode: Number.isInteger(result.exitCode) ? result.exitCode : null,
    passed: result.passed === true,
  }));
}

function collectCommandResults(loopEvidence) {
  return [
    ...(Array.isArray(loopEvidence.verificationResults) ? loopEvidence.verificationResults : []),
    ...(Array.isArray(loopEvidence.mutationResult?.verifierResults) ? loopEvidence.mutationResult.verifierResults : []),
  ];
}

function writePerLoopSafetyAndCapsuleEvidence(repoRoot, date, loopNumber, loopEvidence) {
  const commandResults = collectCommandResults(loopEvidence);
  const failedCommand = commandResults.find((result) => result.passed !== true);
  const terminalSummary = summarizeTerminalTranscript({
    command: commandResults.length > 0
      ? "pnpm run verify:timed-runner-loop-safe-test"
      : "gvc timed-runner loop evidence write",
    exitCode: failedCommand ? failedCommand.exitCode : 0,
    stdout: commandResults.map((result) => result.stdoutTail || "").join("\n"),
    stderr: commandResults.map((result) => result.stderrTail || "").join("\n"),
  });
  const terminalSummaryEvidence = {
    phaseId: "Phase2053-Terminal-Transcript-Safety-Summary",
    sourcePhaseId: loopEvidence.phaseId,
    generatedAt: new Date().toISOString(),
    date,
    loopNumber,
    selectedTaskId: loopEvidence.selectedTask?.taskId || null,
    ...terminalSummary,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    rawTranscriptStored: false,
    stdoutStored: false,
    stderrStored: false,
  };
  const terminalSummaryPath = writeTerminalSafetySummaryEvidence(repoRoot, date, loopNumber, terminalSummaryEvidence);

  const mutationResult = loopEvidence.mutationResult || {};
  const capsule = createTaskCapsule({
    selectedTask: loopEvidence.selectedTask || {},
    riskDecision: {
      status: loopEvidence.status,
      blocker: loopEvidence.blocker || "none",
      finalPermissionGate: loopEvidence.finalPermissionGate || null,
      permissionReconciliation: loopEvidence.permissionReconciliation || null,
      risks: loopEvidence.risks || {},
    },
    mutationPlan: loopEvidence.mutationPlan || { mutations: [] },
    verifierResult: {
      status: loopEvidence.status,
      blocker: loopEvidence.blocker || "none",
      verificationResults: sanitizeCommandResults(loopEvidence.verificationResults || []),
      mutationVerifierResults: sanitizeCommandResults(mutationResult.verifierResults || []),
    },
    rollbackStatus: {
      rollbackPerformed: mutationResult.rollbackPerformed === true,
      rollbackSucceeded: mutationResult.rollbackSucceeded ?? null,
      rollbackEvidenceRef: mutationResult.mutationEvidencePath || null,
    },
    nextActionReason: loopEvidence.blocker && loopEvidence.blocker !== "none"
      ? loopEvidence.blocker
      : loopEvidence.realExecutionPerformed === true
        ? "continue_after_low_risk_mutation"
        : "continue_or_idle_after_guarded_loop",
  });
  const taskCapsuleEvidence = {
    phaseId: "Phase2054-Agent-Loop-Memory-Snapshot",
    sourcePhaseId: loopEvidence.phaseId,
    generatedAt: new Date().toISOString(),
    date,
    loopNumber,
    capsule,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
  };
  const taskCapsulePath = writeTaskCapsuleEvidence(repoRoot, date, loopNumber, taskCapsuleEvidence);

  loopEvidence.terminalSafetySummaryRef = path.relative(repoRoot, terminalSummaryPath).replaceAll("\\", "/");
  loopEvidence.taskCapsuleRef = path.relative(repoRoot, taskCapsulePath).replaceAll("\\", "/");
  return {
    terminalSafetySummaryRef: loopEvidence.terminalSafetySummaryRef,
    taskCapsuleRef: loopEvidence.taskCapsuleRef,
  };
}

function nextActionsHasLowValueBlocked(repoRoot) {
  const nextActionsPath = path.join(repoRoot, "docs/project-brain/next-actions.json");
  if (!existsSync(nextActionsPath)) return false;
  try {
    const nextActions = JSON.parse(readFileSync(nextActionsPath, "utf8").replace(/^\uFEFF/, ""));
    return Array.isArray(nextActions.rejectedByQualityGate) &&
      nextActions.rejectedByQualityGate.some((entry) => String(entry.recommendedAction || "").includes("low_value"));
  } catch {
    return false;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function updateTouchCounts(state, mutatedFiles) {
  const counts = isRecord(state.fileTouchCounts) ? { ...state.fileTouchCounts } : {};
  for (const file of mutatedFiles || []) {
    counts[file] = (counts[file] || 0) + 1;
  }
  state.fileTouchCounts = counts;
  return counts;
}

function maxTouchCount(counts) {
  return Math.max(0, ...Object.values(counts || {}).map((value) => Number(value) || 0));
}

function buildMutationSummary(loopEvidence, state, safeOvernightPolicy, stopReason) {
  const mutationResult = loopEvidence.mutationResult || {};
  return {
    phaseId: "SafeOvernightMode-MutationSummary",
    generatedAt: new Date().toISOString(),
    date: loopEvidence.date,
    loopNumber: loopEvidence.loopNumber,
    safeOvernightModeEnabled: safeOvernightPolicy.enabled === true,
    selectedTaskId: loopEvidence.selectedTask?.taskId || null,
    status: loopEvidence.status,
    blocker: loopEvidence.blocker || stopReason || "none",
    realExecutionPerformed: loopEvidence.realExecutionPerformed === true,
    mutationCount: Number.isInteger(mutationResult.mutationCount) ? mutationResult.mutationCount : 0,
    mutatedFiles: Array.isArray(mutationResult.mutatedFiles) ? mutationResult.mutatedFiles : [],
    rollbackPerformed: mutationResult.rollbackPerformed === true,
    rollbackSucceeded: mutationResult.rollbackSucceeded ?? null,
    consecutiveNoOpLoops: state.consecutiveNoOpLoops || 0,
    consecutiveVerifierFailures: state.consecutiveVerifierFailures || 0,
    consecutiveLowValueBlockedLoops: state.consecutiveLowValueBlockedLoops || 0,
    fileTouchCounts: state.fileTouchCounts || {},
    stopReason: stopReason || null,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
  };
}

function buildLoopMutationPlan(selection, date, loopNumber) {
  if (!selection?.selected?.mutationPlan) return null;
  return {
    planId: `loop-${date}-${loopNumber}-${selection.selected.taskId}`,
    operations: selection.selected.operations || [],
    ...selection.selected.mutationPlan,
    mutations: (selection.selected.mutationPlan.mutations || []).slice(0, 1),
  };
}

function resolveOwnerApprovalDecision(lowRiskApproval) {
  if (!lowRiskApproval.valid) return "deny";
  const approval = lowRiskApproval.approval || {};
  if (approval.providerAllowed !== false || approval.secretReadAllowed !== false || approval.deployAllowed !== false || approval.chatRouteModificationAllowed !== false) {
    return "forbidden";
  }
  return approval.approved === true && approval.scope === "low_risk_only" ? "allow" : "deny";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runTimedLocalRunner(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const runnerOptions = { ...defaultOptions, ...options };
  const safeOvernightPolicy = readSafeOvernightPolicy(repoRoot);
  const state = loadState(repoRoot, runnerOptions);
  let stopRequested = false;

  const handleSignal = () => {
    stopRequested = true;
  };
  process.once("SIGINT", handleSignal);

  try {
    while (!stopRequested) {
      if (state.loopsCompletedToday >= runnerOptions.dailyLoopLimit) {
        state.status = "idle";
        state.currentBlocker = "daily_loop_limit_reached";
        state.updatedAt = new Date().toISOString();
        writeJson(statePath(repoRoot), state);
        break;
      }

      const loopNumber = state.loopsCompletedToday + 1;
      const date = state.date;
      const controlResult = readRunnerControl({ repoRoot });
      const ownerControl = controlResult.control;
      const controlMaxTasksPerLoop = Math.min(runnerOptions.maxTasksPerLoop, ownerControl.maxTasksPerLoop);
      const lowRiskApproval = readLowRiskApproval(repoRoot);
      const realExecutionLoopLimit = resolveRealExecutionLoopLimit(lowRiskApproval, safeOvernightPolicy, runnerOptions);
      const autonomousMutationEnabled =
        (runnerOptions.autonomousMutationEnabled === true || runnerOptions.dryRunOnly === false) &&
        lowRiskApproval.valid === true &&
        state.realExecutionLoopsCompletedToday < realExecutionLoopLimit;
      const controlSafetyBlocked =
        !controlResult.valid || ownerControl.dryRunOnly !== true || ownerControl.noProvider !== true || ownerControl.noSecret !== true || ownerControl.noDeploy !== true;

      if (ownerControl.stopRequested === true) {
        const stopEvidence = {
          phaseId: "Phase2021-GVC-Owner-Control-Panel",
          status: "stopped",
          generatedAt: new Date().toISOString(),
          date,
          loopNumber,
          reason: "owner_control_stop_requested",
          ownerControl,
          controlValid: controlResult.valid,
          controlReasons: controlResult.reasons,
          selectedTask: null,
          executedTaskCount: 0,
          realExecutionPerformed: false,
          providerCallsMade: false,
          secretRead: false,
          deployExecuted: false,
          deployReleasePerformed: false,
          chatModified: false,
          chatGatewayExecuteModified: false,
          legacyModified: false,
          projectContextModified: false,
          commitPerformed: false,
          pushPerformed: false,
          workspaceCleanClaimed: false,
        };
        const mutationSummaryPath = writeMutationSummaryEvidence(
          repoRoot,
          date,
          loopNumber,
          buildMutationSummary(stopEvidence, state, safeOvernightPolicy, "owner_control_stop_requested"),
        );
        stopEvidence.mutationSummaryRef = path.relative(repoRoot, mutationSummaryPath).replaceAll("\\", "/");
        const perLoopEvidenceRefs = writePerLoopSafetyAndCapsuleEvidence(repoRoot, date, loopNumber, stopEvidence);
        const evidencePath = writeLoopEvidence(repoRoot, date, loopNumber, stopEvidence);
        state.loopsCompletedToday = loopNumber;
        state.status = "stopped";
        state.lastLoopEvidenceRef = path.relative(repoRoot, evidencePath).replaceAll("\\", "/");
        state.lastMutationSummaryRef = stopEvidence.mutationSummaryRef;
        state.lastTerminalSafetySummaryRef = perLoopEvidenceRefs.terminalSafetySummaryRef;
        state.lastTaskCapsuleRef = perLoopEvidenceRefs.taskCapsuleRef;
        state.lastSelectedTaskId = null;
        state.currentBlocker = "owner_control_stop_requested";
        state.providerCallsMade = false;
        state.secretRead = false;
        state.deployExecuted = false;
        state.chatGatewayExecuteModified = false;
        state.gracefulShutdown = true;
        state.updatedAt = new Date().toISOString();
        writeJson(statePath(repoRoot), state);
        break;
      }

      if (ownerControl.paused === true) {
        const idleEvidence = {
          phaseId: "Phase2021-GVC-Owner-Control-Panel",
          status: "idle",
          generatedAt: new Date().toISOString(),
          date,
          loopNumber,
          blocker: "paused_by_owner_control",
          ownerControl,
          controlValid: controlResult.valid,
          controlReasons: controlResult.reasons,
          selectedTask: null,
          executedTaskCount: 0,
          realExecutionPerformed: false,
          providerCallsMade: false,
          secretRead: false,
          deployExecuted: false,
          deployReleasePerformed: false,
          chatModified: false,
          chatGatewayExecuteModified: false,
          legacyModified: false,
          projectContextModified: false,
          commitPerformed: false,
          pushPerformed: false,
          workspaceCleanClaimed: false,
        };
        const mutationSummaryPath = writeMutationSummaryEvidence(
          repoRoot,
          date,
          loopNumber,
          buildMutationSummary(idleEvidence, state, safeOvernightPolicy, "paused_by_owner_control"),
        );
        idleEvidence.mutationSummaryRef = path.relative(repoRoot, mutationSummaryPath).replaceAll("\\", "/");
        const perLoopEvidenceRefs = writePerLoopSafetyAndCapsuleEvidence(repoRoot, date, loopNumber, idleEvidence);
        const evidencePath = writeLoopEvidence(repoRoot, date, loopNumber, idleEvidence);
        state.loopsCompletedToday = loopNumber;
        state.status = "idle";
        state.lastLoopEvidenceRef = path.relative(repoRoot, evidencePath).replaceAll("\\", "/");
        state.lastMutationSummaryRef = idleEvidence.mutationSummaryRef;
        state.lastTerminalSafetySummaryRef = perLoopEvidenceRefs.terminalSafetySummaryRef;
        state.lastTaskCapsuleRef = perLoopEvidenceRefs.taskCapsuleRef;
        state.lastSelectedTaskId = null;
        state.currentBlocker = "paused_by_owner_control";
        state.providerCallsMade = false;
        state.secretRead = false;
        state.deployExecuted = false;
        state.chatGatewayExecuteModified = false;
        state.gracefulShutdown = false;
        state.updatedAt = new Date().toISOString();
        writeJson(statePath(repoRoot), state);
        if (runnerOptions.testMode) break;
        await sleep(runnerOptions.intervalMs);
        continue;
      }

      const selection = controlMaxTasksPerLoop > 0 ? selectAllowedTask(repoRoot, state.completedTaskIds || []) : {
        selected: null,
        decisions: [],
        skippedApprovalRequiredTasks: [],
        skippedForbiddenTasks: [],
      };
      let autoGeneratedNextActions = false;
      let activeSelection = selection;
      if (
        !activeSelection.selected &&
        controlMaxTasksPerLoop > 0 &&
        safeOvernightPolicy.enabled === true &&
        runnerOptions.autoGenerateFallbackNextActions === true
      ) {
        generateNextActions({ repoRoot });
        autoGeneratedNextActions = true;
        activeSelection = selectAllowedTask(repoRoot, []);
        state.completedTaskIds = [];
      }
      const selectedRiskGateDecision = activeSelection.selected?.decision || "deny";
      const permissionDecision = buildTimedRunnerPermissionDecision({
        task: activeSelection.selected,
        riskGateDecision: selectedRiskGateDecision,
      });
      const permissionReconciliation = reconcilePermissionWithRiskGate({
        permissionDecision,
        riskGateDecision: selectedRiskGateDecision,
      });
      const enforcementDryRun = buildTimedRunnerEnforcementDryRun({
        permissionDecision,
        reconciliation: permissionReconciliation,
      });
      const prospectiveMutationPlan = buildLoopMutationPlan(activeSelection, date, loopNumber);
      const lowRiskExecutorValidation = prospectiveMutationPlan
        ? validateLowRiskMutationPlan({
          approval: {
            ...lowRiskApproval.approval,
            maxMutationsPerLoop: 3,
          },
          plan: prospectiveMutationPlan,
        })
        : null;
      const lowRiskExecutorDecision = prospectiveMutationPlan
        ? lowRiskExecutorValidation.valid ? "allow" : "deny"
        : "deny";
      const ownerApprovalDecision = resolveOwnerApprovalDecision(lowRiskApproval);
      const finalPermissionGate = buildTimedRunnerFinalPermissionGate({
        existingRiskGateDecision: selectedRiskGateDecision,
        lowRiskExecutorDecision,
        ownerApprovalDecision,
        permissionDecision,
        reconciliation: permissionReconciliation,
      });
      const permissionDecisionEvidence = {
        phaseId: "Phase2056-GVC-Permission-Engine-Timed-Runner-Decision-Path",
        generatedAt: new Date().toISOString(),
        date,
        loopNumber,
        selectedTaskId: activeSelection.selected?.taskId || null,
        permissionDecision,
        reconciliation: permissionReconciliation,
        shadowDecisionOnly: true,
        finalExecutionGate: "existing_gvc_risk_gate_and_low_risk_executor",
        realMutationBehaviorChanged: false,
        providerCallsMade: false,
        secretRead: false,
        deployExecuted: false,
        chatModified: false,
        chatGatewayExecuteModified: false,
        legacyModified: false,
        projectContextModified: false,
      };
      const permissionDecisionPath = writePhase2056PermissionDecisionEvidence(repoRoot, date, loopNumber, permissionDecisionEvidence);
      let permissionConflictPath = null;
      if (permissionReconciliation.conflict) {
        permissionConflictPath = writePhase2056ConflictEvidence(repoRoot, date, loopNumber, {
          ...permissionDecisionEvidence,
          status: "blocked",
          blocker: "permission_risk_gate_conflict",
          conservativeDecision: permissionReconciliation.finalDecision,
          taskExecuted: false,
        });
      }
      const enforcementDryRunEvidence = {
        phaseId: "Phase2057-GVC-Permission-Enforcement-DryRun",
        generatedAt: new Date().toISOString(),
        date,
        loopNumber,
        selectedTaskId: activeSelection.selected?.taskId || null,
        enforcementDryRun,
        permissionDecision,
        reconciliation: permissionReconciliation,
        enforcementDryRunOnly: true,
        realExecutionDecisionUnchanged: true,
        finalRealGateSource: "existing_gvc_risk_gate",
        realMutationBehaviorChanged: false,
        providerCallsMade: false,
        secretRead: false,
        deployExecuted: false,
        chatModified: false,
        chatGatewayExecuteModified: false,
        legacyModified: false,
        projectContextModified: false,
      };
      const enforcementDryRunPath = writePhase2057EnforcementDryRunEvidence(repoRoot, date, loopNumber, enforcementDryRunEvidence);
      const finalPermissionGateEvidence = {
        phaseId: "Phase2058-GVC-Permission-Enforcement-Limited-Activation",
        generatedAt: new Date().toISOString(),
        date,
        loopNumber,
        selectedTaskId: activeSelection.selected?.taskId || null,
        finalPermissionGate,
        existingRiskGateDecision: selectedRiskGateDecision,
        lowRiskExecutorValidation,
        ownerApprovalDecision,
        permissionDecision,
        permissionEnforcementLimitedActivation: true,
        permissionEngineParticipatesBeforeRealMutation: true,
        realMutationPermissionExpanded: false,
        providerCallsMade: false,
        secretRead: false,
        deployExecuted: false,
        chatModified: false,
        chatGatewayExecuteModified: false,
        legacyModified: false,
        projectContextModified: false,
      };
      const finalPermissionGatePath = writePhase2058FinalPermissionGateEvidence(repoRoot, date, loopNumber, finalPermissionGateEvidence);
      const verificationResults = [];
      const loopEvidence = {
        phaseId: "Phase2019-GVC-Timed-Local-Runner-30s-DailyCap",
        status: controlSafetyBlocked ? "blocked" : "passed",
        generatedAt: new Date().toISOString(),
        date,
        loopNumber,
        intervalMs: runnerOptions.intervalMs,
        dailyLoopLimit: runnerOptions.dailyLoopLimit,
        maxTasksPerLoop: controlMaxTasksPerLoop,
        dryRunOnly: runnerOptions.dryRunOnly && ownerControl.dryRunOnly,
        safeOvernightModeEnabled: safeOvernightPolicy.enabled === true,
        safeOvernightPolicyRef: path.relative(repoRoot, safeOvernightPolicy.filePath).replaceAll("\\", "/"),
        emergencyStopFile: safeOvernightPolicy.emergencyStopFile || "docs/project-brain/runner-control.json",
        autonomousMutationEnabled,
        lowRiskApproval: {
          filePath: path.relative(repoRoot, lowRiskApproval.filePath).replaceAll("\\", "/"),
          valid: lowRiskApproval.valid,
          approved: lowRiskApproval.approval?.approved === true,
          scope: lowRiskApproval.approval?.scope || null,
          reasons: lowRiskApproval.reasons,
        },
        realExecutionLoopLimit,
        realExecutionLoopsCompletedToday: state.realExecutionLoopsCompletedToday,
        testMode: runnerOptions.testMode,
        ownerControl,
        controlValid: controlResult.valid,
        controlReasons: controlResult.reasons,
        selectedTask: activeSelection.selected,
        autoGeneratedNextActions,
        permissionDecision,
        permissionReconciliation,
        enforcementDryRun,
        finalPermissionGate,
        permissionDecisionEvidenceRef: path.relative(repoRoot, permissionDecisionPath).replaceAll("\\", "/"),
        permissionConflictEvidenceRef: permissionConflictPath
          ? path.relative(repoRoot, permissionConflictPath).replaceAll("\\", "/")
          : null,
        enforcementDryRunEvidenceRef: path.relative(repoRoot, enforcementDryRunPath).replaceAll("\\", "/"),
        finalPermissionGateEvidenceRef: path.relative(repoRoot, finalPermissionGatePath).replaceAll("\\", "/"),
        permissionEngineShadowOnly: true,
        enforcementDryRunOnly: true,
        permissionEnforcementLimitedActivation: true,
        finalExecutionGate: "existing_gvc_risk_gate_and_low_risk_executor",
        finalRealGateSource: "existing_gvc_risk_gate",
        realMutationBehaviorChangedByPermissionEngine: false,
        executedTaskCount: activeSelection.selected && !controlSafetyBlocked && permissionReconciliation.shouldExecuteTask ? 1 : 0,
        realExecutionPerformed: false,
        queueDecisions: activeSelection.decisions,
        skippedApprovalRequiredTasks: activeSelection.skippedApprovalRequiredTasks,
        skippedForbiddenTasks: activeSelection.skippedForbiddenTasks,
        verificationResults,
        providerCallsMade: false,
        secretRead: false,
        deployExecuted: false,
        deployReleasePerformed: false,
        chatModified: false,
        chatGatewayExecuteModified: false,
        legacyModified: false,
        projectContextModified: false,
        commitPerformed: false,
        pushPerformed: false,
        workspaceCleanClaimed: false,
      };

      const risks = detectSafetyRisk(loopEvidence);
      loopEvidence.risks = risks;
      if (controlSafetyBlocked) {
        loopEvidence.status = "blocked";
        loopEvidence.blocker = "owner_control_safety_flag_invalid";
        state.currentBlocker = "owner_control_safety_flag_invalid";
      } else if (finalPermissionGate.finalDecision !== "allow") {
        loopEvidence.status = "blocked";
        loopEvidence.blocker = "permission_limited_activation_blocked";
        state.currentBlocker = "permission_limited_activation_blocked";
      } else if (risks.providerRisk || risks.secretRisk || risks.deployRisk || risks.chatRouteRisk) {
        loopEvidence.status = "blocked";
        loopEvidence.blocker = "safety_risk_detected";
        state.currentBlocker = "safety_risk_detected";
      } else if (!activeSelection.selected) {
        if (activeSelection.skippedForbiddenTasks.length > 0) {
          loopEvidence.status = "blocked";
          loopEvidence.blocker = "forbidden_task_detected";
          state.currentBlocker = "forbidden_task_detected";
        } else {
          loopEvidence.status = "idle";
          loopEvidence.blocker = "no_allowed_l0_l1_l2_task";
          state.currentBlocker = "no_allowed_l0_l1_l2_task";
        }
      } else {
        if (autonomousMutationEnabled && activeSelection.selected?.mutationPlan) {
          const mutationPlan = prospectiveMutationPlan;
          const mutationResult = await executeLowRiskMutationPlan({
            repoRoot,
            approval: {
              ...lowRiskApproval.approval,
              maxMutationsPerLoop: 3,
            },
            plan: mutationPlan,
            evidenceDir: `apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner/mutations/${date}`,
          });
          loopEvidence.mutationPlan = mutationPlan;
          loopEvidence.mutationResult = mutationResult;
          loopEvidence.realExecutionPerformed = mutationResult.status === "passed";
          if (mutationResult.status === "passed") {
            state.realExecutionLoopsCompletedToday += 1;
            state.completedTaskIds = Array.from(new Set([...(state.completedTaskIds || []), activeSelection.selected.taskId]));
          } else {
            state.consecutiveVerifierFailures += 1;
            loopEvidence.status = "blocked";
            loopEvidence.blocker = mutationResult.blocker || "mutation_failed";
          }
        }
        const verificationCommands = runnerOptions.verificationCommands || requiredVerificationCommands;
        for (const [command, args] of verificationCommands) {
          if (loopEvidence.status === "blocked") break;
          const result = runCommand(repoRoot, command, args);
          verificationResults.push(result);
          if (!result.passed) break;
        }
        const failed = verificationResults.filter((result) => !result.passed);
        if (loopEvidence.status === "blocked") {
          state.currentBlocker = loopEvidence.blocker || "mutation_failed";
        } else if (failed.length > 0) {
          state.consecutiveVerifierFailures += 1;
          loopEvidence.status = "blocked";
          loopEvidence.blocker = "verifier_failed";
          state.currentBlocker = "verifier_failed";
        } else {
          state.consecutiveVerifierFailures = 0;
          loopEvidence.blocker = "none";
          state.currentBlocker = "none";
        }
      }

      const mutatedFiles = Array.isArray(loopEvidence.mutationResult?.mutatedFiles) ? loopEvidence.mutationResult.mutatedFiles : [];
      const touchCounts = updateTouchCounts(state, mutatedFiles);
      const loopNoOp = loopEvidence.realExecutionPerformed !== true;
      const lowValueBlocked = safeOvernightPolicy.enabled === true && !activeSelection.selected && nextActionsHasLowValueBlocked(repoRoot);
      state.consecutiveNoOpLoops = loopNoOp ? (state.consecutiveNoOpLoops || 0) + 1 : 0;
      state.consecutiveLowValueBlockedLoops = lowValueBlocked ? (state.consecutiveLowValueBlockedLoops || 0) + 1 : 0;

      let stopReason = null;
      if (safeOvernightPolicy.enabled === true) {
        const stopConditions = safeOvernightPolicy.stopConditions || {};
        if (loopEvidence.mutationResult?.rollbackSucceeded === false) {
          stopReason = "rollback_failed";
        } else if (maxTouchCount(touchCounts) > (stopConditions.sameFileTouchLimitPerDay || 3)) {
          stopReason = "same_file_touch_limit_reached";
        } else if ((state.consecutiveVerifierFailures || 0) >= (stopConditions.consecutiveVerifierFailLimit || 2)) {
          stopReason = "verifier_failed_twice";
        } else if ((state.consecutiveLowValueBlockedLoops || 0) >= (stopConditions.consecutiveLowValueBlockedLimit || 2)) {
          stopReason = "low_value_blocked_twice";
        } else if ((state.consecutiveNoOpLoops || 0) >= (stopConditions.consecutiveNoOpLimit || 3)) {
          stopReason = "consecutive_no_op_limit_reached";
        } else if (risks.providerRisk || risks.secretRisk || risks.deployRisk || risks.chatRouteRisk) {
          stopReason = "safety_risk_detected";
        }
      }

      if (stopReason) {
        loopEvidence.status = "stopped";
        loopEvidence.blocker = stopReason;
        state.currentBlocker = stopReason;
      }

      const mutationSummaryPath = writeMutationSummaryEvidence(repoRoot, date, loopNumber, buildMutationSummary(loopEvidence, state, safeOvernightPolicy, stopReason));
      loopEvidence.mutationSummaryRef = path.relative(repoRoot, mutationSummaryPath).replaceAll("\\", "/");
      loopEvidence.consecutiveNoOpLoops = state.consecutiveNoOpLoops || 0;
      loopEvidence.consecutiveLowValueBlockedLoops = state.consecutiveLowValueBlockedLoops || 0;
      loopEvidence.fileTouchCounts = state.fileTouchCounts || {};
      const perLoopEvidenceRefs = writePerLoopSafetyAndCapsuleEvidence(repoRoot, date, loopNumber, loopEvidence);

      const evidencePath = writeLoopEvidence(repoRoot, date, loopNumber, loopEvidence);
      state.loopsCompletedToday = loopNumber;
      state.status = loopEvidence.status;
      state.lastLoopEvidenceRef = path.relative(repoRoot, evidencePath).replaceAll("\\", "/");
      state.lastSelectedTaskId = activeSelection.selected?.taskId || null;
      state.autonomousMutationEnabled = autonomousMutationEnabled;
      state.dryRunOnly = runnerOptions.dryRunOnly;
      state.safeOvernightModeEnabled = safeOvernightPolicy.enabled === true;
      state.safeOvernightPolicyRef = path.relative(repoRoot, safeOvernightPolicy.filePath).replaceAll("\\", "/");
      state.emergencyStopFile = safeOvernightPolicy.emergencyStopFile || "docs/project-brain/runner-control.json";
      state.realExecutionLoopLimit = realExecutionLoopLimit;
      state.realExecutionLoopsCompletedToday = state.realExecutionLoopsCompletedToday || 0;
      state.lastMutationSummaryRef = loopEvidence.mutationSummaryRef;
      state.lastTerminalSafetySummaryRef = perLoopEvidenceRefs.terminalSafetySummaryRef;
      state.lastTaskCapsuleRef = perLoopEvidenceRefs.taskCapsuleRef;
      state.providerCallsMade = false;
      state.secretRead = false;
      state.deployExecuted = false;
      state.chatGatewayExecuteModified = false;
      state.gracefulShutdown = false;
      state.updatedAt = new Date().toISOString();
      writeJson(statePath(repoRoot), state);

      if (stopReason) {
        state.status = "stopped";
        state.currentBlocker = stopReason;
        writeJson(statePath(repoRoot), state);
        break;
      }
      if (loopEvidence.status === "blocked" && state.consecutiveVerifierFailures >= 2) {
        state.currentBlocker = "verifier_failed_twice";
        writeJson(statePath(repoRoot), state);
        break;
      }
      if (loopEvidence.status === "blocked" || (loopEvidence.status === "idle" && safeOvernightPolicy.enabled !== true)) {
        break;
      }
      if (runnerOptions.testMode && state.loopsCompletedToday >= runnerOptions.dailyLoopLimit) {
        state.status = "idle";
        state.currentBlocker = "daily_loop_limit_reached";
        state.updatedAt = new Date().toISOString();
        writeJson(statePath(repoRoot), state);
        break;
      }
      await sleep(runnerOptions.intervalMs);
    }
  } finally {
    process.removeListener("SIGINT", handleSignal);
    if (stopRequested) {
      state.status = "stopped";
      state.currentBlocker = "graceful_shutdown";
      state.gracefulShutdown = true;
      state.updatedAt = new Date().toISOString();
      const shutdownEvidence = {
        phaseId: "Phase2019-GVC-Timed-Local-Runner-30s-DailyCap",
        status: "stopped",
        generatedAt: new Date().toISOString(),
        reason: "graceful_shutdown",
        providerCallsMade: false,
        secretRead: false,
        deployExecuted: false,
        chatGatewayExecuteModified: false,
        workspaceCleanClaimed: false,
      };
      const shutdownLoopNumber = `${state.loopsCompletedToday + 1}-shutdown`;
      const mutationSummaryPath = writeMutationSummaryEvidence(
        repoRoot,
        state.date,
        shutdownLoopNumber,
        buildMutationSummary(shutdownEvidence, state, readSafeOvernightPolicy(repoRoot), "graceful_shutdown"),
      );
      shutdownEvidence.mutationSummaryRef = path.relative(repoRoot, mutationSummaryPath).replaceAll("\\", "/");
      const perLoopEvidenceRefs = writePerLoopSafetyAndCapsuleEvidence(repoRoot, state.date, shutdownLoopNumber, shutdownEvidence);
      writeLoopEvidence(repoRoot, state.date, shutdownLoopNumber, shutdownEvidence);
      state.lastMutationSummaryRef = shutdownEvidence.mutationSummaryRef;
      state.lastTerminalSafetySummaryRef = perLoopEvidenceRefs.terminalSafetySummaryRef;
      state.lastTaskCapsuleRef = perLoopEvidenceRefs.taskCapsuleRef;
      writeJson(statePath(repoRoot), state);
    }
  }

  return state;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runTimedLocalRunner(parseArgs(process.argv.slice(2)))
    .then((state) => {
      console.log(JSON.stringify(state, null, 2));
    })
    .catch((error) => {
      console.error(`GVC timed local runner failed: ${error.message}`);
      process.exit(1);
    });
}
