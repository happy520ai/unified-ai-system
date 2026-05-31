import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const paths = {
  runner: "tools/gvc/run-timed-local-runner.mjs",
  executor: "tools/gvc/low-risk-autonomous-executor.mjs",
  approval: "docs/approvals/gvc-low-risk-autonomous-mutation-approval.json",
  docs: "docs/phase2033-gvc-timed-runner-autonomous-mutation-integration.md",
  evidenceJson: "apps/ai-gateway-service/evidence/phase2033-gvc-timed-runner-autonomous-mutation-integration/timed-runner-autonomous-mutation-result.json",
  evidenceMd: "apps/ai-gateway-service/evidence/phase2033-gvc-timed-runner-autonomous-mutation-integration/timed-runner-autonomous-mutation-result.md",
};

const checks = [];

function check(id, condition, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const packageJson = readJson("package.json") ?? {};
const approval = readJson(paths.approval);
const docs = readText(paths.docs);

check("runner_exists", existsSync(resolve(paths.runner)), paths.runner);
check("executor_exists", existsSync(resolve(paths.executor)), paths.executor);
check("approval_exists", existsSync(resolve(paths.approval)), paths.approval);
check("approval_approved", approval?.approved === true);
check("approval_scope", approval?.scope === "low_risk_only");
check("approval_daily_real_limit", approval?.dailyRealExecutionLoopLimit === 100);
check("approval_provider_blocked", approval?.providerAllowed === false);
check("approval_secret_blocked", approval?.secretReadAllowed === false);
check("approval_deploy_blocked", approval?.deployAllowed === false);
check("approval_chat_blocked", approval?.chatRouteModificationAllowed === false);

let runnerModule = null;
try {
  runnerModule = await import(`file:///${resolve(paths.runner).replaceAll("\\", "/")}?v=${Date.now()}`);
  check("runner_imports", true);
  check("runner_exports_run", typeof runnerModule.runTimedLocalRunner === "function");
} catch (error) {
  check("runner_imports", false, error.message);
}

let normalRun = null;
let pausedRun = null;
let stopRun = null;
let forbiddenRun = null;
let rollbackRun = null;

if (runnerModule?.runTimedLocalRunner) {
  normalRun = await runFixtureScenario("normal", {
    runnerModule,
    control: defaultControl(),
    actions: [
      allowedAction("phase2033-doc-1", "docs/phase2033-fixture-one.md", "one\n"),
      allowedAction("phase2033-doc-2", "apps/ai-gateway-service/evidence/phase2033-fixture/two.json", "{\n  \"two\": true\n}\n"),
      allowedAction("phase2033-doc-3", "tools/gvc/phase2033-fixture-verifier.mjs", "console.log('three');\n"),
      l3ProviderAction(),
    ],
    dailyLoopLimit: 3,
  });

  pausedRun = await runFixtureScenario("paused", {
    runnerModule,
    control: { ...defaultControl(), paused: true },
    actions: [allowedAction("phase2033-paused-doc", "docs/phase2033-paused.md", "paused\n")],
    dailyLoopLimit: 3,
  });

  stopRun = await runFixtureScenario("stop", {
    runnerModule,
    control: { ...defaultControl(), stopRequested: true },
    actions: [allowedAction("phase2033-stop-doc", "docs/phase2033-stop.md", "stop\n")],
    dailyLoopLimit: 3,
  });

  forbiddenRun = await runFixtureScenario("forbidden", {
    runnerModule,
    control: defaultControl(),
    actions: [
      {
        taskId: "phase2033-forbidden-legacy",
        title: "Forbidden legacy mutation",
        riskLevel: "L1",
        priority: 99,
        status: "ready",
        touches: ["legacy/blocked.txt"],
        operations: ["docs_update"],
        mutationPlan: {
          mutations: [{ type: "write_file", path: "legacy/blocked.txt", content: "after\n" }],
          verifierCommands: [{ command: process.execPath, args: ["-e", "process.exit(0)"] }],
        },
      },
    ],
    dailyLoopLimit: 3,
    seedFiles: {
      "legacy/blocked.txt": "before\n",
    },
  });

  rollbackRun = await runFixtureScenario("rollback", {
    runnerModule,
    control: defaultControl(),
    actions: [
      {
        taskId: "phase2033-rollback-doc",
        title: "Rollback mutation",
        riskLevel: "L1",
        priority: 99,
        status: "ready",
        touches: ["docs/phase2033-rollback.md"],
        operations: ["docs_update"],
        mutationPlan: {
          mutations: [{ type: "write_file", path: "docs/phase2033-rollback.md", content: "broken\n" }],
          verifierCommands: [{ command: process.execPath, args: ["-e", "process.exit(9)"] }],
        },
      },
    ],
    dailyLoopLimit: 3,
    seedFiles: {
      "docs/phase2033-rollback.md": "before\n",
    },
  });

  check("normal_run_completed_three_loops", normalRun?.state?.loopsCompletedToday === 3);
  check("normal_real_mutation_count", normalRun?.realMutationCount >= 1, String(normalRun?.realMutationCount));
  check("normal_max_one_task_per_loop", normalRun?.loops?.every((loop) => loop.executedTaskCount <= 1));
  check("normal_plan_evidence_generated", normalRun?.loops?.some((loop) => Boolean(loop.mutationResult?.planEvidencePath)));
  check("normal_mutation_evidence_generated", normalRun?.loops?.some((loop) => Boolean(loop.mutationResult?.mutationEvidencePath)));
  check("normal_l3_skipped", normalRun?.loops?.some((loop) => loop.skippedApprovalRequiredTasks?.includes("phase2033-provider-l3")));
  check("normal_provider_blocked", normalRun?.loops?.every((loop) => loop.providerCallsMade === false));
  check("normal_secret_blocked", normalRun?.loops?.every((loop) => loop.secretRead === false));
  check("normal_deploy_blocked", normalRun?.loops?.every((loop) => loop.deployExecuted === false));
  check("normal_chat_blocked", normalRun?.loops?.every((loop) => loop.chatGatewayExecuteModified === false));

  check("paused_does_not_mutate", pausedRun?.realMutationCount === 0);
  check("paused_status_idle", pausedRun?.state?.status === "idle");
  check("paused_blocker", pausedRun?.state?.currentBlocker === "paused_by_owner_control");

  check("stop_graceful_shutdown", stopRun?.state?.gracefulShutdown === true);
  check("stop_does_not_mutate", stopRun?.realMutationCount === 0);

  check("forbidden_path_blocked", forbiddenRun?.loops?.[0]?.status === "blocked");
  check("forbidden_path_not_modified", readFixtureFile(forbiddenRun?.fixtureRoot, "legacy/blocked.txt") === "before\n");

  check("rollback_status_rolled_back", rollbackRun?.loops?.[0]?.mutationResult?.status === "rolled_back");
  check("rollback_file_restored", readFixtureFile(rollbackRun?.fixtureRoot, "docs/phase2033-rollback.md") === "before\n");
}

check("docs_exists", existsSync(resolve(paths.docs)), paths.docs);
check("docs_title", docs.includes("Phase2033-GVC-Timed-Runner-Autonomous-Mutation-Integration"));
check("docs_mentions_approval", docs.includes("gvc-low-risk-autonomous-mutation-approval.json"));
check("docs_mentions_paused_stop", docs.includes("paused") && docs.includes("stopRequested"));
check("docs_mentions_rollback", docs.includes("rollback"));
check("docs_mentions_provider_blocked", docs.includes("Provider") && docs.includes("blocked"));

check(
  "root_verify_script",
  packageJson.scripts?.["verify:phase2033-gvc-timed-runner-autonomous-mutation-integration"] ===
    "node tools/gvc/verify-phase2033-timed-runner-autonomous-mutation-integration.mjs",
);

const failedChecks = checks.filter((entry) => !entry.pass);
const result = {
  phaseId: "Phase2033-GVC-Timed-Runner-Autonomous-Mutation-Integration",
  status: failedChecks.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  timedRunnerIntegratedWithExecutor: failedChecks.length === 0,
  autonomousRealMutationTriggeredByRunner: (normalRun?.realMutationCount || 0) > 0,
  testModeRealMutationCount: normalRun?.realMutationCount || 0,
  rollbackPassed: rollbackRun?.loops?.[0]?.mutationResult?.status === "rolled_back",
  pausedEffective: pausedRun?.realMutationCount === 0 && pausedRun?.state?.currentBlocker === "paused_by_owner_control",
  stopEffective: stopRun?.state?.gracefulShutdown === true && stopRun?.realMutationCount === 0,
  forbiddenPathBlocked: forbiddenRun?.loops?.[0]?.status === "blocked",
  providerSecretDeployChatRouteBlocked: normalRun?.loops?.every((loop) =>
    loop.providerCallsMade === false &&
    loop.secretRead === false &&
    loop.deployExecuted === false &&
    loop.chatGatewayExecuteModified === false
  ) === true,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  commitCreated: false,
  pushExecuted: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  recommendedSealed: failedChecks.length === 0,
  blocker: failedChecks.length === 0 ? "none" : failedChecks.map((entry) => entry.id).join(", "),
  evidenceRefs: paths,
  checks,
};

mkdirSync(path.dirname(resolve(paths.evidenceJson)), { recursive: true });
writeFileSync(resolve(paths.evidenceJson), `${JSON.stringify(result, null, 2)}\n`, "utf8");
writeFileSync(resolve(paths.evidenceMd), renderMarkdown(result), "utf8");

for (const scenario of [normalRun, pausedRun, stopRun, forbiddenRun, rollbackRun]) {
  if (scenario?.fixtureRoot) rmSync(scenario.fixtureRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  timedRunnerIntegratedWithExecutor: result.timedRunnerIntegratedWithExecutor,
  autonomousRealMutationTriggeredByRunner: result.autonomousRealMutationTriggeredByRunner,
  testModeRealMutationCount: result.testModeRealMutationCount,
  rollbackPassed: result.rollbackPassed,
}, null, 2));

if (failedChecks.length > 0) process.exit(1);

async function runFixtureScenario(name, options) {
  const fixtureRoot = path.join(repoRoot, ".codex-temp", `phase2033-${name}`);
  rmSync(fixtureRoot, { recursive: true, force: true });
  seedFixture(fixtureRoot, options);
  const state = await options.runnerModule.runTimedLocalRunner({
    repoRoot: fixtureRoot,
    intervalMs: 1,
    dailyLoopLimit: options.dailyLoopLimit,
    maxTasksPerLoop: 1,
    dryRunOnly: false,
    autonomousMutationEnabled: true,
    verificationCommands: [[process.execPath, ["-e", "process.exit(0)"]]],
    testMode: true,
  });
  const date = state.date;
  const loops = [];
  const evidenceDir = path.join(fixtureRoot, "apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner");
  for (let index = 1; index <= state.loopsCompletedToday; index += 1) {
    const evidencePath = path.join(evidenceDir, `loop-${date}-${index}.json`);
    if (existsSync(evidencePath)) loops.push(readJsonAbsolute(evidencePath));
  }
  return {
    fixtureRoot,
    state,
    loops,
    realMutationCount: loops.filter((loop) => loop.realExecutionPerformed === true).length,
  };
}

function seedFixture(fixtureRoot, options) {
  const control = options.control || defaultControl();
  mkdirSync(path.join(fixtureRoot, "docs/project-brain"), { recursive: true });
  mkdirSync(path.join(fixtureRoot, "docs/approvals"), { recursive: true });
  mkdirSync(path.join(fixtureRoot, "apps/ai-gateway-service/evidence"), { recursive: true });
  writeFileSync(path.join(fixtureRoot, "docs/project-brain/runner-control.json"), `${JSON.stringify(control, null, 2)}\n`, "utf8");
  writeFileSync(path.join(fixtureRoot, "docs/approvals/gvc-low-risk-autonomous-mutation-approval.json"), readFileSync(resolve(paths.approval), "utf8"), "utf8");
  writeFileSync(path.join(fixtureRoot, "docs/project-brain/current-state.json"), "{}\n", "utf8");
  writeFileSync(path.join(fixtureRoot, "docs/project-brain/goals.json"), "{}\n", "utf8");
  writeFileSync(path.join(fixtureRoot, "docs/project-brain/completion-definition.json"), "{}\n", "utf8");
  writeFileSync(path.join(fixtureRoot, "docs/project-brain/risk-policy.json"), riskPolicyJson(), "utf8");
  writeFileSync(path.join(fixtureRoot, "docs/project-brain/next-actions.json"), nextActionsJson(options.actions), "utf8");
  writeFileSync(path.join(fixtureRoot, "package.json"), JSON.stringify({ scripts: {} }, null, 2), "utf8");
  for (const [relativePath, content] of Object.entries(options.seedFiles || {})) {
    const absolutePath = path.join(fixtureRoot, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, "utf8");
  }
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

function allowedAction(taskId, mutationPath, content) {
  return {
    taskId,
    title: taskId,
    riskLevel: "L1",
    priority: 100,
    status: "ready",
    touches: [mutationPath],
    operations: ["docs_update"],
    mutationPlan: {
      mutations: [{ type: "write_file", path: mutationPath, content }],
      verifierCommands: [{ command: process.execPath, args: ["-e", "process.exit(0)"] }],
    },
  };
}

function l3ProviderAction() {
  return {
    taskId: "phase2033-provider-l3",
    title: "Provider L3 skipped task",
    riskLevel: "L3",
    priority: 90,
    status: "approval_required",
    touches: ["tools/provider/runtime-adapter.mjs"],
    operations: ["provider_call"],
  };
}

function nextActionsJson(actions) {
  return `${JSON.stringify({
    phaseId: "Phase2033-Fixture-Next-Actions",
    actions,
  }, null, 2)}\n`;
}

function riskPolicyJson() {
  return `${JSON.stringify({
    riskLevels: {
      L0: { defaultDecision: "allowed" },
      L1: { defaultDecision: "allowed" },
      L2: { defaultDecision: "allowed" },
      L3: { defaultDecision: "approval_required" },
      L4: { defaultDecision: "forbidden" },
    },
    forbiddenExactPaths: ["PROJECT_CONTEXT.md"],
    forbiddenPathPrefixes: ["legacy/"],
    forbiddenBasenames: [".env", "auth.json"],
    forbiddenOperations: ["secret_read", "deploy", "release", "push", "commit"],
    approvalRequiredOperations: ["provider_call", "chat_modify", "chat_gateway_execute_modify"],
    providerApprovalRequiredFields: ["provider", "model", "credentialRef"],
    providerDefaultLimits: {
      maxRequests: 1,
      maxCostUsd: 0.02,
      timeoutMs: 30000,
      retryPolicy: "no_retry",
    },
  }, null, 2)}\n`;
}

function readFixtureFile(fixtureRoot, relativePath) {
  if (!fixtureRoot) return "";
  const absolutePath = path.join(fixtureRoot, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readJson(relativePath) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function readJsonAbsolute(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function readText(relativePath) {
  const filePath = resolve(relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function renderMarkdown(data) {
  return [
    "# Phase2033 GVC Timed Runner Autonomous Mutation Integration",
    "",
    `- status: ${data.status}`,
    `- blocker: ${data.blocker}`,
    `- timedRunnerIntegratedWithExecutor: ${data.timedRunnerIntegratedWithExecutor}`,
    `- autonomousRealMutationTriggeredByRunner: ${data.autonomousRealMutationTriggeredByRunner}`,
    `- testModeRealMutationCount: ${data.testModeRealMutationCount}`,
    `- rollbackPassed: ${data.rollbackPassed}`,
    `- pausedEffective: ${data.pausedEffective}`,
    `- stopEffective: ${data.stopEffective}`,
    `- forbiddenPathBlocked: ${data.forbiddenPathBlocked}`,
    `- providerSecretDeployChatRouteBlocked: ${data.providerSecretDeployChatRouteBlocked}`,
    `- recommendedSealed: ${data.recommendedSealed}`,
    "",
  ].join("\n");
}
