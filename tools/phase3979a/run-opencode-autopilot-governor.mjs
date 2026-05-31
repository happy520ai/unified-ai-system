import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${value}\n`, "utf8");
}

function normalizePath(input) {
  return String(input || "").replaceAll("\\", "/").replace(/^\.?\//, "");
}

function statePath(repoRoot) {
  return path.join(repoRoot, "docs/project-brain/opencode-autopilot-state.json");
}

function queuePath(repoRoot) {
  return path.join(repoRoot, "docs/automation/opencode-autopilot-task-queue.json");
}

function policyPath(repoRoot) {
  return path.join(repoRoot, "docs/project-brain/opencode-autopilot-policy.json");
}

function runnerControlPath(repoRoot) {
  return path.join(repoRoot, "docs/project-brain/runner-control.json");
}

function safePolicyPath(repoRoot) {
  return path.join(repoRoot, "docs/project-brain/safe-overnight-policy.json");
}

function evidenceDir(repoRoot) {
  return path.join(repoRoot, "apps/ai-gateway-service/evidence/phase3979a-opencode-autopilot-governor");
}

function parseArgs(argv) {
  const options = {
    repoRoot: defaultRepoRoot,
    dryRun: true,
    maxRounds: 1,
    resetState: false
  };
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, rawValue = "true"] = arg.slice(2).split("=");
    if (key === "dry-run") options.dryRun = rawValue !== "false";
    if (key === "max-rounds") options.maxRounds = Number(rawValue);
    if (key === "reset-state") options.resetState = rawValue === "true";
    if (key === "repo-root") options.repoRoot = path.resolve(rawValue);
  }
  return options;
}

function readOptionalJson(filePath, fallback) {
  return existsSync(filePath) ? readJson(filePath) : fallback;
}

function defaultRunnerControl() {
  return {
    paused: false,
    stopRequested: false,
    dryRunOnly: true,
    noProvider: true,
    noSecret: true,
    noDeploy: true
  };
}

function defaultSafePolicy() {
  return {
    enabled: false,
    emergencyStopFile: "docs/project-brain/runner-control.json"
  };
}

function defaultState() {
  return {
    phaseId: "Phase3979A-OpenCode-Autopilot-Governor",
    status: "idle",
    resumeReady: true,
    roundsCompleted: 0,
    completedTaskIds: [],
    blockedTaskIds: [],
    currentTaskId: null,
    nextTaskId: null,
    totalEstimatedRequestsUsed: 0,
    totalEstimatedCostUsdUsed: 0,
    lastBlocker: null,
    lastReportPath: null,
    lastUpdatedAt: null,
    notes: []
  };
}

function statusSnapshot(repoRoot) {
  let stdout = "";
  try {
    stdout = execFileSync(
      "git",
      [
        "-c",
        `safe.directory=${repoRoot.replaceAll("\\", "/")}`,
        "status",
        "--porcelain",
        "--untracked-files=normal"
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 32
      }
    );
  } catch (error) {
    return {
      ok: false,
      entries: {},
      stderr: String(error.stderr || "").trim(),
      stdout: String(error.stdout || "").trim(),
      error: error.message || null
    };
  }
  const entries = {};
  const lines = String(stdout || "").split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const status = line.slice(0, 2);
    const filePart = line.slice(3).trim();
    const cleaned = normalizePath(filePart.split(" -> ").pop());
    entries[cleaned] = status;
  }
  return { ok: true, entries, stderr: "" };
}

function diffStatus(before, after) {
  const paths = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...paths].filter((file) => before[file] !== after[file]).sort();
}

function isPathAllowed(file, allowedFiles, managedPaths, forbiddenPrefixes, forbiddenExactPaths) {
  const normalized = normalizePath(file);
  if (forbiddenExactPaths.includes(normalized)) return false;
  if (forbiddenPrefixes.some((prefix) => normalized.startsWith(normalizePath(prefix)))) return false;
  if (managedPaths.some((prefix) => normalized.startsWith(normalizePath(prefix)))) return true;
  return allowedFiles.some((allowed) => {
    const normalizedAllowed = normalizePath(allowed);
    return normalized === normalizedAllowed || normalized.startsWith(`${normalizedAllowed}/`);
  });
}

function commandWhitelisted(command, whitelist) {
  return whitelist.some((prefix) => String(command).startsWith(prefix));
}

function runShellCommand(repoRoot, command) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: true,
    timeout: 180000
  });
  return {
    command,
    startedAt,
    exitCode: result.status ?? 1,
    passed: result.status === 0,
    stdoutTail: (result.stdout || "").trim().slice(-1200),
    stderrTail: (result.stderr || "").trim().slice(-1200)
  };
}

function selectNextTask(queue, state) {
  const completed = new Set(state.completedTaskIds || []);
  const blocked = new Set(state.blockedTaskIds || []);
  const tasks = [...(queue.tasks || [])]
    .filter((task) => task.status !== "blocked")
    .filter((task) => !completed.has(task.taskId))
    .filter((task) => !blocked.has(task.taskId))
    .sort((left, right) => right.priority - left.priority);
  return tasks[0] || null;
}

function stageCommands(task, stageName) {
  if (stageName === "preflight") return task.preflightCommands || [];
  if (stageName === "diagnose") return task.diagnoseCommands || [];
  if (stageName === "execute") return task.executeCommands || [];
  if (stageName === "review") return task.reviewCommands || [];
  if (stageName === "verify") return task.verifyCommands || [];
  return [];
}

function buildMarkdownReport(result) {
  const lines = [
    `# ${result.phaseId} Round ${result.round}`,
    "",
    `- status: ${result.status}`,
    `- dryRun: ${result.dryRun}`,
    `- taskId: ${result.taskId || "none"}`,
    `- title: ${result.title || "none"}`,
    `- blocker: ${result.blocker || "none"}`,
    `- nextTaskId: ${result.nextTaskId || "none"}`,
    `- outOfScopeMutationDetected: ${result.outOfScopeMutationDetected}`,
    `- verifierFailed: ${result.verifierFailed}`,
    `- budgetExceeded: ${result.budgetExceeded}`,
    `- commandWhitelistViolation: ${result.commandWhitelistViolation}`,
    `- requestsUsedToday: ${result.totalEstimatedRequestsUsed}`,
    `- costUsedTodayUsd: ${result.totalEstimatedCostUsdUsed}`,
    "",
    "## Stage Results"
  ];

  for (const stage of result.stageResults || []) {
    lines.push(`- ${stage.stage}: ${stage.status}`);
    for (const command of stage.commands || []) {
      lines.push(`  - ${command.command} -> exit=${command.exitCode}`);
    }
  }

  lines.push("", "## New Touch Delta");
  if ((result.newTouchedFiles || []).length === 0) {
    lines.push("- none");
  } else {
    for (const file of result.newTouchedFiles) lines.push(`- ${file}`);
  }

  return lines.join("\n");
}

export function runOpencodeAutopilotGovernor(rawOptions = {}) {
  const options = {
    ...parseArgs([]),
    ...rawOptions
  };
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const queue = readJson(queuePath(repoRoot));
  const policy = readJson(policyPath(repoRoot));
  const runnerControl = readOptionalJson(runnerControlPath(repoRoot), defaultRunnerControl());
  const safePolicy = readOptionalJson(safePolicyPath(repoRoot), defaultSafePolicy());
  const existingState = options.resetState ? defaultState() : readOptionalJson(statePath(repoRoot), defaultState());
  const state = {
    ...defaultState(),
    ...existingState
  };

  const result = {
    phaseId: "Phase3979A-OpenCode-Autopilot-Governor",
    status: "passed",
    dryRun: options.dryRun !== false && policy.defaultDryRun !== false,
    round: (state.roundsCompleted || 0) + 1,
    taskId: null,
    title: null,
    blocker: null,
    stoppedByControl: false,
    commandWhitelistViolation: false,
    verifierFailed: false,
    outOfScopeMutationDetected: false,
    budgetExceeded: false,
    totalEstimatedRequestsUsed: state.totalEstimatedRequestsUsed || 0,
    totalEstimatedCostUsdUsed: state.totalEstimatedCostUsdUsed || 0,
    stageResults: [],
    newTouchedFiles: [],
    nextTaskId: null,
    safePolicyRef: "docs/project-brain/safe-overnight-policy.json",
    runnerControlRef: "docs/project-brain/runner-control.json",
    queueRef: "docs/automation/opencode-autopilot-task-queue.json",
    stateRef: "docs/project-brain/opencode-autopilot-state.json",
    workspaceCleanClaimed: false,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false
  };
  result.snapshotFailureDetails = null;

  if (policy.enabled !== true) {
    result.status = "blocked";
    result.blocker = "autopilot_policy_disabled";
  } else if (runnerControl.paused === true || runnerControl.stopRequested === true) {
    result.status = "stopped";
    result.blocker = runnerControl.paused === true ? "runner_control_paused" : "runner_control_stop_requested";
    result.stoppedByControl = true;
  } else if (safePolicy.enabled === true && runnerControl.dryRunOnly === false && policy.defaultDryRun === true) {
    result.status = "blocked";
    result.blocker = "runner_control_dry_run_invariant_broken";
  }

  const selectedTask = result.blocker ? null : selectNextTask(queue, state);
  if (!result.blocker && !selectedTask) {
    result.status = "stopped";
    result.blocker = "no_pending_task_available";
  }

  const beforeStatus = statusSnapshot(repoRoot);
  if (!result.blocker && beforeStatus.ok !== true) {
    result.status = "blocked";
    result.blocker = "git_status_snapshot_failed_before";
    result.snapshotFailureDetails = {
      error: beforeStatus.error || null,
      stderr: beforeStatus.stderr || "",
      stdoutTail: String(beforeStatus.stdout || "").slice(-400)
    };
  }

  if (!result.blocker && selectedTask) {
    result.taskId = selectedTask.taskId;
    result.title = selectedTask.title;

    const nextRequests = result.totalEstimatedRequestsUsed + Number(selectedTask.requestBudget || 0);
    const nextCost = result.totalEstimatedCostUsdUsed + Number(selectedTask.costBudgetUsd || 0);
    if (nextRequests > Number(policy.maxEstimatedRequestsPerDay || 0)) {
      result.status = "stopped";
      result.blocker = "estimated_request_cap_reached";
      result.budgetExceeded = true;
    } else if (nextCost > Number(policy.maxEstimatedCostUsdPerDay || 0)) {
      result.status = "stopped";
      result.blocker = "estimated_cost_cap_reached";
      result.budgetExceeded = true;
    } else {
      result.totalEstimatedRequestsUsed = nextRequests;
      result.totalEstimatedCostUsdUsed = nextCost;
    }
  }

  const stages = ["preflight", "diagnose", "execute", "review", "verify"];
  if (!result.blocker && selectedTask) {
    for (const stageName of stages) {
      const commands = stageCommands(selectedTask, stageName);
      const stageResult = {
        stage: stageName,
        status: "passed",
        commands: []
      };
      for (const command of commands) {
        if (!commandWhitelisted(command, policy.commandWhitelist || [])) {
          stageResult.status = "blocked";
          result.status = "blocked";
          result.blocker = `command_not_whitelisted:${stageName}`;
          result.commandWhitelistViolation = true;
          break;
        }
        const commandResult = runShellCommand(repoRoot, command);
        stageResult.commands.push(commandResult);
        if (!commandResult.passed) {
          stageResult.status = "failed";
          result.status = "blocked";
          result.blocker = `${stageName}_command_failed`;
          if (stageName === "verify" || stageName === "review") result.verifierFailed = true;
          break;
        }
      }
      if ((stageCommands(selectedTask, stageName) || []).length === 0) {
        stageResult.status = "noop";
      }
      result.stageResults.push(stageResult);
      if (result.blocker) break;
    }
  }

  const afterStatus = statusSnapshot(repoRoot);
  if (!result.blocker && afterStatus.ok !== true) {
    result.status = "blocked";
    result.blocker = "git_status_snapshot_failed_after";
    result.snapshotFailureDetails = {
      error: afterStatus.error || null,
      stderr: afterStatus.stderr || "",
      stdoutTail: String(afterStatus.stdout || "").slice(-400)
    };
  }

  if (!result.blocker && selectedTask) {
    const delta = diffStatus(beforeStatus.entries, afterStatus.entries);
    result.newTouchedFiles = delta;
    const allowedFiles = selectedTask.allowedFiles || [];
    const managedPaths = policy.managedPaths || [];
    const forbiddenPrefixes = policy.forbiddenPathPrefixes || [];
    const forbiddenExactPaths = (policy.forbiddenExactPaths || []).map(normalizePath);
    const outOfScope = delta.filter((file) =>
      !isPathAllowed(file, allowedFiles, managedPaths, forbiddenPrefixes, forbiddenExactPaths)
    );
    if (outOfScope.length > 0) {
      result.status = "blocked";
      result.blocker = "out_of_scope_mutation_detected";
      result.outOfScopeMutationDetected = true;
      result.newTouchedFiles = outOfScope;
    }
  }

  const updatedState = {
    ...state,
    status: result.status,
    resumeReady: true,
    roundsCompleted: result.blocker === "no_pending_task_available" ? state.roundsCompleted || 0 : result.round,
    currentTaskId: result.taskId,
    nextTaskId: null,
    totalEstimatedRequestsUsed: result.totalEstimatedRequestsUsed,
    totalEstimatedCostUsdUsed: result.totalEstimatedCostUsdUsed,
    lastBlocker: result.blocker,
    lastReportPath: null,
    lastUpdatedAt: new Date().toISOString()
  };

  if (selectedTask && result.status === "passed") {
    updatedState.completedTaskIds = [...new Set([...(state.completedTaskIds || []), selectedTask.taskId])];
  } else {
    updatedState.completedTaskIds = [...new Set(state.completedTaskIds || [])];
  }

  if (selectedTask && result.status === "blocked") {
    updatedState.blockedTaskIds = [...new Set([...(state.blockedTaskIds || []), selectedTask.taskId])];
  } else {
    updatedState.blockedTaskIds = [...new Set(state.blockedTaskIds || [])];
  }

  const nextTask = selectNextTask(queue, updatedState);
  result.nextTaskId = nextTask?.taskId || null;
  updatedState.nextTaskId = result.nextTaskId;

  const roundJsonPath = path.join(evidenceDir(repoRoot), `round-${String(result.round).padStart(4, "0")}.json`);
  const roundMdPath = path.join(evidenceDir(repoRoot), `round-${String(result.round).padStart(4, "0")}.md`);
  const latestJsonPath = path.join(evidenceDir(repoRoot), "latest-run.json");
  const latestMdPath = path.join(evidenceDir(repoRoot), "latest-run.md");
  const markdown = buildMarkdownReport(result);

  updatedState.lastReportPath = normalizePath(path.relative(repoRoot, latestJsonPath));

  writeJson(roundJsonPath, result);
  writeText(roundMdPath, markdown);
  writeJson(latestJsonPath, result);
  writeText(latestMdPath, markdown);
  writeJson(statePath(repoRoot), updatedState);

  return {
    ...result,
    state: updatedState,
    latestJsonPath,
    latestMdPath
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const result = runOpencodeAutopilotGovernor(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
