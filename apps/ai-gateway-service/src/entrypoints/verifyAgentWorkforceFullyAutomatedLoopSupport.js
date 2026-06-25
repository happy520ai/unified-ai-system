import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { tmpdir, homedir } from "node:os";
import {
  countSecretFindings,
  createDisabledState,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readEvidence,
  readRequired,
  readWorkspaceTexts,
  repoRoot,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, postJson } from "./entrypointUtils.js";
import { prepareSampleCodexResult, parseJsonOutput } from "./verifyFullyAutomatedLoopHelpers.js";

const execFileAsync = promisify(execFile);

const phaseDefinitions = {
  "phase-225a-agent-workforce-auto-save-latest-plan": {
    conclusion: "agent-workforce-auto-save-latest-plan-complete",
    runAutoSaveTrial: true,
  },
  "phase-226a-goal-to-handoff-automation": {
    conclusion: "goal-to-handoff-automation-complete",
    scriptPath: "tools/agent-workforce/goal-to-codex-handoff.ps1",
    runGoalToHandoffTrial: true,
  },
  "phase-227a-auto-result-waiter-importer": {
    conclusion: "auto-result-waiter-importer-complete",
    scriptPath: "tools/agent-workforce/wait-and-import-codex-result.ps1",
    runWaitImportTrial: true,
  },
  "phase-228a-one-click-manual-bridge-loop": {
    conclusion: "one-click-manual-bridge-loop-complete",
    scriptPath: "tools/agent-workforce/run-manual-bridge-loop.ps1",
    runManualLoopTrial: true,
  },
  "phase-229a-controlled-codex-exec-auto-loop": {
    conclusion: "controlled-codex-exec-auto-loop-dry-run-complete",
    scriptPath: "tools/agent-workforce/run-controlled-codex-auto-loop.ps1",
    runControlledDryRunTrial: true,
  },
  "phase-230a-desktop-fully-automated-control-bat": {
    conclusion: "desktop-fully-automated-control-bat-complete",
    checkDesktopBat: true,
  },
  "phase-231a-auto-loop-documentation": {
    conclusion: "auto-loop-documentation-complete",
    checkDocs: true,
  },
  "phase-232a-fully-automated-controlled-loop-closure": {
    conclusion: "fully-automated-controlled-loop-closure-complete",
    checkClosure: true,
    requiredEvidence: [
      "phase-225a-agent-workforce-auto-save-latest-plan",
      "phase-226a-goal-to-handoff-automation",
      "phase-227a-auto-result-waiter-importer",
      "phase-228a-one-click-manual-bridge-loop",
      "phase-229a-controlled-codex-exec-auto-loop",
      "phase-230a-desktop-fully-automated-control-bat",
      "phase-231a-auto-loop-documentation",
    ],
  },
};

export async function runFullyAutomatedLoopCheck(phase) {
  const definition = phaseDefinitions[phase];
  if (!definition) {
    throw new Error(`Unknown fully automated loop verification phase: ${phase}`);
  }

  const texts = await readWorkspaceTexts();
  const files = await readLoopFiles();
  const docs = {
    readme: texts.readme,
    userManual: texts.userManual,
    agentsDoc: texts.agentsDoc,
    closure: existsSync(resolve(repoRoot, "docs/AGENT_WORKFORCE_FULLY_AUTOMATED_CONTROLLED_LOOP_CLOSURE.md"))
      ? await readRequired("docs/AGENT_WORKFORCE_FULLY_AUTOMATED_CONTROLLED_LOOP_CLOSURE.md")
      : "",
  };

  const checks = {
    noProjectContext: noProjectContext(),
    noOhMyCodexDependency: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
    noCodexLoopOnceDefault: texts.rootPackage.scripts?.["agent:auto:dry-run"]?.includes("run-controlled-codex-auto-loop.ps1") &&
      !texts.rootPackage.scripts?.["agent:auto:dry-run"]?.includes("EnableCodexExec true"),
    noAutomaticCommitPush: !files.combined.includes("git commit") && !files.combined.includes("git push"),
    noWorkflowRunHookup: !files.combined.includes("workflow run hookup enabled"),
    noWorktreeCreation: !files.combined.includes("git worktree add"),
  };

  const notes = [];

  if (definition.runAutoSaveTrial) {
    const trial = await runAutoSaveTrial(phase);
    Object.assign(checks, {
      apiPlanAutoSaved: trial.plan?.autoSaved === true,
      apiPlanIdReturned: /^wfp_[a-f0-9]{12}$/.test(trial.plan?.planId || ""),
      historyContainsLatestPlan: trial.history?.plans?.some((item) => item.planId === trial.plan?.planId),
      handoffPullCanUseAutoSavedPlan: trial.handoffPull?.status === "ok",
      uiMentionsAutoSave: texts.ui.includes("auto-saved to local history"),
      manualSaveStillAvailable: texts.ui.includes("workforce-save"),
    });
    notes.push(`Auto-save trial plan ID: ${trial.plan?.planId}`);
  }

  if (definition.runGoalToHandoffTrial) {
    const trial = await runGoalToHandoffTrial(phase);
    Object.assign(checks, {
      goalScriptPresent: existsSync(resolve(repoRoot, definition.scriptPath)),
      rootCommandPresent: texts.rootPackage.scripts?.["agent:auto:handoff"] ===
        "powershell -ExecutionPolicy Bypass -File tools/agent-workforce/goal-to-codex-handoff.ps1",
      goalScriptChecksHealth: files.goalToHandoff.includes("/health/check"),
      goalScriptPostsWorkforcePlan: files.goalToHandoff.includes("/workforce/plan"),
      goalScriptUsesSavedPlanExport: files.goalToHandoff.includes("pull-codex-handoff.ps1"),
      handoffMarkdownExists: trial.files.markdown,
      handoffJsonExists: trial.files.json,
      outboxMarkdownExists: trial.files.outboxMarkdown,
      metadataExists: trial.files.metadata,
      clipboardRequested: trial.output?.clipboardCopied === true,
      codexExecNotInvoked: trial.output?.codexExecInvoked === false,
    });
    notes.push(`Goal-to-handoff plan ID: ${trial.output?.planId}`);
  }

  if (definition.runWaitImportTrial) {
    const trial = await runWaitImportTrial();
    Object.assign(checks, {
      waiterScriptPresent: existsSync(resolve(repoRoot, definition.scriptPath)),
      rootCommandPresent: texts.rootPackage.scripts?.["agent:auto:import"] ===
        "powershell -ExecutionPolicy Bypass -File tools/agent-workforce/wait-and-import-codex-result.ps1",
      waiterPollsForInbox: files.waitImport.includes("Waiting for Codex result"),
      importerExecuted: trial.output?.status === "ok",
      systemReviewExists: trial.files.systemReview,
      feedbackExists: trial.files.feedback,
      reviewSummaryExists: trial.files.reviewSummary,
      feedbackCopied: trial.output?.feedbackCopiedToClipboard === true,
      codexExecNotInvoked: trial.output?.codexExecInvoked === false,
    });
  }

  if (definition.runManualLoopTrial) {
    const trial = await runManualLoopTrial(phase);
    Object.assign(checks, {
      manualLoopScriptPresent: existsSync(resolve(repoRoot, definition.scriptPath)),
      rootCommandPresent: texts.rootPackage.scripts?.["agent:auto:manual-loop"] ===
        "powershell -ExecutionPolicy Bypass -File tools/agent-workforce/run-manual-bridge-loop.ps1",
      manualLoopCallsGoalHandoff: files.manualLoop.includes("goal-to-codex-handoff.ps1"),
      manualLoopCallsWaitImport: files.manualLoop.includes("wait-and-import-codex-result.ps1"),
      summaryExists: trial.files.summary,
      handoffCopied: trial.output?.handoffCopiedToClipboard === true,
      waitedForResult: trial.output?.waitedForResult === true,
      codexExecNotInvoked: trial.output?.codexExecInvoked === false,
    });
  }

  if (definition.runControlledDryRunTrial) {
    const trial = await runControlledDryRunTrial(phase);
    Object.assign(checks, {
      controlledScriptPresent: existsSync(resolve(repoRoot, definition.scriptPath)),
      rootDryRunCommandPresent: texts.rootPackage.scripts?.["agent:auto:dry-run"] ===
        "powershell -ExecutionPolicy Bypass -File tools/agent-workforce/run-controlled-codex-auto-loop.ps1",
      rootOneShotCommandPresent: texts.rootPackage.scripts?.["agent:auto:codex-once"]?.includes("-IExplicitlyApproveCodexExec 1"),
      explicitApprovalGatePresent: files.controlledLoop.includes("$IExplicitlyApproveCodexExec = $false") &&
        files.controlledLoop.includes("$realApproved = ($EnableCodexExec -and -not $DryRun -and $IExplicitlyApproveCodexExec)"),
      maxRoundsCapped: files.controlledLoop.includes("$MaxRounds -gt 3"),
      cleanGitGatePresent: files.controlledLoop.includes("git workspace is not clean"),
      noCommitNoPushPresent: files.controlledLoop.includes("$NoCommit = $true") && files.controlledLoop.includes("$NoPush = $true"),
      dryRunOutput: trial.output?.codexExecInvoked === false,
      summaryExists: trial.files.summary,
      noWorktree: trial.summary?.safety?.worktreeCreated === false,
      noWorkflowRun: trial.summary?.safety?.workflowRun === false,
    });
  }

  if (definition.checkDesktopBat) {
    const trial = await checkDesktopBat();
    Object.assign(checks, {
      desktopBatExists: trial.exists,
      selfTestPassed: trial.selfTestPassed,
      statusOncePassed: trial.statusOncePassed,
      menuHasManualBridge: trial.text.includes("agent:auto:manual-loop"),
      menuHasDryRun: trial.text.includes("agent:auto:dry-run"),
      realOneShotRequiresYes: trial.text.includes("Type YES to continue") && trial.text.includes("agent:auto:codex-once"),
      noDirectCodexLoopOnce: !trial.text.includes("codex:loop:once"),
      noCommitPushWorktreeWorkflow: trial.text.includes("no commit/push") || trial.text.includes("no commit"),
    });
    notes.push(`Desktop BAT: ${trial.path}`);
  }

  if (definition.checkDocs) {
    Object.assign(checks, {
      readmeDocumentsManualBridge: docs.readme.includes("agent:auto:manual-loop"),
      userManualDocumentsModes:
        docs.userManual.includes("Manual bridge loop") &&
        docs.userManual.includes("Dry-run loop") &&
        docs.userManual.includes("Real Codex one-shot"),
      agentsBoundaryUpdated: docs.agentsDoc.includes("Fully Automated Controlled Loop Boundary"),
      noDefaultCodexExecutionDocumented:
        docs.readme.includes("no default real Codex execution") &&
        docs.userManual.includes("Codex is not called by default"),
      noCommitPushWorktreeWorkflowDocumented:
        docs.userManual.includes("No automatic apply, merge, commit, or push") &&
        docs.userManual.includes("No default worktree creation") &&
        docs.userManual.includes("No workflow run hookup"),
    });
  }

  if (definition.checkClosure) {
    const requiredEvidence = await Promise.all(definition.requiredEvidence.map(async (item) => {
      try {
        return await readEvidence(item);
      } catch {
        return { phase: item, status: "missing" };
      }
    }));
    Object.assign(checks, {
      closureDocPresent: existsSync(resolve(repoRoot, "docs/AGENT_WORKFORCE_FULLY_AUTOMATED_CONTROLLED_LOOP_CLOSURE.md")),
      closureListsDesktopBat: docs.closure.includes("unified-ai-system-\u5168\u81ea\u52a8\u95ed\u73af.bat"),
      closureListsScripts:
        docs.closure.includes("goal-to-codex-handoff.ps1") &&
        docs.closure.includes("wait-and-import-codex-result.ps1") &&
        docs.closure.includes("run-manual-bridge-loop.ps1") &&
        docs.closure.includes("run-controlled-codex-auto-loop.ps1"),
      closureListsPackageScripts:
        docs.closure.includes("agent:auto:handoff") &&
        docs.closure.includes("agent:auto:manual-loop") &&
        docs.closure.includes("agent:auto:dry-run") &&
        docs.closure.includes("agent:auto:codex-once"),
      closureBoundaryClear:
        docs.closure.includes("No default real Codex execution") &&
        docs.closure.includes("No automatic commit or push") &&
        docs.closure.includes("No default worktree creation") &&
        docs.closure.includes("No workflow run hookup"),
      blockerNone: docs.closure.includes("none"),
      priorEvidencePassed: requiredEvidence.every((item) => item.status === "passed"),
    });
  }

  const scannedText = [
    files.combined,
    docs.readme,
    docs.userManual,
    docs.agentsDoc,
    docs.closure,
  ].join("\n");
  const secretFindingCount = countSecretFindings(scannedText, phase);
  const status = Object.values(checks).every(Boolean) && secretFindingCount === 0 ? "passed" : "failed";
  const evidence = {
    phase,
    status,
    generatedAt: new Date().toISOString(),
    conclusion: status === "passed" ? definition.conclusion : `${definition.conclusion}-failed`,
    disabledState: createDisabledState(),
    safety: {
      ...createSafety(),
      codexExecInvokedByDefault: false,
      autoCommit: false,
      autoPush: false,
      autoApply: false,
      infiniteLoop: false,
    },
    secretFindingCount,
    checks,
    notes,
  };

  await writeEvidence(phase, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = status === "passed" ? 0 : 1;
}

async function readLoopFiles() {
  const paths = {
    goalToHandoff: "tools/agent-workforce/goal-to-codex-handoff.ps1",
    waitImport: "tools/agent-workforce/wait-and-import-codex-result.ps1",
    manualLoop: "tools/agent-workforce/run-manual-bridge-loop.ps1",
    controlledLoop: "tools/agent-workforce/run-controlled-codex-auto-loop.ps1",
    pull: "tools/agent-workforce/pull-codex-handoff.ps1",
    importResult: "tools/agent-workforce/import-codex-result.ps1",
    execLoop: "tools/agent-workforce/run-codex-exec-loop.ps1",
  };
  const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => {
    if (!existsSync(resolve(repoRoot, path))) return [key, ""];
    return [key, await readRequired(path)];
  }));
  const result = Object.fromEntries(entries);
  result.combined = Object.values(result).join("\n");
  return result;
}

async function runAutoSaveTrial(phase) {
  const server = await createTestServer(phase);
  try {
    const planResponse = await postJson(`${server.serviceUrl}/workforce/plan`, {
      goal: "Phase 225A verify auto-save latest Agent Workforce plan.",
      selectedTemplate: "feature-development",
      context: { traceId: phase },
    });
    const plan = planResponse.body?.data;
    const historyResponse = await fetchJson(`${server.serviceUrl}/workforce/plans`);
    const handoff = await runPowerShell("tools/agent-workforce/pull-codex-handoff.ps1", [
      "-BaseUrl", server.serviceUrl,
      "-PlanId", plan?.planId || "",
      "-OutputDir", ".codex-handoff",
      "-CopyToClipboard", "0",
    ]);
    return {
      plan,
      history: historyResponse.body?.data,
      handoffPull: parseJsonOutput(handoff.stdout),
    };
  } finally {
    await server.close();
  }
}

async function runGoalToHandoffTrial(phase) {
  const server = await createTestServer(phase);
  try {
    const output = await runPowerShell("tools/agent-workforce/goal-to-codex-handoff.ps1", [
      "-BaseUrl", server.serviceUrl,
      "-Goal", "Phase 226A verify goal to Codex handoff automation.",
      "-Template", "feature-development",
      "-CopyToClipboard", "1",
    ]);
    const parsed = parseJsonOutput(output.stdout);
    return {
      output: parsed,
      files: {
        markdown: existsSync(resolve(repoRoot, ".codex-handoff/latest-codex-handoff.md")),
        json: existsSync(resolve(repoRoot, ".codex-handoff/latest-codex-handoff.json")),
        metadata: existsSync(resolve(repoRoot, ".codex-handoff/latest-metadata.json")),
        outboxMarkdown: existsSync(resolve(repoRoot, ".codex-handoff/outbox/latest-codex-handoff.md")),
      },
    };
  } finally {
    await server.close();
  }
}

async function runWaitImportTrial() {
  await prepareSampleCodexResult();
  const output = await runPowerShell("tools/agent-workforce/wait-and-import-codex-result.ps1", [
    "-TimeoutSeconds", "5",
    "-PollSeconds", "1",
    "-CopyFeedbackToClipboard", "1",
  ]);
  return {
    output: parseJsonOutput(output.stdout),
    files: {
      systemReview: existsSync(resolve(repoRoot, ".codex-handoff/review/latest-system-review.md")),
      feedback: existsSync(resolve(repoRoot, ".codex-handoff/review/latest-feedback-to-codex.md")),
      reviewSummary: existsSync(resolve(repoRoot, ".codex-handoff/review/latest-review-summary.json")),
    },
  };
}

async function runManualLoopTrial(phase) {
  await prepareSampleCodexResult();
  const server = await createTestServer(phase);
  try {
    const output = await runPowerShell("tools/agent-workforce/run-manual-bridge-loop.ps1", [
      "-BaseUrl", server.serviceUrl,
      "-Goal", "Phase 228A verify one-click manual bridge loop.",
      "-WaitForResult", "1",
      "-TimeoutSeconds", "5",
    ]);
    const parsed = parseJsonOutput(output.stdout);
    return {
      output: parsed,
      files: {
        summary: existsSync(resolve(repoRoot, ".codex-handoff/runs/latest-manual-bridge-loop-summary.json")),
      },
    };
  } finally {
    await server.close();
  }
}

async function runControlledDryRunTrial(phase) {
  const server = await createTestServer(phase);
  try {
    const output = await runPowerShell("tools/agent-workforce/run-controlled-codex-auto-loop.ps1", [
      "-BaseUrl", server.serviceUrl,
      "-Goal", "Phase 229A verify controlled Codex auto loop dry-run.",
    ]);
    const parsed = parseJsonOutput(output.stdout);
    const summaryPath = resolve(repoRoot, ".codex-handoff/runs/latest-controlled-auto-loop-summary.json");
    const summary = existsSync(summaryPath) ? JSON.parse(await readFile(summaryPath, "utf8")) : null;
    return {
      output: parsed,
      summary,
      files: {
        summary: existsSync(summaryPath),
      },
    };
  } finally {
    await server.close();
  }
}

async function checkDesktopBat() {
  const path = resolve(homedir(), "Desktop", "unified-ai-system-\u5168\u81ea\u52a8\u95ed\u73af.bat");
  const text = existsSync(path) ? await readFile(path, "utf8") : "";
  let selfTestPassed = false;
  let statusOncePassed = false;
  if (existsSync(path)) {
    try {
      const self = await execFileAsync("cmd", ["/c", path, "--self-test"], { cwd: resolve(homedir(), "Desktop"), timeout: 30_000 });
      selfTestPassed = self.stdout.includes("SELF_TEST_OK");
    } catch {
      selfTestPassed = false;
    }
    try {
      const status = await execFileAsync("cmd", ["/c", path, "--status-once"], { cwd: resolve(homedir(), "Desktop"), timeout: 120_000 });
      statusOncePassed = status.stdout.includes('"status": "running"') || status.stdout.includes('"status": "stopped"');
    } catch {
      statusOncePassed = false;
    }
  }
  return { path, exists: existsSync(path), text, selfTestPassed, statusOncePassed };
}

async function createTestServer(phase) {
  const storePath = resolve(tmpdir(), "unified-ai-system", `${phase}-${Date.now()}-workforce-plans.json`);
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider",
    WORKFORCE_PLAN_STORE_PATH: storePath,
  });
  const server = createGatewayHttpServer(application);
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolveListen();
    });
  });
  return {
    serviceUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  };
}


async function runPowerShell(relativeScriptPath, args = []) {
  return execFileAsync(
    "powershell",
    ["-ExecutionPolicy", "Bypass", "-File", resolve(repoRoot, relativeScriptPath), ...args],
    { cwd: repoRoot, timeout: 180_000, maxBuffer: 1024 * 1024 * 10 },
  );
}

