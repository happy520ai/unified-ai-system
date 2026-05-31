import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const queuePath = "docs/phase638r-nightly-engineering-task-queue.json";
const lastResultPath = "apps/ai-gateway-service/evidence/phase638r/nightly-runner-last-result.json";
const maxTasksDefault = 8;
const maxTasksHardLimit = 12;
const allowedRiskTiers = new Set(["low", "medium-safe"]);

const startedAt = new Date();
const timestamp = startedAt.toISOString().replace(/[:.]/g, "-");
const runDir = `apps/ai-gateway-service/evidence/phase638r/runs/${timestamp}`;
const taskDir = `${runDir}/tasks`;
const highRiskDir = `${runDir}/high-risk-gates`;

const result = {
  phase: "Phase638R",
  name: "Nightly 20:00 Safe Engineering Task Runner",
  startedAt: startedAt.toISOString(),
  endedAt: null,
  completed: false,
  recommended_sealed: false,
  blocker: null,
  scheduledTaskRegistered: false,
  nightlyRunnerAvailable: true,
  nightlyStartTimeLocal: "20:00",
  runMode: "one_shot_batch",
  daemon: false,
  infiniteLoop: false,
  phase632PreflightRequired: true,
  tokenSavingTemplateRequired: true,
  preflightPassed: false,
  selectedTaskCount: 0,
  executedTaskCount: 0,
  highRiskGateCount: 0,
  failedTasks: [],
  stoppedReason: null,
  maxTasksPerNightDefault: maxTasksDefault,
  maxTasksPerNightHardLimit: maxTasksHardLimit,
  providerCallsMade: false,
  providerCallsMadeByThisPhase: false,
  codexExecExecutedByThisPhase: false,
  authJsonRead: false,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  secretValueExposed: false,
  rawBaseUrlValueExposed: false,
  webhookValueExposed: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  providerRuntimeModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  workspaceCleanClaimed: false,
};

try {
  ensureDir(taskDir);
  ensureDir(highRiskDir);
  runPreflight();
  result.preflightPassed = true;

  const queue = readJson(queuePath);
  const tasks = Array.isArray(queue.tasks) ? queue.tasks : [];
  const maxTasks = getMaxTasks();
  const autoTasks = tasks
    .filter((task) => task.autoExecutable === true && task.gateOnly === false && allowedRiskTiers.has(task.riskTier))
    .slice(0, maxTasks);
  const highRiskTasks = tasks.filter((task) => task.riskTier === "high" || task.gateOnly === true);

  result.selectedTaskCount = autoTasks.length;
  for (const task of autoTasks) {
    const taskResult = executeSafeTask(task);
    writeJson(`${taskDir}/${task.taskId}.json`, taskResult);
    result.executedTaskCount += 1;
    if (taskResult.status !== "passed") {
      result.failedTasks.push(task.taskId);
      result.stoppedReason = `task_failed:${task.taskId}`;
      break;
    }
  }

  for (const task of highRiskTasks) {
    const gateResult = {
      taskId: task.taskId,
      title: task.title,
      riskTier: task.riskTier,
      gateOnly: true,
      autoExecuted: false,
      highRiskAutoExecute: false,
      providerCallsAllowed: false,
      secretAccessAllowed: false,
      chatModificationAllowed: false,
      chatGatewayExecuteModificationAllowed: false,
      deployAllowed: false,
      pushAllowed: false,
      commitAllowed: false,
      blocker: "high_risk_gate_only",
    };
    writeJson(`${highRiskDir}/${task.taskId}.json`, gateResult);
    result.highRiskGateCount += 1;
  }

  if (result.failedTasks.length === 0) {
    result.completed = true;
    result.recommended_sealed = true;
  } else {
    result.completed = false;
    result.recommended_sealed = false;
    result.blocker = result.stoppedReason;
  }
} catch (error) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = error instanceof Error ? error.message : String(error);
  if (result.preflightPassed !== true) {
    result.blocker = "phase632_preflight_failed";
    result.stoppedReason = "phase632_preflight_failed";
  }
} finally {
  result.endedAt = new Date().toISOString();
  writeJson(`${runDir}/nightly-runner-result.json`, result);
  writeJson(lastResultPath, result);
  console.log(JSON.stringify(result, null, 2));
  if (result.completed !== true || result.recommended_sealed !== true || result.blocker) {
    process.exitCode = 1;
  }
}

function runPreflight() {
  execFileSync("cmd", ["/c", "pnpm", "run", "preflight:phase632-token-saving"], {
    cwd: repoRoot,
    stdio: "pipe",
    windowsHide: true,
  });
}

function executeSafeTask(task) {
  const boundaryOk =
    allowedRiskTiers.has(task.riskTier) &&
    task.autoExecutable === true &&
    task.gateOnly === false &&
    task.stopOnFailure === true &&
    task.providerCallsAllowed === false &&
    task.secretAccessAllowed === false &&
    task.codexConfigWriteAllowed === false &&
    task.chatModificationAllowed === false &&
    task.chatGatewayExecuteModificationAllowed === false &&
    task.deployAllowed === false &&
    task.pushAllowed === false &&
    task.commitAllowed === false;

  const commandResults = [];
  if (boundaryOk) {
    for (const command of task.validationCommands ?? []) {
      const commandResult = runSafeValidationCommand(command);
      commandResults.push(commandResult);
      if (commandResult.exitCode !== 0) break;
    }
  }

  const commandsPassed = boundaryOk && commandResults.every((item) => item.exitCode === 0);

  return {
    taskId: task.taskId,
    title: task.title,
    riskTier: task.riskTier,
    status: commandsPassed ? "passed" : "failed",
    autoExecuted: boundaryOk && commandResults.length > 0,
    validationCommands: task.validationCommands ?? [],
    commandResults,
    providerCallsMade: false,
    secretAccessed: false,
    codexConfigModified: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    pushExecuted: false,
    commitCreated: false,
    blocker: boundaryOk ? (commandsPassed ? null : "validation_command_failed") : "task_boundary_failed",
  };
}

function runSafeValidationCommand(command) {
  const allowedPrefixes = [
    "cmd /c pnpm run preflight:phase632-token-saving",
    "cmd /c pnpm verify:phase306c-readme-agents-auto-sync-guard",
    "cmd /c pnpm smoke:phase308a-desktop-workbench-ui",
    "cmd /c pnpm verify:phase107a-secret-safety",
    "cmd /c node tools/phase637r/validate-final-system-report.mjs",
    "cmd /c node --check tools/phase638r/validate-nightly-safe-engineering-runner.mjs",
  ];
  if (!allowedPrefixes.includes(command)) {
    return {
      command,
      exitCode: 1,
      stdoutPreview: "",
      stderrPreview: "blocked unsafe nightly validation command",
    };
  }

  try {
    const cmdBody = command.replace(/^cmd\s+\/c\s+/i, "");
    const stdout = execFileSync("cmd", ["/c", cmdBody], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 120000,
    });
    return {
      command,
      exitCode: 0,
      stdoutPreview: sanitizeOutput(stdout),
      stderrPreview: "",
    };
  } catch (error) {
    return {
      command,
      exitCode: typeof error.status === "number" ? error.status : 1,
      stdoutPreview: sanitizeOutput(error.stdout ? String(error.stdout) : ""),
      stderrPreview: sanitizeOutput(error.stderr ? String(error.stderr) : error.message ?? String(error)),
    };
  }
}

function sanitizeOutput(text) {
  return text
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***")
    .replace(/(api[_-]?key\s*[:=]\s*)["']?[A-Za-z0-9_-]{8,}/gi, "$1***")
    .slice(0, 1200);
}

function getMaxTasks() {
  const raw = process.env.PHASE638R_MAX_TASKS;
  const parsed = raw ? Number.parseInt(raw, 10) : maxTasksDefault;
  if (!Number.isInteger(parsed) || parsed < 1) return maxTasksDefault;
  return Math.min(parsed, maxTasksHardLimit);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const fullPath = path.join(repoRoot, relativePath);
  ensureDir(path.dirname(relativePath));
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureDir(relativePath) {
  fs.mkdirSync(path.join(repoRoot, relativePath), { recursive: true });
}
