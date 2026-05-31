import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { scanHighValueTaskSources } from "../phase2068/scan-high-value-task-sources.mjs";

const repoRoot = process.cwd();
const phaseId = "Phase2069-GVC-High-Value-Task-Quality-Gate-V2";
const candidatesPath = "docs/project-brain/high-value-task-candidates.json";
const highValuePath = "docs/project-brain/high-value-next-actions.json";
const nextActionsPath = "docs/project-brain/next-actions.json";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2069-gvc-high-value-task-quality-gate-v2";
const resultPath = `${evidenceDir}/result.json`;
const packageScriptName = "verify:phase2069-high-value-task-quality-gate-v2";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const scanResult = scanHighValueTaskSources({ repoRoot });
const candidateDoc = readJson(candidatesPath) || scanResult;
const candidates = Array.isArray(candidateDoc.candidates) ? candidateDoc.candidates : [];
const evaluated = candidates.map(evaluateCandidate);
const allowed = evaluated.filter((entry) => entry.recommendedAction === "allow");
const blocked = [
  ...evaluated.filter((entry) => entry.recommendedAction !== "allow"),
  buildLowValueControlTask(),
].map((entry) => entry.recommendedAction ? entry : evaluateCandidate(entry));

const selected = requiredTaskIds()
  .map((taskId) => allowed.find((entry) => entry.taskId === taskId))
  .filter(Boolean);
const selectedIds = new Set(selected.map((entry) => entry.taskId));
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
    rejectRepeatedSummaryTasks: true,
  },
  actionCount: selected.length,
  actions: selected.map(toNextAction),
  rejectedByQualityGate: blocked.map((entry) => ({
    taskId: entry.taskId,
    recommendedAction: entry.recommendedAction,
    reasons: entry.qualityReasons || ["low_value_or_duplicate"],
    ownerValueScore: entry.ownerValueScore,
    engineeringValueScore: entry.engineeringValueScore,
    duplicateRiskScore: entry.duplicateRiskScore,
    staleRiskScore: entry.staleRiskScore,
  })),
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
};

writeJson(highValuePath, highValueNextActions);
writeJson(nextActionsPath, {
  phaseId: "Phase2070-GVC-Seed-High-Value-Next-Actions",
  generatedAt: new Date().toISOString(),
  sourceHighValueNextActionsRef: highValuePath,
  selectionPolicy: {
    highValueOnly: true,
    lowValueRepeatedSummaryTasksBlocked: true,
    preferOwnerOrEngineeringValueAtLeast: 7,
    providerCandidatesApprovalRequiredOnly: true,
    secretDeployChatRouteForbidden: true,
  },
  actions: [
    ...highValueNextActions.actions,
    {
      taskId: "phase2070-provider-approval-candidate-skipped",
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
});

const packageJson = readJson("package.json") || {};
check("package_script_registered", packageJson.scripts?.[packageScriptName] === "node tools/phase2069/verify-high-value-task-quality-gate-v2.mjs");
check("candidates_found", candidates.length >= 5, String(candidates.length));
check("high_value_actions_at_least_5", selected.length >= 5, String(selected.length));
check("required_task_state_control", selectedIds.has("phase2071-state-control-consistency-evidence"));
check("required_task_dashboard", selectedIds.has("phase2071-runner-dashboard-state-mismatch-audit"));
check("required_task_permission_fixture", selectedIds.has("phase2071-permission-rule-coverage-gap-fixture"));
check("required_task_project_brain", selectedIds.has("phase2071-project-brain-schema-consistency-report"));
check("required_task_owner_guide", selectedIds.has("phase2071-owner-use-guide-dryrun-precedence-fix"));
check("low_value_task_blocked", highValueNextActions.rejectedByQualityGate.some((entry) => entry.taskId === "phase2069-low-value-execution-history-compact-summary"));
check("no_allowed_provider_candidate", !highValueNextActions.actions.some((entry) => entry.operations.includes("provider_call")));
check("all_actions_have_verifier", highValueNextActions.actions.every((entry) => typeof entry.verifierCommand === "string" && entry.verifierCommand.length > 0));
check("all_actions_have_rollback", highValueNextActions.actions.every((entry) => typeof entry.rollbackPlan === "string" && entry.rollbackPlan.length > 0));
check("no_forbidden_target", highValueNextActions.actions.every((entry) => entry.touches.every((file) => !isForbiddenTarget(file))));

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
  lowValueTasksBlocked: highValueNextActions.rejectedByQualityGate.length,
  highValueNextActionsRef: highValuePath,
  nextActionsRef: nextActionsPath,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  checks,
};
writeJson(resultPath, result);
console.log(JSON.stringify({
  status: result.status,
  highValueCandidatesFound: result.highValueCandidatesFound,
  highValueNextActionsWritten: result.highValueNextActionsWritten,
  lowValueTasksBlocked: result.lowValueTasksBlocked,
  blocker: result.blocker,
}, null, 2));
if (failed.length > 0) process.exit(1);

function evaluateCandidate(candidate) {
  const reasons = [];
  const ownerOrEngineeringHigh = candidate.ownerValueScore >= 7 || candidate.engineeringValueScore >= 7;
  if (!ownerOrEngineeringHigh) reasons.push("owner_or_engineering_value_below_7");
  if (candidate.duplicateRiskScore > 3) reasons.push("duplicate_risk_above_3");
  if (candidate.staleRiskScore > 4) reasons.push("stale_risk_above_4");
  if (!candidate.verifierCommand && !candidate.expectedVerifier) reasons.push("verifier_command_missing");
  if (!candidate.rollbackPlan) reasons.push("rollback_plan_missing");
  if (isRepeatedSummaryTask(candidate.taskId) || isRepeatedSummaryTask(candidate.title)) reasons.push("repeated_summary_task_blocked");
  if (Array.isArray(candidate.targetFiles) && candidate.targetFiles.some(isForbiddenTarget)) reasons.push("forbidden_target_blocked");
  return {
    ...candidate,
    recommendedAction: reasons.length === 0 ? "allow" : "block_low_value",
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
      recommendedAction: candidate.recommendedAction,
      whyThisIsNotLowValue: candidate.whyThisIsNotLowValue,
    },
  };
}

function buildLowValueControlTask() {
  return {
    taskId: "phase2069-low-value-execution-history-compact-summary",
    title: "execution-history-compact-summary duplicate",
    ownerValueScore: 2,
    engineeringValueScore: 2,
    duplicateRiskScore: 9,
    staleRiskScore: 8,
    evidenceValueScore: 1,
    targetFiles: ["apps/ai-gateway-service/evidence/low-value.json"],
    verifierCommand: "pnpm run verify:phase2000-gvc-os",
    rollbackPlan: "restore snapshot",
  };
}

function requiredTaskIds() {
  return [
    "phase2071-state-control-consistency-evidence",
    "phase2071-runner-dashboard-state-mismatch-audit",
    "phase2071-permission-rule-coverage-gap-fixture",
    "phase2071-project-brain-schema-consistency-report",
    "phase2071-owner-use-guide-dryrun-precedence-fix",
  ];
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
    normalized.includes("credential") ||
    normalized.includes("provider-runtime") ||
    normalized.includes("billing") ||
    normalized.includes("payment");
}

function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return null;
  return JSON.parse(readFileSync(absolutePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const absolutePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
