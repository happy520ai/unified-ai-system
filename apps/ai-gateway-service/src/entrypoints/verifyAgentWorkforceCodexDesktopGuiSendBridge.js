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
const phase = "phase-235a-codex-desktop-gui-send-bridge";
const scriptPath = "tools/agent-workforce/send-handoff-to-codex-desktop.ps1";
const dryRunSummaryPath = ".codex-handoff/runs/codex-desktop-gui-send-dry-run-summary.json";
const runSummaryPath = ".codex-handoff/runs/codex-desktop-gui-send-run-summary.json";
const promptPath = ".codex-handoff/outbox/latest-codex-handoff.md";

function parseJsonOutput(text) {
  const trimmed = String(text || "").trim();
  for (let start = 0; start < trimmed.length; start += 1) {
    if (trimmed[start] !== "{") continue;
    try {
      return JSON.parse(trimmed.slice(start).trim());
    } catch {
      // PowerShell may write warnings before the final JSON object.
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
Verify Phase 235A dry-run behavior.

## Forbidden Actions
- Do not modify legacy/
- Do not create PROJECT_CONTEXT.md
- Do not call oh-my-codex / OMX
- Do not create worktree
- Do not connect workflow run
- Do not modify default NVIDIA /chat lane
- Do not commit or push

## Verification Commands
- cmd /c pnpm run verify:phase235a-codex-desktop-gui-send-bridge

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
    ["-STA", "-ExecutionPolicy", "Bypass", "-File", resolve(repoRoot, scriptPath)],
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
  const runSummary = existsSync(resolve(repoRoot, runSummaryPath))
    ? JSON.parse(await readFile(resolve(repoRoot, runSummaryPath), "utf8"))
    : null;
  const scannedText = [
    scriptText,
    desktopText,
    texts.rootPackageText,
    texts.servicePackageText,
  ].join("\n");
  const secretFindingCount = countSecretFindings(scannedText, phase);
  const checks = {
    scriptPresent: existsSync(resolve(repoRoot, scriptPath)),
    rootDryRunScriptPresent:
      texts.rootPackage.scripts?.["codex:desktop:send:dry-run"] ===
      "powershell -STA -ExecutionPolicy Bypass -File tools/agent-workforce/send-handoff-to-codex-desktop.ps1",
    rootOnceScriptPresent:
      texts.rootPackage.scripts?.["codex:desktop:send:once"] ===
      "powershell -STA -ExecutionPolicy Bypass -File tools/agent-workforce/send-handoff-to-codex-desktop.ps1 -EnableGuiSend true -DryRun false -IExplicitlyApproveGuiSend true",
    rootVerifyScriptPresent:
      texts.rootPackage.scripts?.["verify:phase235a-codex-desktop-gui-send-bridge"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase235a-codex-desktop-gui-send-bridge",
    serviceVerifyScriptPresent:
      texts.servicePackage.scripts?.["verify:phase235a-codex-desktop-gui-send-bridge"] ===
      "node ./src/entrypoints/verifyAgentWorkforceCodexDesktopGuiSendBridge.js",
    explicitApprovalGatePresent:
      scriptText.includes("$explicitlyEnabled = ($EnableGuiSend -and -not $DryRun -and $IExplicitlyApproveGuiSend)"),
    dryRunDoesNotSendKeys:
      scriptText.includes("gui-send-dry-run-only") &&
      dryRun?.guiAutomationInvoked === false &&
      dryRunSummary?.safety?.guiAutomationInvoked === false,
    realPathUsesDesktopWindow:
      scriptText.includes("Get-CodexDesktopWindow") &&
      scriptText.includes("SetForegroundWindow") &&
      scriptText.includes("[System.Windows.Forms.SendKeys]::SendWait(\"^v\")"),
    realPathRequiresWindow: scriptText.includes("Codex Desktop window was not found."),
    realPathCopiesClipboard: scriptText.includes("Set-ClipboardText -Text $promptText"),
    realPathCanSendOnce:
      scriptText.includes("[System.Windows.Forms.SendKeys]::SendWait(\"{ENTER}\")") &&
      scriptText.includes("maxRounds = 1"),
    noCliInvocation:
      scriptText.includes("codexCliInvoked = $false") &&
      scriptText.includes("codexExecInvoked = $false"),
    noCommitNoPushGatePresent: scriptText.includes("NoCommit and NoPush must remain true"),
    runSummaryShapePresent:
      scriptText.includes("codex-desktop-gui-send-run-summary.json") &&
      (runSummary === null || runSummary.safety?.codexCliInvoked === false),
    desktopMenuItem11GuiPresent:
      desktopText.includes("11. Auto-send handoff to Codex Desktop GUI once") &&
      desktopText.includes("codex:desktop:send:once"),
    desktopRequiresYes:
      desktopText.includes(":send_handoff_desktop_gui_once") &&
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
    conclusion: passed ? "codex-desktop-gui-send-bridge-ready" : "codex-desktop-gui-send-bridge-incomplete",
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
      runSummaryPath,
    ],
    notes: [
      "Verification exercises dry-run only.",
      "Real GUI send requires EnableGuiSend=true, DryRun=false, and IExplicitlyApproveGuiSend=true.",
      "The GUI bridge sends keystrokes to Codex Desktop and does not invoke Codex CLI.",
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
    conclusion: "codex-desktop-gui-send-bridge-error",
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
