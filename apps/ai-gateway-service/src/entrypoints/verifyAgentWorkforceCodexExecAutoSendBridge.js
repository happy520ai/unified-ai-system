import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { homedir } from "node:os";
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

const execFileAsync = promisify(execFile);
const phase = "phase-234a-codex-exec-auto-send-bridge";
const scriptPath = "tools/agent-workforce/send-handoff-to-codex-exec.ps1";
const dryRunSummaryPath = ".codex-handoff/runs/send-to-codex-dry-run-summary.json";
const promptPath = ".codex-handoff/outbox/latest-codex-handoff.md";

function parseJsonOutput(text) {
  const trimmed = String(text || "").trim();
  for (let start = 0; start < trimmed.length; start += 1) {
    if (trimmed[start] !== "{") continue;
    try {
      return JSON.parse(trimmed.slice(start).trim());
    } catch {
      // PowerShell may print non-JSON status text before the final JSON object.
    }
  }
  return {};
}

async function ensurePrompt() {
  const resolvedPrompt = resolve(repoRoot, promptPath);
  if (existsSync(resolvedPrompt)) return;
  await mkdir(resolve(repoRoot, ".codex-handoff/outbox"), { recursive: true });
  await writeFile(resolvedPrompt, `# Codex Desktop Handoff Pack

## Task Goal
Verify Phase 234A dry-run behavior.

## Forbidden Actions
- Do not modify legacy/
- Do not create PROJECT_CONTEXT.md
- Do not call oh-my-codex / OMX
- Do not create worktree
- Do not connect workflow run
- Do not modify default NVIDIA /chat lane
- Do not commit or push

## Verification Commands
- cmd /c pnpm run verify:phase234a-codex-exec-auto-send-bridge

## Response Format
A. Summary
B. Changed Files
C. Boundary Check
`, "utf8");
}

async function runDryRun() {
  await ensurePrompt();
  const output = await execFileAsync(
    "powershell",
    ["-ExecutionPolicy", "Bypass", "-File", resolve(repoRoot, scriptPath)],
    { cwd: repoRoot, timeout: 120_000, maxBuffer: 1024 * 1024 * 10 },
  );
  return parseJsonOutput(output.stdout);
}

try {
  const texts = await readWorkspaceTexts();
  const [scriptText, desktopText, dryRun] = await Promise.all([
    readRequired(scriptPath),
    existsSync(resolve(homedir(), "Desktop", "unified-ai-system-\u5168\u81ea\u52a8\u95ed\u73af.bat"))
      ? readFile(resolve(homedir(), "Desktop", "unified-ai-system-\u5168\u81ea\u52a8\u95ed\u73af.bat"), "utf8")
      : Promise.resolve(""),
    runDryRun(),
  ]);
  const dryRunSummary = existsSync(resolve(repoRoot, dryRunSummaryPath))
    ? JSON.parse(await readFile(resolve(repoRoot, dryRunSummaryPath), "utf8"))
    : null;
  const scannedText = [
    scriptText,
    desktopText,
    texts.rootPackageText,
    texts.servicePackageText,
  ].join("\n");
  const secretFindingCount = countSecretFindings(scannedText, phase);
  const desktopCliSendMenuPresent =
    desktopText.includes("11. Auto-send handoff to Codex once") &&
    desktopText.includes("codex:send:once");
  const desktopGuiSendMenuPresent =
    desktopText.includes("11. Auto-send handoff to Codex Desktop GUI once") &&
    desktopText.includes("codex:desktop:send:once");
  const checks = {
    scriptPresent: existsSync(resolve(repoRoot, scriptPath)),
    rootDryRunScriptPresent:
      texts.rootPackage.scripts?.["codex:send:dry-run"] ===
      "powershell -ExecutionPolicy Bypass -File tools/agent-workforce/send-handoff-to-codex-exec.ps1",
    rootOnceScriptPresent:
      texts.rootPackage.scripts?.["codex:send:once"] ===
      "powershell -ExecutionPolicy Bypass -File tools/agent-workforce/send-handoff-to-codex-exec.ps1 -EnableCodexExec true -DryRun false -IExplicitlyApproveCodexExec true",
    rootVerifyScriptPresent:
      texts.rootPackage.scripts?.["verify:phase234a-codex-exec-auto-send-bridge"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase234a-codex-exec-auto-send-bridge",
    serviceVerifyScriptPresent:
      texts.servicePackage.scripts?.["verify:phase234a-codex-exec-auto-send-bridge"] ===
      "node ./src/entrypoints/verifyAgentWorkforceCodexExecAutoSendBridge.js",
    explicitApprovalGatePresent:
      scriptText.includes("$explicitlyEnabled = ($EnableCodexExec -and -not $DryRun -and $IExplicitlyApproveCodexExec)"),
    dryRunDoesNotInvokeCodex:
      scriptText.includes("Dry-run only. Codex CLI was not invoked.") &&
      dryRun?.codexExecInvoked === false,
    realPathChecksCodexCommand: scriptText.includes("codex command was not found"),
    cleanGitGatePresent: scriptText.includes("git workspace is not clean"),
    noCommitNoPushGatePresent: scriptText.includes("NoCommit and NoPush must remain true"),
    writesStdoutStderr:
      scriptText.includes("codex-stdout.txt") &&
      scriptText.includes("codex-stderr.txt"),
    writesInboxResult: scriptText.includes("latest-codex-result.md"),
    importsResult: scriptText.includes("cmd /c pnpm run codex:result:import"),
    dryRunSummaryWritten:
      dryRun?.status === "dry-run-complete" &&
      existsSync(resolve(repoRoot, dryRunSummaryPath)) &&
      dryRunSummary?.safety?.codexExecInvoked === false,
    desktopMenuItem11Present: desktopCliSendMenuPresent || desktopGuiSendMenuPresent,
    desktopRequiresYes:
      (desktopText.includes(":send_handoff_once") ||
        desktopText.includes(":send_handoff_desktop_gui_once")) &&
      desktopText.includes("Type YES to continue"),
    noProjectContext: noProjectContext(),
    noOhMyCodexDependency: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
    noPlainSecrets: secretFindingCount === 0,
  };
  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    conclusion: passed ? "codex-exec-auto-send-bridge-ready" : "codex-exec-auto-send-bridge-incomplete",
    disabledState: createDisabledState(),
    safety: {
      ...createSafety(),
      codexCliInvoked: false,
      codexExecInvoked: false,
      autoCommit: false,
      autoPush: false,
      autoApply: false,
      infiniteLoop: false,
    },
    secretFindingCount,
    checks,
    dryRun,
    evidenceFiles: [
      dryRunSummaryPath,
    ],
    notes: [
      "Verification exercised dry-run only.",
      "Real codex exec remains gated by EnableCodexExec=true, DryRun=false, and IExplicitlyApproveCodexExec=true.",
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
    conclusion: "codex-exec-auto-send-bridge-error",
    error: error instanceof Error ? error.message : String(error),
    disabledState: createDisabledState(),
    safety: {
      ...createSafety(),
      codexCliInvoked: false,
      codexExecInvoked: false,
      autoCommit: false,
      autoPush: false,
      autoApply: false,
      infiniteLoop: false,
    },
    checks: {},
    notes: [],
  };
  await writeEvidence(phase, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}
