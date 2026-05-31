import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const batchEvidencePath =
  "apps/ai-gateway-service/evidence/phase605r/safe-auto-runner-batch-result.json";
const taskEvidenceDir = "apps/ai-gateway-service/evidence/phase605r/tasks";
const requiredDocs = [
  "docs/phase605r-safe-auto-runner-real-low-risk-batch.md",
  "docs/phase605r-docs-evidence-index.md",
  "docs/phase605r-open-source-readiness-checklist.md",
  "docs/phase605r-known-limits.md",
  "docs/phase605r-execution-report.md",
];

const requiredFalseFlags = [
  "providerCallsMade",
  "secretAccessed",
  "secretValueExposed",
  "rawWebhookAccessed",
  "webhookValueExposed",
  "rawBaseUrlValueExposed",
  "deployExecuted",
  "releaseExecuted",
  "tagCreated",
  "artifactUploaded",
  "chatModified",
  "chatGatewayExecuteModified",
  "codexUserConfigModified",
  "codexProjectConfigModified",
  "longRunningLoopStarted",
  "daemonStarted",
  "backgroundRunnerStarted",
  "workspaceCleanClaimed",
];

function resolvePath(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(resolvePath(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(resolvePath(relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function hasRawSecretLikeValue(text) {
  const patterns = [
    /sk-[A-Za-z0-9_-]{12,}/,
    /AIza[0-9A-Za-z_-]{20,}/,
    /gh[pousr]_[A-Za-z0-9_]{20,}/,
    /xox[abprs]-[A-Za-z0-9-]{20,}/,
    /Bearer\s+[A-Za-z0-9._-]{20,}/i,
    /access_token\s*[:=]\s*["'][^"']+["']/i,
    /refresh_token\s*[:=]\s*["'][^"']+["']/i,
    /id_token\s*[:=]\s*["'][^"']+["']/i,
    /webhook\s*[:=]\s*["']https?:\/\/[^"']+["']/i,
    /base_url\s*[:=]\s*["']https?:\/\/[^"']+["']/i,
    /openai_base_url\s*[:=]\s*["']https?:\/\/[^"']+["']/i,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function addFlagErrors(errors, label, object) {
  for (const flag of requiredFalseFlags) {
    if (object[flag] !== false) {
      errors.push(`${label}: ${flag} must be false`);
    }
  }
}

const errors = [];

if (!exists(batchEvidencePath)) {
  errors.push(`missing batch evidence: ${batchEvidencePath}`);
}

for (const doc of requiredDocs) {
  if (!exists(doc)) errors.push(`missing required doc: ${doc}`);
}

let batch = null;
if (exists(batchEvidencePath)) {
  try {
    batch = readJson(batchEvidencePath);
  } catch (error) {
    errors.push(`batch evidence JSON parse failed: ${error.message}`);
  }
}

const taskResults = [];
if (batch) {
  if (batch.phase !== "Phase605R") errors.push("batch phase must be Phase605R");
  if (batch.completed !== true) errors.push("batch completed must be true");
  if (batch.recommended_sealed !== true) {
    errors.push("batch recommended_sealed must be true");
  }
  if (batch.blocker !== null) errors.push("batch blocker must be null");
  if (batch.batchExecutionMode !== "one_shot_low_risk_batch") {
    errors.push("batchExecutionMode must be one_shot_low_risk_batch");
  }
  if (batch.stopOnFailure !== true) errors.push("stopOnFailure must be true");
  if (batch.highRiskBrakeArmed !== true) {
    errors.push("highRiskBrakeArmed must be true");
  }
  if (batch.highRiskBrakeTriggered !== false) {
    errors.push("highRiskBrakeTriggered must be false");
  }
  if (!Array.isArray(batch.failed) || batch.failed.length !== 0) {
    errors.push("failed must be an empty array");
  }
  if (!Number.isInteger(batch.selectedTaskCount)) {
    errors.push("selectedTaskCount must be an integer");
  } else if (batch.selectedTaskCount < 5 || batch.selectedTaskCount > 10) {
    errors.push("selectedTaskCount must be between 5 and 10");
  }
  if (batch.executedTaskCount !== batch.selectedTaskCount) {
    errors.push("executedTaskCount must match selectedTaskCount");
  }
  if (!Array.isArray(batch.taskEvidencePaths)) {
    errors.push("taskEvidencePaths must be an array");
  } else if (batch.taskEvidencePaths.length !== batch.selectedTaskCount) {
    errors.push("taskEvidencePaths length must match selectedTaskCount");
  }
  addFlagErrors(errors, "batch", batch);

  for (const evidencePath of batch.taskEvidencePaths || []) {
    if (!evidencePath.startsWith(`${taskEvidenceDir}/`)) {
      errors.push(`task evidence path outside phase605r task dir: ${evidencePath}`);
      continue;
    }
    if (!exists(evidencePath)) {
      errors.push(`missing task evidence: ${evidencePath}`);
      continue;
    }
    try {
      const task = readJson(evidencePath);
      taskResults.push(task);
      if (task.completed !== true) errors.push(`${task.taskId}: completed must be true`);
      if (task.riskLevel !== "low") errors.push(`${task.taskId}: riskLevel must be low`);
      if (task.validationExecuted !== true) {
        errors.push(`${task.taskId}: validationExecuted must be true`);
      }
      if (task.commandFailure !== false) {
        errors.push(`${task.taskId}: commandFailure must be false`);
      }
      if (task.highRiskBrakeTriggered !== false) {
        errors.push(`${task.taskId}: highRiskBrakeTriggered must be false`);
      }
      addFlagErrors(errors, task.taskId, task);
    } catch (error) {
      errors.push(`task evidence JSON parse failed: ${evidencePath}: ${error.message}`);
    }
  }
}

const generatedText = [
  batch ? JSON.stringify(batch) : "",
  ...taskResults.map((task) => JSON.stringify(task)),
  ...requiredDocs.filter(exists).map(readText),
].join("\n");

if (hasRawSecretLikeValue(generatedText)) {
  errors.push("generated Phase605R docs/evidence contain raw secret-like value");
}

const result = {
  phase: "Phase605R",
  title: "Safe Auto Runner Real Low-Risk Batch Execution Validation",
  completed: errors.length === 0,
  recommended_sealed: errors.length === 0,
  blocker: errors.length === 0 ? null : "phase605r_validation_failed",
  batchEvidencePath,
  selectedTaskCount: batch?.selectedTaskCount ?? 0,
  executedTaskCount: batch?.executedTaskCount ?? 0,
  taskEvidenceCount: taskResults.length,
  failed: errors,
};

if (errors.length > 0) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
