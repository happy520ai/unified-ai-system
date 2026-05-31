import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import {
  countSecretFindings,
  createDisabledState,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readRequired,
  readWorkspaceTexts,
  repoRoot,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const execFileAsync = promisify(execFile);
const phase = "phase-236a-continuous-controlled-loop-supervisor";
const loopScriptPath = "tools/agent-workforce/run-continuous-controlled-loop.ps1";
const stopScriptPath = "tools/agent-workforce/stop-continuous-loop.ps1";
const summaryPath = ".codex-handoff/runs/latest-continuous-controlled-loop-summary.json";

function parseJsonOutput(text) {
  const trimmed = String(text || "").trim();
  for (let start = 0; start < trimmed.length; start += 1) {
    if (trimmed[start] !== "{") continue;
    try {
      return JSON.parse(trimmed.slice(start).trim());
    } catch {
      // PowerShell may print status text before final JSON.
    }
  }
  return {};
}

async function createTestServer() {
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider",
    WORKFORCE_PLAN_STORE_PATH: resolve(repoRoot, ".codex-handoff/runs/phase-236a-workforce-plans.json"),
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

async function runContinuousTrial() {
  const server = await createTestServer();
  try {
    const output = await execFileAsync(
      "powershell",
      [
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        resolve(repoRoot, loopScriptPath),
        "-BaseUrl",
        server.serviceUrl,
        "-Goal",
        "Phase 236A verify controlled continuous Agent Workforce loop.",
        "-MaxRounds",
        "2",
        "-TimeoutSeconds",
        "10",
        "-PollSeconds",
        "1",
        "-SleepSecondsBetweenRounds",
        "0",
        "-UseSampleResult",
        "1",
        "-CopyFeedbackToClipboard",
        "0",
      ],
      { cwd: repoRoot, timeout: 180_000, maxBuffer: 1024 * 1024 * 20 },
    );
    return parseJsonOutput(output.stdout);
  } finally {
    await server.close();
  }
}

try {
  const texts = await readWorkspaceTexts();
  const [loopScript, stopScript, desktopText, trial] = await Promise.all([
    readRequired(loopScriptPath),
    readRequired(stopScriptPath),
    readFile(resolve(process.env.USERPROFILE || "", "Desktop", "unified-ai-system-\u5168\u81ea\u52a8\u95ed\u73af.bat"), "utf8").catch(() => ""),
    runContinuousTrial(),
  ]);
  const summary = existsSync(resolve(repoRoot, summaryPath))
    ? JSON.parse(await readFile(resolve(repoRoot, summaryPath), "utf8"))
    : null;
  const scannedText = [
    loopScript,
    stopScript,
    desktopText,
    texts.rootPackageText,
    texts.servicePackageText,
  ].join("\n");
  const secretFindingCount = countSecretFindings(scannedText, phase);
  const checks = {
    loopScriptPresent: existsSync(resolve(repoRoot, loopScriptPath)),
    stopScriptPresent: existsSync(resolve(repoRoot, stopScriptPath)),
    rootContinuousCommandPresent:
      texts.rootPackage.scripts?.["agent:auto:continuous"] ===
      "powershell -ExecutionPolicy Bypass -File tools/agent-workforce/run-continuous-controlled-loop.ps1",
    rootContinuousTestCommandPresent:
      texts.rootPackage.scripts?.["agent:auto:continuous:test"]?.includes("run-continuous-controlled-loop.ps1") &&
      texts.rootPackage.scripts?.["agent:auto:continuous:test"]?.includes("-UseSampleResult 1"),
    rootStopCommandPresent:
      texts.rootPackage.scripts?.["agent:auto:continuous:stop"] ===
      "powershell -ExecutionPolicy Bypass -File tools/agent-workforce/stop-continuous-loop.ps1",
    rootVerifyCommandPresent:
      texts.rootPackage.scripts?.["verify:phase236a-continuous-controlled-loop-supervisor"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase236a-continuous-controlled-loop-supervisor",
    serviceVerifyCommandPresent:
      texts.servicePackage.scripts?.["verify:phase236a-continuous-controlled-loop-supervisor"] ===
      "node ./src/entrypoints/verifyAgentWorkforceContinuousControlledLoopSupervisor.js",
    stopFileSupported:
      loopScript.includes("STOP") &&
      loopScript.includes("stopped-by-stop-file") &&
      stopScript.includes("stop-requested"),
    continuousUntilStoppedSupported:
      loopScript.includes("Use 0 to run until STOP is requested") &&
      loopScript.includes("$MaxRounds -eq 0"),
    realGuiSendCapped:
      loopScript.includes("Real Codex Desktop GUI send is capped at 3 rounds") &&
      loopScript.includes("$realGuiApproved"),
    sampleModeClearlyMarked:
      loopScript.includes("Sample/manual bridge result") &&
      summary?.sampleResultMode === true,
    trialCompletedTwoRounds:
      trial?.status === "max-rounds-complete" &&
      trial?.roundsCompleted === 2 &&
      summary?.roundsCompleted === 2,
    handoffGenerated: existsSync(resolve(repoRoot, ".codex-handoff/outbox/latest-codex-handoff.md")),
    resultImported: existsSync(resolve(repoRoot, ".codex-handoff/review/latest-system-review.md")),
    feedbackGenerated: existsSync(resolve(repoRoot, ".codex-handoff/review/latest-feedback-to-codex.md")),
    noCodexExecInTrial:
      trial?.codexExecInvoked === false &&
      summary?.safety?.codexExecInvoked === false,
    noAutoCommitPush:
      !loopScript.includes("git commit") &&
      !loopScript.includes("git push") &&
      summary?.safety?.autoCommit === false &&
      summary?.safety?.autoPush === false,
    noWorktreeWorkflow:
      !loopScript.includes("git worktree add") &&
      summary?.safety?.worktreeCreated === false &&
      summary?.safety?.workflowRun === false,
    desktopMenuPresent:
      desktopText.includes("Continuous controlled loop until stopped") &&
      desktopText.includes("agent:auto:continuous"),
    desktopStopMenuPresent:
      desktopText.includes("Stop continuous loop") &&
      desktopText.includes("agent:auto:continuous:stop"),
    noProjectContext: noProjectContext(),
    noOhMyCodexDependency: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
    noPlainSecrets: secretFindingCount === 0,
  };
  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    conclusion: passed ? "continuous-controlled-loop-supervisor-ready" : "continuous-controlled-loop-supervisor-incomplete",
    disabledState: createDisabledState(),
    safety: {
      ...createSafety(),
      codexCliInvoked: false,
      codexExecInvoked: false,
      guiAutomationInvoked: false,
      autoCommit: false,
      autoPush: false,
      autoApply: false,
      manualStopEnabled: true,
    },
    secretFindingCount,
    checks,
    trial,
    summary,
    notes: [
      "Verification runs a two-round sample/manual bridge trial only.",
      "It does not claim real Codex Desktop GUI sending or real Codex execution.",
      "Continuous mode can run until the STOP file is created, while real GUI send remains capped and explicitly gated.",
    ],
  };
  await writeEvidence(phase, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  const evidence = {
    phase,
    status: "failed",
    generatedAt: new Date().toISOString(),
    conclusion: "continuous-controlled-loop-supervisor-error",
    error: error instanceof Error ? error.message : String(error),
    disabledState: createDisabledState(),
    safety: {
      ...createSafety(),
      codexCliInvoked: false,
      codexExecInvoked: false,
      autoCommit: false,
      autoPush: false,
      autoApply: false,
      manualStopEnabled: true,
    },
    checks: {},
    notes: [],
  };
  await writeEvidence(phase, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}
