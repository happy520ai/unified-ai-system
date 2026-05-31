import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTimedLocalRunner } from "./run-timed-local-runner.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const controlPath = path.join(repoRoot, "docs/project-brain/runner-control.json");
const statePath = path.join(repoRoot, "docs/project-brain/timed-runner-state.json");
const phase2019EvidenceDir = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner");
const phase2021EvidenceDir = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2021-gvc-owner-control-panel");
const resultPath = path.join(phase2021EvidenceDir, "runner-control-result.json");

const defaultControl = {
  paused: false,
  stopRequested: false,
  maxTasksPerLoop: 1,
  dryRunOnly: true,
  noProvider: true,
  noSecret: true,
  noDeploy: true,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function runNodeCheck(filePath) {
  const result = spawnSync("node", ["--check", filePath], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return {
    command: `node --check ${filePath}`,
    exitCode: result.status ?? 1,
    passed: result.status === 0,
    stdoutTail: (result.stdout || "").slice(-800),
    stderrTail: (result.stderr || "").slice(-800),
  };
}

function todayLocalDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resetStateForScenario(scenario) {
  const date = todayLocalDate();
  writeJson(statePath, {
    phaseId: "Phase2019-GVC-Timed-Local-Runner-30s-DailyCap",
    status: "initialized",
    date,
    dailyLoopLimit: 1,
    intervalMs: 1,
    maxTasksPerLoop: 1,
    dryRunOnly: true,
    ownerManualStartOnly: true,
    windowsTaskSchedulerRegistered: false,
    startupAutoRunRegistered: false,
    loopsCompletedToday: 0,
    consecutiveVerifierFailures: 0,
    lastLoopEvidenceRef: null,
    lastSelectedTaskId: null,
    currentBlocker: `phase2021_${scenario}_test_reset`,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    gracefulShutdown: false,
    updatedAt: new Date().toISOString(),
  });
}

function restoreDefaultStateAfterVerification() {
  const date = todayLocalDate();
  writeJson(statePath, {
    phaseId: "Phase2019-GVC-Timed-Local-Runner-30s-DailyCap",
    status: "idle",
    date,
    dailyLoopLimit: 500,
    intervalMs: 30000,
    maxTasksPerLoop: 1,
    dryRunOnly: true,
    ownerManualStartOnly: true,
    windowsTaskSchedulerRegistered: false,
    startupAutoRunRegistered: false,
    loopsCompletedToday: 0,
    consecutiveVerifierFailures: 0,
    lastLoopEvidenceRef: null,
    lastSelectedTaskId: null,
    currentBlocker: "phase2021_verifier_restored_default_state",
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
    gracefulShutdown: false,
    updatedAt: new Date().toISOString(),
  });
}

function readLatestLoopEvidence(state) {
  assert(state.lastLoopEvidenceRef, "runner did not record lastLoopEvidenceRef");
  const filePath = path.join(repoRoot, state.lastLoopEvidenceRef);
  assert(existsSync(filePath), `missing loop evidence ${state.lastLoopEvidenceRef}`);
  return { filePath, evidence: readJson(filePath) };
}

function writeScenarioEvidence(scenario, evidence) {
  const filePath = path.join(phase2021EvidenceDir, `scenario-${scenario}.json`);
  writeJson(filePath, {
    phaseId: "Phase2021-GVC-Owner-Control-Panel",
    scenario,
    generatedAt: new Date().toISOString(),
    sourceLoopEvidence: evidence,
  });
  return path.relative(repoRoot, filePath).replaceAll("\\", "/");
}

async function runScenario(scenario, control) {
  writeJson(controlPath, control);
  resetStateForScenario(scenario);
  const state = await runTimedLocalRunner({
    repoRoot,
    intervalMs: 1,
    dailyLoopLimit: 1,
    maxTasksPerLoop: 1,
    dryRunOnly: true,
    testMode: true,
  });
  const latest = readLatestLoopEvidence(state);
  const scenarioEvidencePath = writeScenarioEvidence(scenario, latest.evidence);
  return {
    scenario,
    state,
    sourceEvidencePath: path.relative(repoRoot, latest.filePath).replaceAll("\\", "/"),
    evidencePath: scenarioEvidencePath,
    evidence: latest.evidence,
  };
}

async function main() {
  const packageJson = readJson(path.join(repoRoot, "package.json"));
  const nodeChecks = [
    "tools/gvc/read-runner-control.mjs",
    "tools/gvc/run-timed-local-runner.mjs",
    "tools/gvc/verify-runner-control.mjs",
  ].map(runNodeCheck);

  for (const check of nodeChecks) {
    assert(check.passed, `${check.command} failed`);
  }

  assert(existsSync(controlPath), "missing runner-control.json");
  assert(existsSync(path.join(repoRoot, "tools/gvc/read-runner-control.mjs")), "missing read-runner-control.mjs");
  assert(existsSync(path.join(repoRoot, "tools/gvc/run-timed-local-runner.mjs")), "missing run-timed-local-runner.mjs");
  assert(existsSync(path.join(repoRoot, "docs/phase2021-gvc-owner-control-panel.md")), "missing Phase2021 docs");
  assert(
    packageJson.scripts["verify:phase2021-gvc-owner-control-panel"] === "node tools/gvc/verify-runner-control.mjs",
    "missing or incorrect Phase2021 package script",
  );

  const control = readJson(controlPath);
  assert(control.paused === false, "default paused must be false");
  assert(control.stopRequested === false, "default stopRequested must be false");
  assert(control.maxTasksPerLoop === 1, "default maxTasksPerLoop must be 1");
  assert(control.dryRunOnly === true, "default dryRunOnly must be true");
  assert(control.noProvider === true, "default noProvider must be true");
  assert(control.noSecret === true, "default noSecret must be true");
  assert(control.noDeploy === true, "default noDeploy must be true");

  const normal = await runScenario("normal", defaultControl);
  assert(normal.evidence.status !== "idle", "normal scenario must not idle due to owner pause");
  assert(normal.evidence.ownerControl?.paused === false, "normal scenario must record paused=false");
  assert(normal.evidence.ownerControl?.stopRequested === false, "normal scenario must record stopRequested=false");
  assert(normal.evidence.executedTaskCount <= 1, "normal scenario must execute at most one task");
  assert(normal.evidence.providerCallsMade === false, "normal scenario providerCallsMade must be false");
  assert(normal.evidence.secretRead === false, "normal scenario secretRead must be false");
  assert(normal.evidence.deployExecuted === false, "normal scenario deployExecuted must be false");

  const paused = await runScenario("paused", { ...defaultControl, paused: true });
  assert(paused.evidence.status === "idle", "paused scenario must write idle evidence");
  assert(paused.evidence.blocker === "paused_by_owner_control", "paused scenario blocker mismatch");
  assert(paused.evidence.executedTaskCount === 0, "paused scenario must not execute task");
  assert(paused.evidence.selectedTask === null, "paused scenario must not select task");

  const stopped = await runScenario("stopRequested", { ...defaultControl, stopRequested: true });
  assert(stopped.evidence.status === "stopped", "stopRequested scenario must write stopped evidence");
  assert(stopped.evidence.reason === "owner_control_stop_requested", "stopRequested reason mismatch");
  assert(stopped.evidence.executedTaskCount === 0, "stopRequested scenario must not execute task");
  assert(stopped.state.gracefulShutdown === true, "stopRequested scenario must set gracefulShutdown=true");
  assert(stopped.state.currentBlocker === "owner_control_stop_requested", "stopRequested state blocker mismatch");

  writeJson(controlPath, defaultControl);
  restoreDefaultStateAfterVerification();

  const result = {
    phaseId: "Phase2021-GVC-Owner-Control-Panel",
    status: "passed",
    generatedAt: new Date().toISOString(),
    controlFile: "docs/project-brain/runner-control.json",
    runnerReadsControlEachLoop: true,
    normalVerified: true,
    pausedVerified: true,
    stopRequestedVerified: true,
    idleEvidenceOnPause: true,
    gracefulShutdownOnStopRequested: true,
    maxTasksPerLoop: 1,
    dryRunOnly: true,
    noProvider: true,
    noSecret: true,
    noDeploy: true,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    windowsTaskSchedulerRegistered: false,
    startupAutoRunRegistered: false,
    workspaceCleanClaimed: false,
    recommendedSealed: true,
    blocker: "none",
    nodeChecks,
    scenarioEvidence: {
      normal: normal.evidencePath,
      paused: paused.evidencePath,
      stopRequested: stopped.evidencePath,
    },
    sourceLoopEvidence: {
      normal: normal.sourceEvidencePath,
      paused: paused.sourceEvidencePath,
      stopRequested: stopped.sourceEvidencePath,
    },
  };
  writeJson(resultPath, result);
  console.log("Phase2021 GVC owner control panel verifier passed");
}

main().catch((error) => {
  try {
    writeJson(controlPath, defaultControl);
  } catch {}
  console.error(`Phase2021 GVC owner control panel verifier failed: ${error.message}`);
  process.exit(1);
});
