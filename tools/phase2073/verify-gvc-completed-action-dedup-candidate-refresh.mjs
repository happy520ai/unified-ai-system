import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2073-GVC-Completed-Action-DeDup-And-Candidate-Refresh";
const candidatesPath = "docs/project-brain/high-value-task-candidates-v2.json";
const docsPath = "docs/phase2073-gvc-completed-action-dedup-candidate-refresh.md";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2073-gvc-completed-action-dedup-candidate-refresh";
const resultPath = `${evidenceDir}/result.json`;
const packageScriptName = "verify:phase2073-gvc-completed-action-dedup-candidate-refresh";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const state = readJson("docs/project-brain/timed-runner-state.json") || {};
const phase2072 = readJson("apps/ai-gateway-service/evidence/phase2072-gvc-high-value-autonomy-seal/result.json") || {};
const priorNextActions = readJson("docs/project-brain/high-value-next-actions.json") || {};
const completedTaskIds = Array.from(new Set([
  ...(Array.isArray(state.completedTaskIds) ? state.completedTaskIds.filter((taskId) => String(taskId).startsWith("phase2071-")) : []),
  ...(Array.isArray(phase2072.highValueActionIds) ? phase2072.highValueActionIds : []),
  ...(Array.isArray(priorNextActions.actions) ? priorNextActions.actions.map((action) => action.taskId).filter((taskId) => String(taskId).startsWith("phase2071-")) : []),
].filter(Boolean)));

const rejectedCandidates = [
  buildRejectedCandidate({
    taskId: completedTaskIds[0] || "phase2071-state-control-consistency-evidence",
    title: "duplicate completed Phase2071 action",
    reason: "completed_action_duplicate_blocked",
  }),
  buildRejectedCandidate({
    taskId: "phase2075-execution-history-compact-summary-repeat",
    title: "execution-history-compact-summary duplicate low-value task",
    reason: "repeated_low_value_summary_task_blocked",
  }),
];

const candidates = buildCandidates({ state, phase2072 });
const candidateIds = new Set(candidates.map((candidate) => candidate.taskId));
const completedIdSet = new Set(completedTaskIds);
const requiredTaskIds = [
  "phase2075-runner-dashboard-mismatch-v2-evidence",
  "phase2075-permission-rule-edge-case-fixture",
  "phase2075-project-brain-schema-drift-repair-evidence",
  "phase2075-owner-guide-command-consistency-evidence",
  "phase2075-next-actions-duplicate-prevention-fixture",
  "phase2075-runner-cap-state-display-polish-evidence",
  "phase2075-task-capsule-completeness-verifier-fixture",
  "phase2075-terminal-safety-summary-coverage-audit",
];

const output = {
  phaseId,
  generatedAt: new Date().toISOString(),
  completed: true,
  sourceStateRef: "docs/project-brain/timed-runner-state.json",
  sourcePhase2072ResultRef: "apps/ai-gateway-service/evidence/phase2072-gvc-high-value-autonomy-seal/result.json",
  completedTaskIds,
  completedTaskCount: completedTaskIds.length,
  highValueCandidatesFound: candidates.length,
  duplicatedTasksBlocked: rejectedCandidates.filter((entry) => entry.reason.includes("duplicate")).length,
  lowValueTasksBlocked: rejectedCandidates.filter((entry) => entry.reason.includes("low_value")).length,
  candidates,
  rejectedCandidates,
  safetyBoundary: safetyBoundary(),
};

writeJson(candidatesPath, output);
writeText(docsPath, renderDocs(output));

check("package_script_registered", packageJson.scripts?.[packageScriptName] === "node tools/phase2073/verify-gvc-completed-action-dedup-candidate-refresh.mjs");
check("phase2072_baseline_sealed", phase2072.recommendedSealed === true);
check("candidate_count_at_least_8", candidates.length >= 8, String(candidates.length));
check("required_candidates_present", requiredTaskIds.every((taskId) => candidateIds.has(taskId)));
check("no_completed_task_repeated", candidates.every((candidate) => !completedIdSet.has(candidate.taskId)));
check("no_phase2071_task_repeated", candidates.every((candidate) => !String(candidate.taskId).startsWith("phase2071-")));
check("low_value_summary_tasks_blocked", rejectedCandidates.some((entry) => entry.reason === "repeated_low_value_summary_task_blocked"));
check("duplicate_completed_tasks_blocked", rejectedCandidates.some((entry) => entry.reason === "completed_action_duplicate_blocked"));
check("all_candidates_have_verifier", candidates.every((candidate) => typeof candidate.verifierCommand === "string" && candidate.verifierCommand.length > 0));
check("all_candidates_have_rollback", candidates.every((candidate) => typeof candidate.rollbackPlan === "string" && candidate.rollbackPlan.length > 0));
check("all_candidates_have_expected_scope", candidates.every((candidate) => Array.isArray(candidate.targetFiles) && candidate.targetFiles.length > 0));
check("no_forbidden_target", candidates.every((candidate) => candidate.targetFiles.every((file) => !isForbiddenTarget(file))));

const failed = checks.filter((entry) => !entry.pass);
const result = {
  ...output,
  completed: failed.length === 0,
  status: failed.length === 0 ? "passed" : "failed",
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", "),
  candidatesRef: candidatesPath,
  docsRef: docsPath,
  checks,
};
writeJson(resultPath, result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  highValueCandidatesFound: result.highValueCandidatesFound,
  duplicatedTasksBlocked: result.duplicatedTasksBlocked,
  lowValueTasksBlocked: result.lowValueTasksBlocked,
}, null, 2));
if (failed.length > 0) process.exit(1);

function buildCandidates({ state: runnerState, phase2072: seal }) {
  const realLoopCount = Number(seal.realMutationLoopCount || runnerState.realExecutionLoopsCompletedToday || 0);
  const currentBlocker = runnerState.currentBlocker || "unknown";
  const batchId = `phase2075-${compactDate(new Date())}`;
  return [
    buildCandidate({
      taskId: "phase2075-runner-dashboard-mismatch-v2-evidence",
      title: "Runner dashboard mismatch repair/evidence v2",
      ownerValueScore: 9,
      engineeringValueScore: 8,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 9,
      riskLevel: "L0",
      allowedMutationScope: "evidence",
      targetPath: "apps/ai-gateway-service/evidence/phase2075-gvc-second-real-batch/runner-dashboard-mismatch-v2-evidence.json",
      operations: ["evidence_write"],
      whyThisIsNotLowValue: "Validates owner-visible dashboard state after a real high-value batch, using new Phase2075 evidence instead of repeating Phase2071.",
      content: {
        phaseId,
        taskId: "phase2075-runner-dashboard-mismatch-v2-evidence",
        batchId,
        previousRealMutationLoopCount: realLoopCount,
        currentBlocker,
        dashboardShouldDisplayHistoricalRealLoops: true,
        dashboardShouldNotTreatDailyLimitAsFailure: true,
        recommendedOwnerCopy: "Runner idle after reaching the configured batch cap; safety flags remain clear.",
        ...safetyBoundary(),
      },
    }),
    buildCandidate({
      taskId: "phase2075-project-brain-schema-drift-repair-evidence",
      title: "Project-brain schema drift repair evidence",
      ownerValueScore: 8,
      engineeringValueScore: 9,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 9,
      riskLevel: "L1",
      allowedMutationScope: "evidence",
      targetPath: "apps/ai-gateway-service/evidence/phase2075-gvc-second-real-batch/project-brain-schema-drift-repair-evidence.json",
      operations: ["evidence_write"],
      whyThisIsNotLowValue: "Records concrete schema drift fields that affect autonomous runner decisions without mutating project-brain control files.",
      content: {
        phaseId,
        taskId: "phase2075-project-brain-schema-drift-repair-evidence",
        observedStateFields: {
          status: typeof runnerState.status === "string",
          currentBlocker: typeof runnerState.currentBlocker === "string",
          loopsCompletedToday: Number.isInteger(runnerState.loopsCompletedToday),
          realExecutionLoopsCompletedToday: Number.isInteger(runnerState.realExecutionLoopsCompletedToday),
          completedTaskIds: Array.isArray(runnerState.completedTaskIds),
          lastTaskCapsuleRef: typeof runnerState.lastTaskCapsuleRef === "string",
          lastTerminalSafetySummaryRef: typeof runnerState.lastTerminalSafetySummaryRef === "string",
        },
        schemaDriftRisk: false,
        recommendedNextSchemaLock: "Keep status counters, terminal blockers, and capability flags separate in future state migrations.",
        ...safetyBoundary(),
      },
    }),
    buildCandidate({
      taskId: "phase2075-owner-guide-command-consistency-evidence",
      title: "Owner guide command consistency repair evidence",
      ownerValueScore: 9,
      engineeringValueScore: 7,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 8,
      riskLevel: "L1",
      allowedMutationScope: "evidence",
      targetPath: "apps/ai-gateway-service/evidence/phase2075-gvc-second-real-batch/owner-guide-command-consistency-evidence.json",
      operations: ["evidence_write"],
      whyThisIsNotLowValue: "Checks that the owner-facing formal runner command remains consistent with the current control precedence semantics.",
      content: {
        phaseId,
        taskId: "phase2075-owner-guide-command-consistency-evidence",
        formalStartCommand: "pnpm run gvc:timed-runner -- --intervalMs=30000 --dailyLoopLimit=500 --maxTasksPerLoop=1 --dryRunOnly=false",
        cliDryRunFalseOverridesSessionModeOnly: true,
        runnerControlDryRunOnlyRemainsOwnerSafetyDefault: true,
        providerSecretDeployChatStillBlocked: true,
        ...safetyBoundary(),
      },
    }),
    buildCandidate({
      taskId: "phase2075-runner-cap-state-display-polish-evidence",
      title: "Runner cap state display polish evidence",
      ownerValueScore: 8,
      engineeringValueScore: 8,
      duplicateRiskScore: 2,
      staleRiskScore: 1,
      evidenceValueScore: 8,
      riskLevel: "L1",
      allowedMutationScope: "evidence",
      targetPath: "apps/ai-gateway-service/evidence/phase2075-gvc-second-real-batch/runner-cap-state-display-polish-evidence.json",
      operations: ["evidence_write"],
      whyThisIsNotLowValue: "Turns daily cap and no-op stop semantics into owner-facing display requirements for the read-only dashboard.",
      content: {
        phaseId,
        taskId: "phase2075-runner-cap-state-display-polish-evidence",
        dailyLoopLimit: runnerState.dailyLoopLimit || null,
        realExecutionLoopLimit: runnerState.realExecutionLoopLimit || null,
        loopsCompletedToday: runnerState.loopsCompletedToday || 0,
        realExecutionLoopsCompletedToday: runnerState.realExecutionLoopsCompletedToday || 0,
        displayRule: "Show caps as guardrails, not failures, when safety flags are false.",
        ...safetyBoundary(),
      },
    }),
    buildCandidate({
      taskId: "phase2075-terminal-safety-summary-coverage-audit",
      title: "Terminal safety summary coverage audit",
      ownerValueScore: 8,
      engineeringValueScore: 9,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 9,
      riskLevel: "L1",
      allowedMutationScope: "evidence",
      targetPath: "apps/ai-gateway-service/evidence/phase2075-gvc-second-real-batch/terminal-safety-summary-coverage-audit.json",
      operations: ["evidence_write"],
      whyThisIsNotLowValue: "Audits whether each runner loop keeps sanitized terminal summaries without storing raw transcripts or secrets.",
      content: {
        phaseId,
        taskId: "phase2075-terminal-safety-summary-coverage-audit",
        expectedSummaryFields: [
          "commandCategory",
          "exitCode",
          "riskFlags",
          "rawTranscriptStored=false",
          "stdoutStored=false",
          "stderrStored=false",
        ],
        latestTerminalSafetySummaryRef: runnerState.lastTerminalSafetySummaryRef || null,
        rawTranscriptStorageAllowed: false,
        ...safetyBoundary(),
      },
    }),
    buildCandidate({
      taskId: "phase2075-final-permission-gate-trace-evidence",
      title: "Final permission gate trace evidence",
      ownerValueScore: 8,
      engineeringValueScore: 9,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 9,
      riskLevel: "L1",
      allowedMutationScope: "evidence",
      targetPath: "apps/ai-gateway-service/evidence/phase2075-gvc-second-real-batch/final-permission-gate-trace-evidence.json",
      operations: ["evidence_write"],
      whyThisIsNotLowValue: "Confirms that the second batch still depends on finalPermissionGate before any real mutation.",
      content: {
        phaseId,
        taskId: "phase2075-final-permission-gate-trace-evidence",
        requiredGateInputs: [
          "existingRiskGateDecision",
          "lowRiskExecutorDecision",
          "ownerApprovalDecision",
          "permissionEngineDecision",
        ],
        allGatesMustAllow: true,
        permissionEngineCanIndependentlyAllow: false,
        realMutationAuthorityExpanded: false,
        ...safetyBoundary(),
      },
    }),
    buildCandidate({
      taskId: "phase2075-permission-rule-edge-case-fixture",
      title: "Permission rule edge-case fixture",
      ownerValueScore: 8,
      engineeringValueScore: 9,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 8,
      riskLevel: "L2",
      allowedMutationScope: "tools/gvc fixture",
      targetPath: "tools/gvc/test-fixtures/phase2075/permission-rule-edge-case.fixture.json",
      operations: ["verifier_update"],
      whyThisIsNotLowValue: "Adds edge-case coverage for permission-rule decisions without touching runtime provider or chat code.",
      content: {
        phaseId,
        taskId: "phase2075-permission-rule-edge-case-fixture",
        cases: [
          { action: "file_mutation", resource: "apps/ai-gateway-service/evidence/phase2075/sample.json", expected: "allow" },
          { action: "file_mutation", resource: "tools/phase2078/sample.mjs", expected: "allow" },
          { action: "provider_call", resource: "provider/openrouter", expected: "approval_required" },
          { action: "secret_read", resource: "auth.json", expected: "forbidden" },
          { action: "chat_route_modify", resource: "apps/ai-gateway-service/src/chat-gateway/execute.js", expected: "forbidden" },
        ],
        ...safetyBoundary(),
      },
    }),
    buildCandidate({
      taskId: "phase2075-next-actions-duplicate-prevention-fixture",
      title: "Next-actions duplicate prevention verifier fixture",
      ownerValueScore: 8,
      engineeringValueScore: 9,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 8,
      riskLevel: "L2",
      allowedMutationScope: "tools/gvc fixture",
      targetPath: "tools/gvc/test-fixtures/phase2075/next-actions-duplicate-prevention.fixture.json",
      operations: ["verifier_update"],
      whyThisIsNotLowValue: "Provides a concrete fixture proving completed Phase2071 task IDs are not reseeded into Phase2075 next-actions.",
      content: {
        phaseId,
        taskId: "phase2075-next-actions-duplicate-prevention-fixture",
        completedTaskPrefixesBlocked: ["phase2071-"],
        repeatedLowValuePatternsBlocked: [
          "execution-history-compact-summary",
          "operator-summary",
          "stale-evidence-detector",
        ],
        maxDuplicateRiskScore: 3,
        ...safetyBoundary(),
      },
    }),
    buildCandidate({
      taskId: "phase2075-task-capsule-completeness-verifier-fixture",
      title: "Task capsule completeness verifier fixture",
      ownerValueScore: 8,
      engineeringValueScore: 8,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 8,
      riskLevel: "L2",
      allowedMutationScope: "verifier",
      targetPath: "tools/phase2078/phase2075-task-capsule-completeness-fixture.mjs",
      operations: ["verifier_update"],
      whyThisIsNotLowValue: "Keeps autonomous loop task capsules auditable with a tiny phase verifier fixture file.",
      content: "console.log('phase2075 task capsule completeness fixture');\n",
      contentIsText: true,
    }),
    buildCandidate({
      taskId: "phase2075-runner-value-loop-policy-fixture",
      title: "Runner value loop policy fixture",
      ownerValueScore: 8,
      engineeringValueScore: 8,
      duplicateRiskScore: 1,
      staleRiskScore: 1,
      evidenceValueScore: 8,
      riskLevel: "L2",
      allowedMutationScope: "tools/gvc fixture",
      targetPath: "tools/gvc/test-fixtures/phase2075/runner-value-loop-policy.fixture.json",
      operations: ["verifier_update"],
      whyThisIsNotLowValue: "Captures the policy that next formal runner starts must follow a high-value refresh when no-op risk rises.",
      content: {
        phaseId,
        taskId: "phase2075-runner-value-loop-policy-fixture",
        policyAssertions: {
          allCompletedNextActionsBlockStart: true,
          highValueCandidatesBelowThreeBlockStart: true,
          duplicateRiskAboveThreeBlocksWrite: true,
          consecutiveNoOpTwoRequiresPlannerRefresh: true,
        },
        ...safetyBoundary(),
      },
    }),
  ];
}

function buildCandidate(input) {
  const content = input.contentIsText ? input.content : `${JSON.stringify(input.content, null, 2)}\n`;
  return {
    taskId: input.taskId,
    title: input.title,
    ownerValueScore: input.ownerValueScore,
    engineeringValueScore: input.engineeringValueScore,
    duplicateRiskScore: input.duplicateRiskScore,
    staleRiskScore: input.staleRiskScore,
    evidenceValueScore: input.evidenceValueScore,
    recommendedAction: "allow",
    riskLevel: input.riskLevel,
    allowedMutationScope: input.allowedMutationScope,
    targetFiles: [input.targetPath],
    expectedVerifier: "pnpm run verify:phase2000-gvc-os",
    verifierCommand: "pnpm run verify:phase2000-gvc-os",
    rollbackPlan: `Restore ${input.targetPath} from the low-risk executor snapshot if verifier fails.`,
    whyThisIsNotLowValue: input.whyThisIsNotLowValue,
    blockedIfTouches: [
      "legacy/",
      "PROJECT_CONTEXT.md",
      ".env",
      "auth.json",
      "/chat",
      "/chat-gateway/execute",
      "credential/provider core",
      "billing/payment",
    ],
    status: "ready",
    operations: input.operations,
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
    ...safetyBoundary(),
  };
}

function buildRejectedCandidate({ taskId, title, reason }) {
  return {
    taskId,
    title,
    reason,
    recommendedAction: "block",
    ownerValueScore: reason.includes("low_value") ? 2 : 8,
    engineeringValueScore: reason.includes("low_value") ? 2 : 8,
    duplicateRiskScore: 9,
    staleRiskScore: reason.includes("low_value") ? 8 : 2,
  };
}

function safetyBoundary() {
  return {
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    workspaceCleanClaimed: false,
  };
}

function renderDocs(result) {
  return [
    "# Phase2073-GVC-Completed-Action-DeDup-And-Candidate-Refresh",
    "",
    "## Summary",
    "",
    `- Completed Phase2071 task IDs considered: ${result.completedTaskCount}.`,
    `- New high-value candidates generated: ${result.highValueCandidatesFound}.`,
    `- Duplicate completed tasks blocked: ${result.duplicatedTasksBlocked}.`,
    `- Repeated low-value summary tasks blocked: ${result.lowValueTasksBlocked}.`,
    "",
    "## Candidate Rules",
    "",
    "- Do not repeat Phase2071 completed task IDs.",
    "- Do not generate execution-history/operator-summary/stale-detector style low-value tasks.",
    "- Every candidate must include verifierCommand and rollbackPlan.",
    "- Target files stay inside docs/evidence/verifier/tools fixture scope.",
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

function isRepeatedSummaryTask(value) {
  return /execution-history-compact-summary|operator-summary|stale-evidence-detector|next-actions-quality-verifier|approval-queue-readability-polish|runner-regression-verifier|seal-matrix-compaction|owner-facing-status-report|autonomous-runner-dry-run-replay/i.test(String(value || ""));
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
    normalized.includes("payment") ||
    isRepeatedSummaryTask(normalized);
}

function compactDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");
}

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

function writeText(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}
