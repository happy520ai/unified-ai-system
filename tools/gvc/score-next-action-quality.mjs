import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

const policyPath = "docs/project-brain/task-quality-policy.json";

function readJson(repoRoot, relativePath, fallback = null) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function uniqueCount(values) {
  return new Set((values || []).map((value) => String(value || "").toLowerCase())).size;
}

function isDocsOnlyTask(action) {
  const touches = action.touches || [];
  return touches.length > 0 && touches.every((touch) => String(touch).startsWith("docs/"));
}

function hasEvidence(action) {
  return (action.touches || []).some((touch) => String(touch).includes("/evidence/")) || Boolean(action.expectedEvidence);
}

function hasVerifier(action) {
  return (
    Boolean(action.verifierCommand) ||
    Array.isArray(action.mutationPlan?.verifierCommands) ||
    (action.touches || []).some((touch) => String(touch).includes("verify") || String(touch).includes("tools/gvc/"))
  );
}

function hasMutationPlan(action) {
  return Array.isArray(action.mutationPlan?.mutations) && action.mutationPlan.mutations.length > 0;
}

function operationRisk(action) {
  const operations = action.operations || [];
  return operations.some((operation) => [
    "provider_call",
    "secret_read",
    "deploy",
    "release",
    "tag",
    "artifact_upload",
    "push",
    "commit",
    "chat_modify",
    "chat_gateway_execute_modify",
  ].includes(operation));
}

export function scoreNextActionQuality(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const action = options.action || {};
  const existingActions = options.existingActions || [];
  const policy = options.policy || readJson(repoRoot, policyPath, {});
  const duplicateKey = `${action.title || ""}|${(action.touches || []).join("|")}`.toLowerCase();
  const duplicateRiskScore = existingActions.some((candidate) => candidate !== action && `${candidate.title || ""}|${(candidate.touches || []).join("|")}`.toLowerCase() === duplicateKey) ? 90 : 10;
  const staleRiskScore = String(action.status || "ready") === "stale" ? 90 : action.blocker ? 50 : 15;

  const ownerValueScore = Math.min(100, 35 + (hasMutationPlan(action) ? 30 : 0) + (hasEvidence(action) ? 20 : 0) + (action.priority || 0) / 5);
  const engineeringValueScore = Math.min(100, 30 + (hasVerifier(action) ? 30 : 0) + uniqueCount(action.touches || []) * 10 + (hasMutationPlan(action) ? 15 : 0));
  const evidenceValueScore = Math.min(100, 20 + (hasEvidence(action) ? 45 : 0) + (hasVerifier(action) ? 25 : 0));
  const totalScore = ownerValueScore + engineeringValueScore + evidenceValueScore - duplicateRiskScore - staleRiskScore;
  const docsOnlyLowValue = isDocsOnlyTask(action) && totalScore < policy.minAllowedTotalScore;
  const riskyOperation = operationRisk(action);
  let recommendedAction = "allow";
  const reasons = [];

  if (riskyOperation || action.riskLevel === "L3") {
    recommendedAction = "approval_required";
    reasons.push("approval_required_or_risky_operation");
  } else if (duplicateRiskScore > policy.maxDuplicateRiskScore) {
    recommendedAction = "block_duplicate";
    reasons.push("duplicate_risk_too_high");
  } else if (
    totalScore < policy.minAllowedTotalScore ||
    ownerValueScore < policy.minOwnerValueScore ||
    engineeringValueScore < policy.minEngineeringValueScore ||
    evidenceValueScore < policy.minEvidenceValueScore ||
    staleRiskScore > policy.maxStaleRiskScore ||
    docsOnlyLowValue
  ) {
    recommendedAction = "block_low_value";
    reasons.push("value_score_below_threshold");
  }

  return {
    taskId: action.taskId || "unknown",
    ownerValueScore: Math.round(ownerValueScore),
    engineeringValueScore: Math.round(engineeringValueScore),
    duplicateRiskScore: Math.round(duplicateRiskScore),
    staleRiskScore: Math.round(staleRiskScore),
    evidenceValueScore: Math.round(evidenceValueScore),
    totalScore: Math.round(totalScore),
    recommendedAction,
    reasons,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
  };
}

export function writeQualityScores(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const nextActions = readJson(repoRoot, "docs/project-brain/next-actions.json", { actions: [] });
  const scores = (nextActions.actions || []).map((action) => scoreNextActionQuality({
    repoRoot,
    action,
    existingActions: nextActions.actions || [],
  }));
  const result = {
    phaseId: "Phase2034-GVC-Autonomous-Task-Quality-Gate",
    generatedAt: new Date().toISOString(),
    scores,
    allowedCount: scores.filter((score) => score.recommendedAction === "allow").length,
    blockedLowValueCount: scores.filter((score) => score.recommendedAction === "block_low_value").length,
    blockedDuplicateCount: scores.filter((score) => score.recommendedAction === "block_duplicate").length,
    approvalRequiredCount: scores.filter((score) => score.recommendedAction === "approval_required").length,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
  };
  const outPath = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2034-gvc-task-quality-gate/task-quality-result.json");
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log(JSON.stringify(writeQualityScores(), null, 2));
}
