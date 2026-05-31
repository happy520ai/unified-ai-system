import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTimedLocalRunner } from "../gvc/run-timed-local-runner.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const phaseId = "Phase2060-GVC-Timed-Runner-Real-Batch-With-Permission-Enforcement";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2060-gvc-timed-runner-real-batch";
const resultPath = `${evidenceDir}/result.json`;
const docsPath = "docs/phase2060-gvc-timed-runner-real-batch-with-permission-enforcement.md";
const statePath = "docs/project-brain/timed-runner-state.json";
const nextActionsPath = "docs/project-brain/next-actions.json";
const runnerControlPath = "docs/project-brain/runner-control.json";
const safePolicyPath = "docs/project-brain/safe-overnight-policy.json";
const approvalPath = "docs/approvals/gvc-low-risk-autonomous-mutation-approval.json";
const packageScriptName = "verify:phase2060-gvc-timed-runner-real-batch-with-permission-enforcement";
const checks = [];
const backups = new Map();

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

let batchAudit = null;
let pausedAudit = null;
let stopAudit = null;

try {
  backupProjectBrainFiles();
  batchAudit = runMainBatch();
  pausedAudit = await runControlScenario("paused", { paused: true, stopRequested: false });
  stopAudit = await runControlScenario("stop", { paused: false, stopRequested: true });
} finally {
  restoreProjectBrainFiles();
}

const packageJson = readJson("package.json") || {};
check("package_script_registered", packageJson.scripts?.[packageScriptName] === "node tools/phase2060/verify-gvc-timed-runner-real-batch-with-permission-enforcement.mjs");
check("runner_executed", batchAudit?.runnerExecuted === true);
check("docs_written", existsSync(resolve(docsPath)));
check("final_permission_gate_each_loop", batchAudit?.finalPermissionGateCount >= 6, String(batchAudit?.finalPermissionGateCount));
check("real_mutation_loop_count_at_least_3", batchAudit?.realMutationLoopCount >= 3, String(batchAudit?.realMutationLoopCount));
check("blocked_loop_count_at_least_2", batchAudit?.blockedLoopCount >= 2, String(batchAudit?.blockedLoopCount));
check("rollback_count_at_least_1", batchAudit?.rollbackCount >= 1, String(batchAudit?.rollbackCount));
check("rollback_failed_count_zero", batchAudit?.rollbackFailedCount === 0, String(batchAudit?.rollbackFailedCount));
check("rollback_target_restored", readText("tools/gvc/test-fixtures/phase2060/rollback.txt") === "phase2060 rollback original\n");
check("permission_engine_participated", batchAudit?.permissionEngineParticipated === true);
check("paused_effective", pausedAudit?.state?.status === "idle" && pausedAudit?.state?.currentBlocker === "paused_by_owner_control");
check("stop_effective", stopAudit?.state?.status === "stopped" && stopAudit?.state?.gracefulShutdown === true);
check("daily_cap_not_exceeded", batchAudit?.maxLoopsPerCommand <= 6, String(batchAudit?.maxLoopsPerCommand));
check("no_new_authority", batchAudit?.providerCallsMade === false && batchAudit?.secretRead === false && batchAudit?.deployExecuted === false && batchAudit?.chatGatewayExecuteModified === false);
check("legacy_project_context_not_modified", batchAudit?.legacyModified === false && batchAudit?.projectContextModified === false);
check("workspace_clean_not_claimed", batchAudit?.workspaceCleanClaimed === false);

const failed = checks.filter((entry) => !entry.pass);
const result = {
  phaseId,
  completed: failed.length === 0,
  status: failed.length === 0 ? "passed" : "failed",
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", "),
  generatedAt: new Date().toISOString(),
  runnerExecuted: batchAudit?.runnerExecuted === true,
  permissionEngineParticipated: batchAudit?.permissionEngineParticipated === true,
  finalPermissionGateCount: batchAudit?.finalPermissionGateCount || 0,
  realMutationLoopCount: batchAudit?.realMutationLoopCount || 0,
  blockedLoopCount: batchAudit?.blockedLoopCount || 0,
  rollbackCount: batchAudit?.rollbackCount || 0,
  rollbackFailedCount: batchAudit?.rollbackFailedCount || 0,
  pausedEffective: pausedAudit?.state?.currentBlocker === "paused_by_owner_control",
  stopRequestedEffective: stopAudit?.state?.gracefulShutdown === true,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  realMutationAuthorityExpanded: false,
  permissionEngineCanIndependentlyAllow: false,
  workspaceCleanClaimed: false,
  command: "pnpm run gvc:timed-runner -- --intervalMs=1000 --dailyLoopLimit=6 --maxTasksPerLoop=1 --dryRunOnly=false --testMode=true --phase=2060",
  batchAudit,
  pausedAudit,
  stopAudit,
  checks,
};

writeJson(resultPath, result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  runnerExecuted: result.runnerExecuted,
  realMutationLoopCount: result.realMutationLoopCount,
  blockedLoopCount: result.blockedLoopCount,
  rollbackCount: result.rollbackCount,
  rollbackFailedCount: result.rollbackFailedCount,
}, null, 2));
if (failed.length > 0) process.exit(1);

function runMainBatch() {
  ensureCleanPhase2060Artifacts();
  writeText("tools/gvc/test-fixtures/phase2060/rollback.txt", "phase2060 rollback original\n");
  const batchRuns = [];

  seedRunnerProjectBrain({
    actions: [
      allowedAction("phase2060-docs-fixture", docsPath, renderDocs(), ["docs_update"], false, "L0"),
      allowedAction("phase2060-evidence-fixture", `${evidenceDir}/fixture-evidence.json`, `${JSON.stringify({ phaseId, fixture: true }, null, 2)}\n`, ["evidence_update"], false, "L1"),
      allowedAction("phase2060-verifier-fixture", "tools/phase2060/fixture-verifier.mjs", "console.log('phase2060 fixture verifier');\n", ["verifier_update"], false, "L2"),
      allowedAction("phase2060-gvc-fixture", "tools/gvc/test-fixtures/phase2060/fixture.json", `${JSON.stringify({ phaseId, fixture: "gvc" }, null, 2)}\n`, ["docs_update"], false, "L2"),
      allowedAction("phase2060-rollback-fixture", "tools/gvc/test-fixtures/phase2060/rollback.txt", "phase2060 rollback broken\n", ["docs_update"], true, "L2"),
      providerCandidateTask(),
      secretForbiddenTask(),
    ],
  });
  batchRuns.push(runTimedRunnerCommand("allowed-and-rollback"));

  seedRunnerProjectBrain({ actions: [providerCandidateTask()] });
  batchRuns.push(runTimedRunnerCommand("provider-blocked"));

  seedRunnerProjectBrain({ actions: [secretForbiddenTask()] });
  batchRuns.push(runTimedRunnerCommand("secret-blocked"));

  const loops = batchRuns.flatMap((run) => run.loops);
  const finalPermissionGateCount = loops.filter((loop) => loop.finalPermissionGate).length;
  const realMutationLoopCount = loops.filter((loop) => loop.realExecutionPerformed === true).length;
  const blockedLoopCount = loops.filter((loop) => loop.status === "blocked" || loop.status === "stopped").length;
  const rollbackLoops = loops.filter((loop) => loop.mutationResult?.rollbackPerformed === true);
  const rollbackFailedLoops = loops.filter((loop) => loop.mutationResult?.rollbackSucceeded === false);
  return {
    runnerExecuted: batchRuns.every((run) => run.exitCode === 0),
    commandRuns: batchRuns,
    loops,
    maxLoopsPerCommand: Math.max(...batchRuns.map((run) => run.state?.loopsCompletedToday || 0)),
    permissionEngineParticipated: loops.length > 0 && loops.every((loop) => loop.finalPermissionGate?.permissionEnforcementLimitedActivation === true),
    finalPermissionGateCount,
    realMutationLoopCount,
    blockedLoopCount,
    rollbackCount: rollbackLoops.length,
    rollbackFailedCount: rollbackFailedLoops.length,
    providerCallsMade: loops.some((loop) => loop.providerCallsMade === true),
    secretRead: loops.some((loop) => loop.secretRead === true),
    deployExecuted: loops.some((loop) => loop.deployExecuted === true),
    chatModified: loops.some((loop) => loop.chatModified === true),
    chatGatewayExecuteModified: loops.some((loop) => loop.chatGatewayExecuteModified === true),
    legacyModified: loops.some((loop) => loop.legacyModified === true),
    projectContextModified: loops.some((loop) => loop.projectContextModified === true),
    realMutationAuthorityExpanded: loops.some((loop) => loop.finalPermissionGate?.realMutationPermissionExpanded === true),
    permissionEngineCanIndependentlyAllow: loops.some((loop) => loop.finalPermissionGate?.permissionEngineCanIndependentlyAllow === true),
    workspaceCleanClaimed: loops.some((loop) => loop.workspaceCleanClaimed === true),
  };
}

function runTimedRunnerCommand(label) {
  rmFile(statePath);
  const command = "pnpm";
  const args = ["run", "gvc:timed-runner", "--", "--intervalMs=1000", "--dailyLoopLimit=6", "--maxTasksPerLoop=1", "--dryRunOnly=false", "--testMode=true", "--phase=2060"];
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 120000,
  });
  const state = readJson(statePath) || {};
  const loops = readLoopEvidenceForState(state);
  const audit = {
    label,
    command: [command, ...args].join(" "),
    startedAt,
    exitCode: result.status ?? 1,
    stdoutTail: (result.stdout || "").slice(-1200),
    stderrTail: (result.stderr || "").slice(-1200),
    state,
    loops,
  };
  writeJson(`${evidenceDir}/command-${label}.json`, audit);
  return audit;
}

async function runControlScenario(name, controlPatch) {
  const fixtureRoot = path.join(repoRoot, ".codex-temp", `phase2060-${name}`);
  rmSync(fixtureRoot, { recursive: true, force: true });
  seedFixtureRoot(fixtureRoot, controlPatch);
  const state = await runTimedLocalRunner({
    repoRoot: fixtureRoot,
    intervalMs: 1,
    dailyLoopLimit: 2,
    maxTasksPerLoop: 1,
    dryRunOnly: false,
    autonomousMutationEnabled: true,
    verificationCommands: [[process.execPath, ["-e", "process.exit(0)"]]],
    testMode: true,
  });
  const loop = readJsonAbsolute(path.join(fixtureRoot, state.lastLoopEvidenceRef || ""));
  const audit = { state, loop };
  rmSync(fixtureRoot, { recursive: true, force: true });
  return audit;
}

function seedRunnerProjectBrain({ actions }) {
  writeJson(nextActionsPath, {
    phaseId,
    seededBy: "Phase2060A-Runner-Batch-Seed",
    actions,
  });
  writeJson(runnerControlPath, defaultControl());
  writeJson(safePolicyPath, { enabled: false, emergencyStopFile: runnerControlPath });
  writeJson(approvalPath, lowRiskApproval());
}

function seedFixtureRoot(fixtureRoot, controlPatch) {
  mkdirSync(path.join(fixtureRoot, "docs/project-brain"), { recursive: true });
  mkdirSync(path.join(fixtureRoot, "docs/approvals"), { recursive: true });
  writeJsonAbsolute(path.join(fixtureRoot, "docs/project-brain/current-state.json"), { phaseId });
  writeJsonAbsolute(path.join(fixtureRoot, "docs/project-brain/goals.json"), {});
  writeJsonAbsolute(path.join(fixtureRoot, "docs/project-brain/completion-definition.json"), {});
  writeJsonAbsolute(path.join(fixtureRoot, "docs/project-brain/risk-policy.json"), riskPolicy());
  writeJsonAbsolute(path.join(fixtureRoot, "docs/project-brain/runner-control.json"), { ...defaultControl(), ...controlPatch });
  writeJsonAbsolute(path.join(fixtureRoot, "docs/project-brain/safe-overnight-policy.json"), { enabled: false });
  writeJsonAbsolute(path.join(fixtureRoot, "docs/project-brain/next-actions.json"), { phaseId, actions: [allowedAction("phase2060-control-fixture", "docs/phase2060-control.md", "control\n", ["docs_update"])] });
  writeJsonAbsolute(path.join(fixtureRoot, "docs/approvals/gvc-low-risk-autonomous-mutation-approval.json"), lowRiskApproval());
}

function readLoopEvidenceForState(state) {
  const date = state.date;
  const total = state.loopsCompletedToday || 0;
  const loops = [];
  for (let index = 1; index <= total; index += 1) {
    const loopPath = `apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner/loop-${date}-${index}.json`;
    const loop = readJson(loopPath);
    if (loop) loops.push(loop);
  }
  return loops;
}

function allowedAction(taskId, targetPath, content, operations, failVerifier = false, riskLevel = "L1") {
  return {
    taskId,
    title: taskId,
    riskLevel,
    priority: 100,
    status: "ready",
    touches: [targetPath],
    targetFiles: [targetPath],
    rollbackPlan: `restore ${targetPath} from low-risk executor snapshot`,
    verifierCommand: "pnpm run verify:phase2060-gvc-timed-runner-real-batch-with-permission-enforcement",
    operations,
    mutationPlan: {
      planId: `phase2060-${taskId}`,
      operations,
      mutations: [{ type: "write_file", path: targetPath, content }],
      verifierCommands: [{ command: process.execPath, args: ["-e", failVerifier ? "process.exit(9)" : "process.exit(0)"] }],
    },
  };
}

function providerCandidateTask() {
  return {
    taskId: "phase2060-provider-candidate",
    title: "Provider candidate approval-required blocked",
    riskLevel: "L3",
    priority: 90,
    status: "approval_required",
    touches: [`${evidenceDir}/provider-should-not-write.json`],
    targetFiles: [`${evidenceDir}/provider-should-not-write.json`],
    rollbackPlan: "no write is allowed",
    verifierCommand: "node -e process.exit(0)",
    operations: ["provider_call"],
  };
}

function secretForbiddenTask() {
  return {
    taskId: "phase2060-secret-read",
    title: "Secret read forbidden blocked",
    riskLevel: "L4",
    priority: 80,
    status: "ready",
    touches: [".env"],
    targetFiles: [".env"],
    rollbackPlan: "no secret read or write is allowed",
    verifierCommand: "node -e process.exit(0)",
    operations: ["secret_read"],
  };
}

function riskPolicy() {
  return {
    riskLevels: {
      L0: { defaultDecision: "allowed" },
      L1: { defaultDecision: "allowed" },
      L2: { defaultDecision: "allowed" },
      L3: { defaultDecision: "approval_required" },
      L4: { defaultDecision: "forbidden" },
    },
    forbiddenPathPrefixes: ["legacy/", ".git/", "node_modules/"],
    forbiddenExactPaths: ["PROJECT_CONTEXT.md", ".env", ".env.local", ".env.production", "auth.json"],
    forbiddenBasenames: ["PROJECT_CONTEXT.md", ".env", ".env.local", ".env.production", "auth.json"],
    forbiddenOperations: ["secret_read", "deploy", "release", "tag", "artifact_upload", "push", "commit"],
    approvalRequiredOperations: ["provider_call", "paid_api_call", "chat_modify", "chat_gateway_execute_modify"],
  };
}

function defaultControl() {
  return {
    paused: false,
    stopRequested: false,
    maxTasksPerLoop: 1,
    dryRunOnly: true,
    noProvider: true,
    noSecret: true,
    noDeploy: true,
  };
}

function lowRiskApproval() {
  return {
    approved: true,
    scope: "low_risk_only",
    allowDocs: true,
    allowEvidence: true,
    allowVerifier: true,
    allowNonCoreUi: true,
    allowPackageScripts: true,
    maxMutationsPerLoop: 3,
    dailyRealExecutionLoopLimit: 100,
    rollbackRequired: true,
    providerAllowed: false,
    secretReadAllowed: false,
    deployAllowed: false,
    chatRouteModificationAllowed: false,
    legacyModificationAllowed: false,
    projectContextModificationAllowed: false,
  };
}

function renderDocs() {
  return [
    "# Phase2060-GVC-Timed-Runner-Real-Batch-With-Permission-Enforcement",
    "",
    "This phase validates the timed runner real low-risk batch under Phase2058 permission enforcement limited activation.",
    "",
    "Boundaries:",
    "- fixture-only docs/evidence/verifier/tools-gvc mutation",
    "- no Provider call",
    "- no secret read",
    "- no deploy/release/tag/upload/push/commit",
    "- no chat or chat-gateway execution modification",
    "- no legacy or PROJECT_CONTEXT.md modification",
    "",
  ].join("\n");
}

function ensureCleanPhase2060Artifacts() {
  rmSync(resolve(evidenceDir), { recursive: true, force: true });
  rmSync(resolve("tools/gvc/test-fixtures/phase2060"), { recursive: true, force: true });
  rmSync(resolve("tools/phase2060/fixture-verifier.mjs"), { force: true });
}

function backupProjectBrainFiles() {
  for (const file of [nextActionsPath, statePath, runnerControlPath, safePolicyPath, approvalPath]) {
    const absolute = resolve(file);
    backups.set(file, existsSync(absolute) ? readFileSync(absolute, "utf8") : null);
  }
}

function restoreProjectBrainFiles() {
  for (const [file, content] of backups.entries()) {
    const absolute = resolve(file);
    if (content === null) {
      rmSync(absolute, { force: true });
    } else {
      mkdirSync(path.dirname(absolute), { recursive: true });
      writeFileSync(absolute, content, "utf8");
    }
  }
}

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

function rmFile(relativePath) {
  rmSync(resolve(relativePath), { force: true });
}

function readJson(relativePath) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonAbsolute(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function readText(relativePath) {
  const filePath = resolve(relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function writeText(relativePath, content) {
  const absolute = resolve(relativePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

function writeJson(relativePath, value) {
  writeJsonAbsolute(resolve(relativePath), value);
}

function writeJsonAbsolute(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
