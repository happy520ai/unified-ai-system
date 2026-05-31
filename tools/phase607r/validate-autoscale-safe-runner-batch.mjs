import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidencePath =
  "apps/ai-gateway-service/evidence/phase607r/autoscale-safe-runner-batch-result.json";
const queuePath = "docs/phase607r-autoscale-task-queue.json";
const docs = [
  "docs/phase607r-autoscale-risk-tier-gate.md",
  "docs/phase607r-autoscale-task-queue.json",
  "docs/phase607r-autoscale-safe-runner-execution-report.md",
];

function resolvePath(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(resolvePath(relativePath));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(resolvePath(relativePath), "utf8"));
}

const errors = [];
for (const doc of docs) {
  if (!exists(doc)) errors.push(`missing doc: ${doc}`);
}
if (!exists(evidencePath)) errors.push(`missing evidence: ${evidencePath}`);

let queue = null;
let evidence = null;
if (exists(queuePath)) queue = readJson(queuePath);
if (exists(evidencePath)) evidence = readJson(evidencePath);

if (queue && (!Array.isArray(queue.tasks) || queue.tasks.length < 20)) {
  errors.push("queue must contain at least 20 candidate tasks");
}

const falseFlags = [
  "highRiskExecuted",
  "providerCallsMade",
  "secretValueExposed",
  "rawBaseUrlValueExposed",
  "codexConfigModified",
  "chatModified",
  "chatGatewayExecuteModified",
  "deployExecuted",
  "releaseExecuted",
  "tagCreated",
  "artifactUploaded",
  "pushExecuted",
  "commitCreated",
  "longRunningLoopStarted",
  "daemonStarted",
  "backgroundRunnerStarted",
  "workspaceCleanClaimed",
];

if (evidence) {
  if (evidence.completed !== true) errors.push("completed must be true");
  if (evidence.recommended_sealed !== true) errors.push("recommended_sealed must be true");
  if (evidence.executedTaskCount < 12 && !evidence.insufficientTaskReason) {
    errors.push("executedTaskCount below 12 requires insufficientTaskReason");
  }
  if (evidence.executedTaskCount > 20) errors.push("executedTaskCount must be <= 20");
  if (evidence.highRiskGateGenerated !== true) errors.push("highRiskGateGenerated must be true");
  for (const flag of falseFlags) {
    if (evidence[flag] !== false) errors.push(`${flag} must be false`);
  }
  for (const taskPath of evidence.taskEvidencePaths || []) {
    if (!exists(taskPath)) errors.push(`missing task evidence: ${taskPath}`);
  }
  for (const gatePath of evidence.highRiskGatePaths || []) {
    if (!exists(gatePath)) errors.push(`missing high-risk gate evidence: ${gatePath}`);
  }
}

const result = {
  phase: "Phase607R-AutoScale",
  completed: errors.length === 0,
  recommended_sealed: errors.length === 0,
  blocker: errors.length === 0 ? null : "phase607r_autoscale_validation_failed",
  executedTaskCount: evidence?.executedTaskCount ?? 0,
  highRiskExecuted: evidence?.highRiskExecuted ?? false,
  highRiskGateGenerated: evidence?.highRiskGateGenerated ?? false,
  errors,
};

if (errors.length > 0) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
