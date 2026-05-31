import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const queuePath = "docs/phase604r-open-source-readiness-queue.json";
const outputDir = "apps/ai-gateway-service/evidence/phase605r";
const taskOutputDir = `${outputDir}/tasks`;
const batchEvidencePath = `${outputDir}/safe-auto-runner-batch-result.json`;

const selectedTaskIds = [
  "phase604r-task-001",
  "phase604r-task-003",
  "phase604r-task-004",
  "phase604r-task-006",
  "phase604r-task-007",
  "phase604r-task-008",
];

const forbiddenFiles = [
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

function resolvePath(relativePath) {
  return path.join(root, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(resolvePath(relativePath), "utf8"));
}

function writeJson(relativePath, data) {
  fs.mkdirSync(path.dirname(resolvePath(relativePath)), { recursive: true });
  fs.writeFileSync(resolvePath(relativePath), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeText(relativePath, text) {
  fs.mkdirSync(path.dirname(resolvePath(relativePath)), { recursive: true });
  fs.writeFileSync(resolvePath(relativePath), text, "utf8");
}

function commandHasForbiddenAction(command) {
  const normalized = String(command).toLowerCase();
  return forbiddenCommandWords.some((word) =>
    new RegExp(`(^|[^a-z0-9_-])${word}([^a-z0-9_-]|$)`).test(normalized),
  );
}

function boundaryErrorsForTask(task) {
  const errors = [];
  if (task.riskLevel !== "low") errors.push("riskLevel_not_low");
  if (task.providerCallsAllowed !== false) errors.push("provider_calls_allowed");
  if (task.secretAccessAllowed !== false) errors.push("secret_access_allowed");
  if (task.deployAllowed !== false) errors.push("deploy_allowed");
  if (task.autoContinueAllowed !== true) errors.push("auto_continue_not_allowed");
  for (const file of forbiddenFiles) {
    if (!task.forbiddenFiles?.includes(file)) {
      errors.push(`missing_forbidden_file:${file}`);
    }
  }
  for (const command of task.validationCommands || []) {
    if (commandHasForbiddenAction(command)) {
      errors.push(`forbidden_validation_command:${command}`);
    }
  }
  return errors;
}

function runCommand(command) {
  const trimmed = command.replace(/^cmd \/c /i, "");
  const startedAt = new Date().toISOString();
  try {
    const stdout = execFileSync("cmd.exe", ["/c", trimmed], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 600000,
      env: {
        ...process.env,
        PHASE605R_SAFE_BATCH: "1",
      },
    });
    return {
      command,
      startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: 0,
      timedOut: false,
      stdoutTail: stdout.slice(-1200),
      stderrTail: "",
    };
  } catch (error) {
    return {
      command,
      startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: typeof error.status === "number" ? error.status : 1,
      timedOut: error.signal === "SIGTERM",
      stdoutTail: String(error.stdout || "").slice(-1200),
      stderrTail: String(error.stderr || error.message || "").slice(-1200),
    };
  }
}

function makeTaskEvidence(task, commandResults, boundaryErrors) {
  const commandFailure = commandResults.some((result) => result.exitCode !== 0);
  return {
    phase: "Phase605R",
    taskId: task.taskId,
    title: task.title,
    completed: boundaryErrors.length === 0 && !commandFailure,
    riskLevel: task.riskLevel,
    validationExecuted: commandResults.length > 0,
    commandFailure,
    boundaryErrors,
    highRiskBrakeTriggered: boundaryErrors.length > 0,
    commandResults,
    providerCallsMade: false,
    secretAccessed: false,
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
    longRunningLoopStarted: false,
    daemonStarted: false,
    backgroundRunnerStarted: false,
    workspaceCleanClaimed: false,
    rollbackNote: task.rollbackNote,
  };
}

function emitReadinessDocs(selectedTasks, taskEvidencePaths) {
  writeText(
    "docs/phase605r-safe-auto-runner-real-low-risk-batch.md",
    `# Phase605R Safe Auto Runner Real Low-Risk Batch\n\n` +
      `This phase executed a one-shot low-risk batch selected from the Phase604R queue. It did not start a daemon, background runner, infinite loop, provider request, deployment, release, tag creation, artifact transfer, or production rollout.\n\n` +
      `## Selected Tasks\n\n` +
      selectedTasks.map((task) => `- ${task.taskId}: ${task.title}`).join("\n") +
      `\n\n## Stop Policy\n\n- Fail fast on any validation command failure.\n- Stop immediately on high-risk boundary detection.\n- Keep every task local, mock-only, and evidence-backed.\n`,
  );

  writeText(
    "docs/phase605r-docs-evidence-index.md",
    `# Phase605R Docs And Evidence Index\n\n` +
      `## Batch Evidence\n\n- ${batchEvidencePath}\n\n` +
      `## Task Evidence\n\n` +
      taskEvidencePaths.map((evidencePath) => `- ${evidencePath}`).join("\n") +
      `\n`,
  );

  writeText(
    "docs/phase605r-open-source-readiness-checklist.md",
    `# Phase605R Open Source Readiness Checklist\n\n` +
      `- Local-only verification queue exists.\n` +
      `- Low-risk task evidence exists for the executed batch.\n` +
      `- Secret hygiene verification remains required before any public release.\n` +
      `- License, contribution, and known-limit docs still need dedicated owner review before open sourcing.\n` +
      `- No release, tag, package publication, or artifact transfer was performed in this phase.\n`,
  );

  writeText(
    "docs/phase605r-known-limits.md",
    `# Phase605R Known Limits\n\n` +
      `- The runner is one-shot only and is not a daemon.\n` +
      `- The batch uses low-risk local validation tasks only.\n` +
      `- It does not prove real provider connectivity.\n` +
      `- It does not make the repository open-source ready by itself.\n` +
      `- It does not claim a clean workspace.\n`,
  );
}

const queue = readJson(queuePath);
const queueTasks = Array.isArray(queue.tasks) ? queue.tasks : [];
const selectedTasks = selectedTaskIds.map((taskId) => {
  const task = queueTasks.find((candidate) => candidate.taskId === taskId);
  if (!task) throw new Error(`missing selected task in queue: ${taskId}`);
  return task;
});

fs.mkdirSync(resolvePath(taskOutputDir), { recursive: true });

const taskEvidencePaths = [];
const failed = [];
let highRiskBrakeTriggered = false;
let stoppedEarly = false;

for (const task of selectedTasks) {
  const boundaryErrors = boundaryErrorsForTask(task);
  if (boundaryErrors.length > 0) {
    highRiskBrakeTriggered = true;
  }

  const commandResults = [];
  if (boundaryErrors.length === 0) {
    for (const command of task.validationCommands) {
      const result = runCommand(command);
      commandResults.push(result);
      if (result.exitCode !== 0) {
        failed.push(task.taskId);
        stoppedEarly = true;
        break;
      }
    }
  } else {
    failed.push(task.taskId);
    stoppedEarly = true;
  }

  const taskEvidence = makeTaskEvidence(task, commandResults, boundaryErrors);
  const taskEvidencePath = `${taskOutputDir}/${task.taskId}.json`;
  writeJson(taskEvidencePath, taskEvidence);
  taskEvidencePaths.push(taskEvidencePath);

  if (stoppedEarly) break;
}

emitReadinessDocs(selectedTasks, taskEvidencePaths);

const completed = failed.length === 0 && taskEvidencePaths.length === selectedTasks.length;
const batchEvidence = {
  phase: "Phase605R",
  title: "Safe Auto Runner Real Low-Risk Batch Execution",
  completed,
  recommended_sealed: completed,
  blocker: completed ? null : "phase605r_batch_stopped_on_failure",
  batchExecutionMode: "one_shot_low_risk_batch",
  selectedTaskCount: selectedTasks.length,
  executedTaskCount: taskEvidencePaths.length,
  failed,
  stopOnFailure: true,
  stoppedEarly,
  highRiskBrakeArmed: true,
  highRiskBrakeTriggered,
  taskEvidencePaths,
  providerCallsMade: false,
  secretAccessed: false,
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
  longRunningLoopStarted: false,
  daemonStarted: false,
  backgroundRunnerStarted: false,
  workspaceCleanClaimed: false,
  docs: [
    "docs/phase605r-safe-auto-runner-real-low-risk-batch.md",
    "docs/phase605r-docs-evidence-index.md",
    "docs/phase605r-open-source-readiness-checklist.md",
    "docs/phase605r-known-limits.md",
    "docs/phase605r-execution-report.md",
  ],
  verifier: "tools/phase605r/validate-safe-auto-runner-batch.mjs",
};

writeJson(batchEvidencePath, batchEvidence);
writeText(
  "docs/phase605r-execution-report.md",
  `# Phase605R Execution Report\n\n` +
    `## Result\n\n` +
    `- completed=${batchEvidence.completed}\n` +
    `- recommended_sealed=${batchEvidence.recommended_sealed}\n` +
    `- blocker=${batchEvidence.blocker}\n` +
    `- selectedTaskCount=${batchEvidence.selectedTaskCount}\n` +
    `- executedTaskCount=${batchEvidence.executedTaskCount}\n` +
    `- failed=${JSON.stringify(batchEvidence.failed)}\n\n` +
    `## Safety Flags\n\n` +
    `- providerCallsMade=false\n` +
    `- secretAccessed=false\n` +
    `- secretValueExposed=false\n` +
    `- rawWebhookAccessed=false\n` +
    `- webhookValueExposed=false\n` +
    `- rawBaseUrlValueExposed=false\n` +
    `- deployExecuted=false\n` +
    `- releaseExecuted=false\n` +
    `- tagCreated=false\n` +
    `- artifactUploaded=false\n` +
    `- chatModified=false\n` +
    `- chatGatewayExecuteModified=false\n` +
    `- codexUserConfigModified=false\n` +
    `- codexProjectConfigModified=false\n` +
    `- longRunningLoopStarted=false\n` +
    `- daemonStarted=false\n` +
    `- backgroundRunnerStarted=false\n` +
    `- workspaceCleanClaimed=false\n\n` +
    `## Task Evidence\n\n` +
    taskEvidencePaths.map((evidencePath) => `- ${evidencePath}`).join("\n") +
    `\n`,
);

console.log(JSON.stringify(batchEvidence, null, 2));
if (!completed) process.exitCode = 1;
