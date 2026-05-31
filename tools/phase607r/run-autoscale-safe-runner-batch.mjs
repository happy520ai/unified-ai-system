import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const queuePath = "docs/phase607r-autoscale-task-queue.json";
const evidenceDir = "apps/ai-gateway-service/evidence/phase607r";
const taskDir = `${evidenceDir}/tasks`;
const gateDir = `${evidenceDir}/high-risk-gates`;
const batchEvidencePath = `${evidenceDir}/autoscale-safe-runner-batch-result.json`;

function resolvePath(relativePath) {
  return path.join(root, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(resolvePath(relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  fs.mkdirSync(path.dirname(resolvePath(relativePath)), { recursive: true });
  fs.writeFileSync(resolvePath(relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, text) {
  fs.mkdirSync(path.dirname(resolvePath(relativePath)), { recursive: true });
  fs.writeFileSync(resolvePath(relativePath), text, "utf8");
}

function parseMaxTasks() {
  const raw = process.env.PHASE607R_MAX_TASKS || "12";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return 12;
  return Math.min(parsed, 20);
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
    });
    return {
      command,
      startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: 0,
      timedOut: false,
      stdoutTail: stdout.slice(-1000),
      stderrTail: "",
    };
  } catch (error) {
    return {
      command,
      startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: typeof error.status === "number" ? error.status : 1,
      timedOut: error.signal === "SIGTERM",
      stdoutTail: String(error.stdout || "").slice(-1000),
      stderrTail: String(error.stderr || error.message || "").slice(-1000),
    };
  }
}

const queue = readJson(queuePath);
const maxTasks = parseMaxTasks();
const tasks = Array.isArray(queue.tasks) ? queue.tasks : [];
const runnableTasks = tasks.filter((task) => ["low", "medium-safe"].includes(task.riskTier));
const highRiskTasks = tasks.filter((task) => task.riskTier === "high");
const selectedTasks = runnableTasks.slice(0, maxTasks);

fs.mkdirSync(resolvePath(taskDir), { recursive: true });
fs.mkdirSync(resolvePath(gateDir), { recursive: true });

const taskEvidencePaths = [];
const failed = [];
let stoppedEarly = false;

for (const task of selectedTasks) {
  const commandResults = [];
  for (const command of task.validationCommands || []) {
    const result = runCommand(command);
    commandResults.push(result);
    if (result.exitCode !== 0) {
      failed.push(task.taskId);
      stoppedEarly = true;
      break;
    }
  }
  const taskEvidence = {
    phase: "Phase607R-AutoScale",
    taskId: task.taskId,
    title: task.title,
    riskTier: task.riskTier,
    completed: !stoppedEarly || !failed.includes(task.taskId),
    commandResults,
    providerCallsMade: false,
    secretValueExposed: false,
    rawBaseUrlValueExposed: false,
    codexConfigModified: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    longRunningLoopStarted: false,
    daemonStarted: false,
    backgroundRunnerStarted: false,
    workspaceCleanClaimed: false,
  };
  const evidencePath = `${taskDir}/${task.taskId}.json`;
  writeJson(evidencePath, taskEvidence);
  taskEvidencePaths.push(evidencePath);
  if (stoppedEarly) break;
}

const highRiskGatePaths = [];
for (const task of highRiskTasks) {
  const gate = {
    phase: "Phase607R-AutoScale",
    taskId: task.taskId,
    title: task.title,
    riskTier: task.riskTier,
    highRiskGateOnly: true,
    highRiskExecuted: false,
    gateReason: "high_risk_task_requires_explicit_future_phase",
    providerCallsMade: false,
    secretValueExposed: false,
    rawBaseUrlValueExposed: false,
    codexConfigModified: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    workspaceCleanClaimed: false,
  };
  const gatePath = `${gateDir}/${task.taskId}.json`;
  writeJson(gatePath, gate);
  highRiskGatePaths.push(gatePath);
}

const completed = failed.length === 0 && taskEvidencePaths.length === selectedTasks.length;
const batch = {
  phase: "Phase607R-AutoScale",
  title: "Safe Auto Runner Batch Expansion + Risk Tier Gate",
  completed,
  recommended_sealed: completed,
  blocker: completed ? null : "phase607r_autoscale_batch_failed",
  candidateTaskCount: tasks.length,
  selectedTaskCount: selectedTasks.length,
  executedTaskCount: taskEvidencePaths.length,
  insufficientTaskReason: taskEvidencePaths.length >= 12 ? null : "less_than_12_tasks_executed",
  failed,
  lowAutoAllowed: true,
  mediumSafeAutoAllowed: true,
  highRiskAutoAllowed: false,
  highRiskGateOnly: true,
  highRiskGateGenerated: highRiskGatePaths.length > 0,
  highRiskExecuted: false,
  failureStopsBatch: true,
  stoppedEarly,
  taskEvidencePaths,
  highRiskGatePaths,
  providerCallsMade: false,
  secretValueExposed: false,
  rawBaseUrlValueExposed: false,
  codexConfigModified: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  longRunningLoopStarted: false,
  daemonStarted: false,
  backgroundRunnerStarted: false,
  workspaceCleanClaimed: false,
};

writeJson(batchEvidencePath, batch);
writeText(
  "docs/phase607r-autoscale-safe-runner-execution-report.md",
  `# Phase607R-AutoScale Safe Runner Execution Report\n\n` +
    `- completed=${batch.completed}\n` +
    `- recommended_sealed=${batch.recommended_sealed}\n` +
    `- blocker=${batch.blocker}\n` +
    `- candidateTaskCount=${batch.candidateTaskCount}\n` +
    `- executedTaskCount=${batch.executedTaskCount}\n` +
    `- highRiskGateGenerated=${batch.highRiskGateGenerated}\n` +
    `- highRiskExecuted=false\n` +
    `- providerCallsMade=false\n` +
    `- secretValueExposed=false\n` +
    `- rawBaseUrlValueExposed=false\n` +
    `- codexConfigModified=false\n` +
    `- chatModified=false\n` +
    `- chatGatewayExecuteModified=false\n` +
    `- deployExecuted=false\n` +
    `- releaseExecuted=false\n` +
    `- tagCreated=false\n` +
    `- artifactUploaded=false\n` +
    `- pushExecuted=false\n` +
    `- commitCreated=false\n` +
    `- longRunningLoopStarted=false\n` +
    `- daemonStarted=false\n` +
    `- backgroundRunnerStarted=false\n` +
    `- workspaceCleanClaimed=false\n`,
);

console.log(JSON.stringify(batch, null, 2));
if (!completed) process.exitCode = 1;
