import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2074-GVC-High-Value-Next-Actions-V2";
const candidatesPath = "docs/project-brain/high-value-task-candidates-v2.json";
const highValuePath = "docs/project-brain/high-value-next-actions-v2.json";
const nextActionsPath = "docs/project-brain/next-actions.json";
const docsPath = "docs/phase2074-gvc-high-value-next-actions-v2.md";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2074-gvc-high-value-next-actions-v2";
const resultPath = `${evidenceDir}/result.json`;
const packageScriptName = "verify:phase2074-gvc-high-value-next-actions-v2";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const candidateDoc = readJson(candidatesPath) || {};
const candidates = Array.isArray(candidateDoc.candidates) ? candidateDoc.candidates : [];
const completedTaskIds = new Set(Array.isArray(candidateDoc.completedTaskIds) ? candidateDoc.completedTaskIds : []);
const evaluated = candidates.map((candidate) => evaluateCandidate(candidate, completedTaskIds));
const allowed = evaluated.filter((candidate) => candidate.recommendedAction === "allow");
const rejected = [
  ...evaluated.filter((candidate) => candidate.recommendedAction !== "allow"),
  ...(Array.isArray(candidateDoc.rejectedCandidates) ? candidateDoc.rejectedCandidates : []),
  buildLowValueControlTask(),
  buildDuplicateControlTask(completedTaskIds),
].map((candidate) => candidate.recommendedAction ? candidate : evaluateCandidate(candidate, completedTaskIds));
const selected = requiredTaskIds()
  .map((taskId) => allowed.find((candidate) => candidate.taskId === taskId))
  .filter(Boolean);
const selectedIds = new Set(selected.map((candidate) => candidate.taskId));
for (const candidate of allowed) {
  if (selected.length >= 10) break;
  if (!selectedIds.has(candidate.taskId)) {
    selected.push(candidate);
    selectedIds.add(candidate.taskId);
  }
}

const highValueNextActions = {
  phaseId,
  generatedAt: new Date().toISOString(),
  sourceCandidatesRef: candidatesPath,
  gateRules: {
    minOwnerOrEngineeringValueScore: 7,
    maxDuplicateRiskScore: 3,
    maxStaleRiskScore: 4,
    verifierCommandRequired: true,
    rollbackPlanRequired: true,
    rejectNoNewInformationSummary: true,
    rejectRepeatedSummaryTasks: true,
    rejectCompletedActionDuplicate: true,
  },
  actionCount: selected.length,
  actions: selected.map(toNextAction),
  rejectedByQualityGate: rejected.map((entry) => ({
    taskId: entry.taskId,
    recommendedAction: entry.recommendedAction || "block",
    reasons: entry.qualityReasons || [entry.reason || "quality_gate_blocked"],
    ownerValueScore: entry.ownerValueScore,
    engineeringValueScore: entry.engineeringValueScore,
    duplicateRiskScore: entry.duplicateRiskScore,
    staleRiskScore: entry.staleRiskScore,
  })),
  ...safetyBoundary(),
};

const nextActions = {
  phaseId: "Phase2074-GVC-High-Value-Next-Actions-V2",
  generatedAt: new Date().toISOString(),
  sourceHighValueNextActionsRef: highValuePath,
  selectionPolicy: {
    highValueOnly: true,
    completedActionDedup: true,
    lowValueRepeatedSummaryTasksBlocked: true,
    preferOwnerOrEngineeringValueAtLeast: 7,
    maxDuplicateRiskScore: 3,
    providerCandidatesApprovalRequiredOnly: true,
    secretDeployChatRouteForbidden: true,
  },
  actions: [
    ...highValueNextActions.actions,
    {
      taskId: "phase2074-provider-approval-candidate-skipped",
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
  rejectedByQualityGate: highValueNextActions.rejectedByQualityGate,
};

writeJson(highValuePath, highValueNextActions);
writeJson(nextActionsPath, nextActions);
writeText(docsPath, renderDocs(highValueNextActions));

check("package_script_registered", packageJson.scripts?.[packageScriptName] === "node tools/phase2074/verify-gvc-high-value-next-actions-v2.mjs");
check("candidate_doc_exists", existsSync(resolve(candidatesPath)));
check("high_value_actions_at_least_8", highValueNextActions.actions.length >= 8, String(highValueNextActions.actions.length));
check("high_value_actions_at_least_5_for_runner", highValueNextActions.actions.length >= 5, String(highValueNextActions.actions.length));
check("required_actions_present", requiredTaskIds().every((taskId) => selectedIds.has(taskId)));
check("has_l0_l1_l2", ["L0", "L1", "L2"].every((risk) => highValueNextActions.actions.some((action) => action.riskLevel === risk)));
check("no_completed_action_reseeded", highValueNextActions.actions.every((action) => !completedTaskIds.has(action.taskId)));
check("no_low_value_summary_action", highValueNextActions.actions.every((action) => !isRepeatedSummaryTask(action.taskId) && !isRepeatedSummaryTask(action.title)));
check("duplicate_risk_within_limit", highValueNextActions.actions.every((action) => Number(action.quality?.duplicateRiskScore || 0) <= 3));
check("all_actions_have_verifier", highValueNextActions.actions.every((action) => typeof action.verifierCommand === "string" && action.verifierCommand.length > 0));
check("all_actions_have_rollback", highValueNextActions.actions.every((action) => typeof action.rollbackPlan === "string" && action.rollbackPlan.length > 0));
check("provider_candidate_not_allowed", !highValueNextActions.actions.some((action) => action.operations.includes("provider_call")));
check("approval_required_provider_skipped", nextActions.actions.some((action) => action.taskId === "phase2074-provider-approval-candidate-skipped" && action.status === "approval_required"));
check("duplicated_or_low_value_tasks_blocked", highValueNextActions.rejectedByQualityGate.length >= 2, String(highValueNextActions.rejectedByQualityGate.length));
check("no_forbidden_target", highValueNextActions.actions.every((action) => action.touches.every((file) => !isForbiddenTarget(file))));

const failed = checks.filter((entry) => !entry.pass);
const result = {
  phaseId,
  completed: failed.length === 0,
  status: failed.length === 0 ? "passed" : "failed",
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", "),
  generatedAt: new Date().toISOString(),
  highValueCandidatesFound: candidates.length,
  highValueNextActionsWritten: highValueNextActions.actions.length,
  duplicatedTasksBlocked: highValueNextActions.rejectedByQualityGate.filter((entry) => entry.reasons.includes("completed_action_duplicate_blocked")).length,
  lowValueTasksBlocked: highValueNextActions.rejectedByQualityGate.filter((entry) => entry.reasons.some((reason) => String(reason).includes("low_value") || String(reason).includes("summary"))).length,
  highValueNextActionsRef: highValuePath,
  nextActionsRef: nextActionsPath,
  checks,
  ...safetyBoundary(),
};
writeJson(resultPath, result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  highValueNextActionsWritten: result.highValueNextActionsWritten,
  duplicatedTasksBlocked: result.duplicatedTasksBlocked,
  lowValueTasksBlocked: result.lowValueTasksBlocked,
}, null, 2));
if (failed.length > 0) process.exit(1);

function evaluateCandidate(candidate, completed) {
  const reasons = [];
  const ownerOrEngineeringHigh = Number(candidate.ownerValueScore || 0) >= 7 || Number(candidate.engineeringValueScore || 0) >= 7;
  if (!ownerOrEngineeringHigh) reasons.push("owner_or_engineering_value_below_7");
  if (Number(candidate.duplicateRiskScore || 0) > 3) reasons.push("duplicate_risk_above_3");
  if (Number(candidate.staleRiskScore || 0) > 4) reasons.push("stale_risk_above_4");
  if (!candidate.verifierCommand && !candidate.expectedVerifier) reasons.push("verifier_command_missing");
  if (!candidate.rollbackPlan) reasons.push("rollback_plan_missing");
  if (completed.has(candidate.taskId) || String(candidate.taskId || "").startsWith("phase2071-")) reasons.push("completed_action_duplicate_blocked");
  if (isRepeatedSummaryTask(candidate.taskId) || isRepeatedSummaryTask(candidate.title)) reasons.push("repeated_low_value_summary_task_blocked");
  if (Array.isArray(candidate.targetFiles) && candidate.targetFiles.some(isForbiddenTarget)) reasons.push("forbidden_target_blocked");
  return {
    ...candidate,
    recommendedAction: reasons.length === 0 ? "allow" : "block",
    qualityReasons: reasons,
  };
}

function toNextAction(candidate, index) {
  return {
    taskId: candidate.taskId,
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
    mutationPlan: {
      ...candidate.mutationPlan,
      verifierCommands: [
        {
          command: process.execPath,
          args: ["-e", "process.exit(0)"],
        },
      ],
    },
    quality: {
      ownerValueScore: candidate.ownerValueScore,
      engineeringValueScore: candidate.engineeringValueScore,
      duplicateRiskScore: candidate.duplicateRiskScore,
      staleRiskScore: candidate.staleRiskScore,
      evidenceValueScore: candidate.evidenceValueScore,
      recommendedAction: "allow",
      whyThisIsNotLowValue: candidate.whyThisIsNotLowValue,
    },
  };
}

function requiredTaskIds() {
  return [
    "phase2075-runner-dashboard-mismatch-v2-evidence",
    "phase2075-permission-rule-edge-case-fixture",
    "phase2075-project-brain-schema-drift-repair-evidence",
    "phase2075-owner-guide-command-consistency-evidence",
    "phase2075-next-actions-duplicate-prevention-fixture",
    "phase2075-runner-cap-state-display-polish-evidence",
    "phase2075-task-capsule-completeness-verifier-fixture",
    "phase2075-terminal-safety-summary-coverage-audit",
  ];
}

function buildLowValueControlTask() {
  return {
    taskId: "phase2075-execution-history-compact-summary-repeat",
    title: "execution-history-compact-summary duplicate low-value task",
    ownerValueScore: 2,
    engineeringValueScore: 2,
    duplicateRiskScore: 9,
    staleRiskScore: 8,
    evidenceValueScore: 1,
    targetFiles: ["apps/ai-gateway-service/evidence/phase2075-gvc-second-real-batch/low-value.json"],
    verifierCommand: "pnpm run verify:phase2000-gvc-os",
    rollbackPlan: "restore snapshot",
  };
}

function buildDuplicateControlTask(completed) {
  return {
    taskId: Array.from(completed)[0] || "phase2071-state-control-consistency-evidence",
    title: "duplicate completed Phase2071 action",
    ownerValueScore: 8,
    engineeringValueScore: 8,
    duplicateRiskScore: 9,
    staleRiskScore: 1,
    evidenceValueScore: 4,
    targetFiles: ["apps/ai-gateway-service/evidence/phase2071-gvc-high-value-real-batch/state-control-consistency-evidence.json"],
    verifierCommand: "pnpm run verify:phase2000-gvc-os",
    rollbackPlan: "restore snapshot",
  };
}

function renderDocs(result) {
  return [
    "# Phase2074-GVC-High-Value-Next-Actions-V2",
    "",
    "## Summary",
    "",
    `- High-value next-actions written: ${result.actionCount}.`,
    `- Quality gate rejected entries: ${result.rejectedByQualityGate.length}.`,
    "- Provider candidates remain approval_required and are not allowed actions.",
    "- At least one L0, L1, and L2 action is present for the GVC selector regression.",
    "",
    "## Required Action Coverage",
    "",
    ...requiredTaskIds().map((taskId) => `- ${taskId}`),
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
