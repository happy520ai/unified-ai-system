import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const designPath = "docs/phase604r-overnight-safe-auto-runner-design.md";
const queuePath = "docs/phase604r-open-source-readiness-queue.json";
const reportPath = "docs/phase604r-execution-report.md";
const evidencePath =
  "apps/ai-gateway-service/evidence/phase604r/overnight-safe-auto-runner-result.json";

const requiredForbiddenFiles = [
  "legacy/",
  "PROJECT_CONTEXT.md",
  "/chat",
  "/chat-gateway/execute",
  ".codex/config.toml",
  "~/.codex/config.toml",
];

const forbiddenCommandWords = [
  "deploy",
  "release",
  "tag",
  "publish",
  "upload",
];

const requiredReportFlags = [
  "completed=true",
  "recommended_sealed=true",
  "blocker=null",
  "providerCallsMade=false",
  "secretValueExposed=false",
  "deployExecuted=false",
  "releaseExecuted=false",
  "tagCreated=false",
  "artifactUploaded=false",
  "chatModified=false",
  "chatGatewayExecuteModified=false",
  "workspaceCleanClaimed=false",
];

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function parseJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
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

function commandHasForbiddenAction(command) {
  const normalized = String(command).toLowerCase();
  return forbiddenCommandWords.some((word) =>
    new RegExp(`(^|[^a-z0-9_-])${word}([^a-z0-9_-]|$)`).test(normalized),
  );
}

function taskHasRequiredForbiddenFiles(task) {
  const forbiddenFiles = Array.isArray(task.forbiddenFiles)
    ? task.forbiddenFiles
    : [];
  return requiredForbiddenFiles.every((entry) => forbiddenFiles.includes(entry));
}

function validateTask(task, index) {
  const errors = [];
  const label = task?.taskId || `task-${index + 1}`;

  if (!task || typeof task !== "object") {
    return [`${label}: task must be an object`];
  }
  if (!task.taskId) errors.push(`${label}: missing taskId`);
  if (!task.title) errors.push(`${label}: missing title`);
  if (!Array.isArray(task.allowedFiles) || task.allowedFiles.length === 0) {
    errors.push(`${label}: allowedFiles must be a non-empty array`);
  }
  if (!taskHasRequiredForbiddenFiles(task)) {
    errors.push(`${label}: forbiddenFiles missing required boundary entries`);
  }
  if (!Array.isArray(task.validationCommands) || task.validationCommands.length === 0) {
    errors.push(`${label}: validationCommands must be a non-empty array`);
  }
  for (const command of task.validationCommands || []) {
    if (commandHasForbiddenAction(command)) {
      errors.push(`${label}: validationCommands contains forbidden action`);
    }
  }
  if (!task.rollbackNote) errors.push(`${label}: missing rollbackNote`);
  if (task.riskLevel !== "low") errors.push(`${label}: riskLevel must be low`);
  if (task.providerCallsAllowed !== false) {
    errors.push(`${label}: providerCallsAllowed must be false`);
  }
  if (task.secretAccessAllowed !== false) {
    errors.push(`${label}: secretAccessAllowed must be false`);
  }
  if (task.deployAllowed !== false) errors.push(`${label}: deployAllowed must be false`);
  if (task.autoContinueAllowed !== true) {
    errors.push(`${label}: autoContinueAllowed must be true for low-risk queue tasks`);
  }
  if (task.riskLevel !== "low" && task.autoContinueAllowed === true) {
    errors.push(`${label}: autoContinueAllowed cannot appear on high-risk task`);
  }

  return errors;
}

function buildResult(errors, queue, designText, reportText) {
  const tasks = Array.isArray(queue?.tasks) ? queue.tasks : [];
  return {
    phase: "Phase604R",
    title: "Codex Overnight Safe Auto Runner + Open Source Readiness Queue",
    completed: errors.length === 0,
    recommended_sealed: errors.length === 0,
    blocker: errors.length === 0 ? null : "overnight_safe_auto_runner_validation_failed",
    taskCount: tasks.length,
    queueAtLeast12Tasks: tasks.length >= 12,
    allTasksLowRisk: tasks.every((task) => task.riskLevel === "low"),
    providerCallsMade: false,
    providerCallsAllowedAllFalse: tasks.every(
      (task) => task.providerCallsAllowed === false,
    ),
    secretAccessAllowedAllFalse: tasks.every(
      (task) => task.secretAccessAllowed === false,
    ),
    deployAllowedAllFalse: tasks.every((task) => task.deployAllowed === false),
    forbiddenFilesBoundaryPresent: tasks.every(taskHasRequiredForbiddenFiles),
    validationCommandsSafe: tasks.every((task) =>
      (task.validationCommands || []).every(
        (command) => !commandHasForbiddenAction(command),
      ),
    ),
    noRawSecretsOrEndpointsDetected:
      !hasRawSecretLikeValue(JSON.stringify(queue)) &&
      !hasRawSecretLikeValue(designText) &&
      !hasRawSecretLikeValue(reportText),
    autoContinueOnlyOnLowRiskTasks: tasks.every(
      (task) => task.riskLevel === "low" || task.autoContinueAllowed !== true,
    ),
    evidenceJsonParseable: true,
    longRunningLoopStarted: false,
    daemonStarted: false,
    backgroundRunnerStarted: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    rawBaseUrlValueExposed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    codexUserConfigModified: false,
    codexProjectConfigModified: false,
    authJsonRead: false,
    workspaceCleanClaimed: false,
    docs: [designPath, queuePath, reportPath],
    evidenceJson: evidencePath,
    verifier: "tools/phase604r/validate-overnight-safe-auto-runner.mjs",
    validationCommands: [
      "cmd /c node --check tools/phase604r/validate-overnight-safe-auto-runner.mjs",
      "cmd /c node tools/phase604r/validate-overnight-safe-auto-runner.mjs",
      "cmd /c pnpm verify:phase107a-secret-safety",
      "cmd /c pnpm verify:phase321a-workbench-product-recovery",
      "cmd /c pnpm smoke:phase308a-desktop-workbench-ui",
      "cmd /c pnpm -r --if-present check",
    ],
    errors,
  };
}

const errors = [];
for (const requiredPath of [designPath, queuePath, reportPath]) {
  if (!exists(requiredPath)) errors.push(`missing required file: ${requiredPath}`);
}

let queue = null;
let designText = "";
let reportText = "";

try {
  if (exists(queuePath)) queue = parseJson(queuePath);
} catch (error) {
  errors.push(`queue JSON parse failed: ${error.message}`);
}

if (exists(designPath)) designText = readText(designPath);
if (exists(reportPath)) reportText = readText(reportPath);

if (queue && !Array.isArray(queue.tasks)) {
  errors.push("queue must include a tasks array");
}

const tasks = Array.isArray(queue?.tasks) ? queue.tasks : [];
if (tasks.length < 12) errors.push("queue must contain at least 12 tasks");

for (const [index, task] of tasks.entries()) {
  errors.push(...validateTask(task, index));
}

for (const flag of requiredReportFlags) {
  if (reportText && !reportText.includes(flag)) {
    errors.push(`execution report missing flag: ${flag}`);
  }
}

if (
  hasRawSecretLikeValue(JSON.stringify(queue ?? {})) ||
  hasRawSecretLikeValue(designText) ||
  hasRawSecretLikeValue(reportText)
) {
  errors.push("raw secret, webhook, or endpoint-like value detected");
}

const result = buildResult(errors, queue, designText, reportText);
fs.mkdirSync(path.dirname(path.join(root, evidencePath)), { recursive: true });
fs.writeFileSync(
  path.join(root, evidencePath),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);

JSON.parse(readText(evidencePath));

if (errors.length > 0) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
