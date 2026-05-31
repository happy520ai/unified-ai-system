import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const taskPath = resolve(repoRoot, ".codex-handoff/outbox/latest-codex-task.md");
const taskJsonPath = resolve(repoRoot, ".codex-handoff/outbox/latest-codex-task.json");
const runsDir = resolve(repoRoot, ".codex-handoff/runs");
const recordJsonPath = resolve(runsDir, "latest-desktop-send-record.json");
const recordMarkdownPath = resolve(runsDir, "latest-desktop-send-record.md");
const defaultWindowTitlePattern = "Codex";

const allowedSendModes = new Set(["manual-handoff-only", "controlled-desktop-send"]);

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const task = await loadTask();
  const preflight = buildPreflight(task);

  if (options.mode === "dry-run") {
    printJson({
      status: "dry-run",
      taskTitle: task.json.title || "(untitled)",
      taskLength: task.markdown.length,
      boundarySummary: preflight.boundarySummary,
      checks: preflight.checks,
      copied: false,
      pasted: false,
      sent: false,
      codexCliInvoked: false,
      codexExecInvoked: false,
    });
    return;
  }

  ensurePreflightPassed(preflight);

  if (options.mode === "copy-only") {
    await copyToClipboard(task.markdown);
    printJson({
      status: "copy-only",
      taskTitle: task.json.title || "(untitled)",
      copied: true,
      copiedToClipboard: true,
      pasted: false,
      pastedToDesktop: false,
      sent: false,
      codexCliInvoked: false,
      codexExecInvoked: false,
    });
    return;
  }

  if (options.mode === "paste-only") {
    await copyToClipboard(task.markdown);
    const pasteResult = await pasteToCodexDesktop({
      sendEnter: false,
      windowTitlePattern: options.windowTitlePattern,
    });
    printJson({
      status: "paste-only",
      taskTitle: task.json.title || "(untitled)",
      copied: true,
      copiedToClipboard: true,
      pasted: pasteResult.pasted,
      pastedToDesktop: pasteResult.pasted,
      sent: false,
      codexWindowFound: pasteResult.windowFound,
      blocker: pasteResult.windowFound ? null : "codex_desktop_window_not_found",
      codexCliInvoked: false,
      codexExecInvoked: false,
    });
    return;
  }

  if (options.mode === "send") {
    if (!options.send || !options.confirmSend) {
      throw new Error("Sending requires both --send and --confirm-send.");
    }

    console.log("This will send the latest outbox task to Codex Desktop UI.");
    await copyToClipboard(task.markdown);
    const pasteResult = await pasteToCodexDesktop({
      sendEnter: true,
      windowTitlePattern: options.windowTitlePattern,
    });
    if (!pasteResult.windowFound) {
      printJson({
        status: "blocked",
        blocker: "codex_desktop_window_not_found",
        copiedToClipboard: true,
        pastedToDesktop: false,
        sent: false,
        codexCliInvoked: false,
        codexExecInvoked: false,
      });
      return;
    }
    const record = await writeSendRecord({ task, pasteResult });
    printJson({
      status: "sent-to-desktop",
      taskTitle: task.json.title || "(untitled)",
      copiedToClipboard: true,
      pastedToDesktop: pasteResult.pasted,
      sent: true,
      codexCliInvoked: false,
      codexExecInvoked: false,
      recordPaths: {
        json: recordJsonPath,
        markdown: recordMarkdownPath,
      },
      record,
    });
  }
}

function parseArgs(args) {
  const options = {
    mode: "dry-run",
    send: false,
    confirmSend: false,
    windowTitlePattern: defaultWindowTitlePattern,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    else if (arg === "--dry-run") options.mode = "dry-run";
    else if (arg === "--copy-only") options.mode = "copy-only";
    else if (arg === "--paste-only") options.mode = "paste-only";
    else if (arg === "--send") {
      options.mode = "send";
      options.send = true;
    } else if (arg === "--confirm-send") {
      options.confirmSend = true;
    } else if (arg === "--window-title-pattern") {
      options.windowTitlePattern = args[index + 1] || defaultWindowTitlePattern;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.confirmSend && !options.send) {
    throw new Error("--confirm-send is only valid with --send.");
  }

  return options;
}

async function loadTask() {
  const markdownStats = await safeStat(taskPath);
  const jsonStats = await safeStat(taskJsonPath);
  if (!markdownStats.exists) throw new Error(`Missing outbox task markdown: ${taskPath}`);
  if (!jsonStats.exists) throw new Error(`Missing outbox task json: ${taskJsonPath}`);

  const markdown = await readFile(taskPath, "utf8");
  const json = JSON.parse(await readFile(taskJsonPath, "utf8"));
  return {
    markdown,
    json,
    markdownStats,
    jsonStats,
  };
}

async function safeStat(pathValue) {
  try {
    const info = await stat(pathValue);
    return {
      exists: info.isFile(),
      sizeBytes: info.size,
      modifiedAt: info.mtime.toISOString(),
    };
  } catch {
    return {
      exists: false,
      sizeBytes: 0,
      modifiedAt: null,
    };
  }
}

function buildPreflight(task) {
  const blockedScope = Array.isArray(task.json.blockedScope) ? task.json.blockedScope : [];
  const blockedText = blockedScope.join("\n").toLowerCase();
  const checks = {
    taskMarkdownExists: task.markdownStats.exists,
    taskJsonExists: task.jsonStats.exists,
    allowedMode: allowedSendModes.has(task.json.mode),
    executionEnabledFalse: task.json.executionEnabled === false,
    codexExecInvokedFalse: task.json.codexExecInvoked === false,
    noAutoCommitPush: blockedText.includes("commit/push") || blockedText.includes("auto commit/push"),
    noWorkflowRunner: blockedText.includes("workflow runner"),
    noWorktreeCreation: blockedText.includes("worktree"),
    codexCliInvokedFalse: task.json.codexCliInvoked !== true,
    noPlaintextSecret: !containsPlaintextSecret(task.markdown) && !containsPlaintextSecret(JSON.stringify(task.json)),
  };
  return {
    checks,
    passed: Object.values(checks).every(Boolean),
    boundarySummary: {
      mode: task.json.mode,
      executionEnabled: task.json.executionEnabled,
      codexExecInvoked: task.json.codexExecInvoked,
      codexCliInvoked: task.json.codexCliInvoked === true ? true : false,
      noAutoCommitPush: checks.noAutoCommitPush,
      noWorkflowRunner: checks.noWorkflowRunner,
      noWorktreeCreation: checks.noWorktreeCreation,
      approvalPreviewIsExecutionPermission: task.json.approvalPreviewIsExecutionPermission === true ? true : false,
    },
  };
}

function ensurePreflightPassed(preflight) {
  if (!preflight.passed) {
    throw new Error(`Desktop send preflight failed: ${JSON.stringify(preflight.checks)}`);
  }
}

function containsPlaintextSecret(value) {
  return /(?:sk-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY)/i.test(String(value || ""));
}

async function copyToClipboard(text) {
  try {
    await runProcess({
      command: "C:\\Windows\\System32\\clip.exe",
      args: [],
      input: text,
    });
    return;
  } catch {
    await runPowerShell({
      script: "[Console]::InputEncoding = [System.Text.UTF8Encoding]::new(); $text = [Console]::In.ReadToEnd(); Set-Clipboard -Value $text",
      input: text,
    });
  }
}

async function pasteToCodexDesktop({ sendEnter, windowTitlePattern }) {
  const encodedPattern = Buffer.from(windowTitlePattern, "utf8").toString("base64");
  const script = `
$pattern = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${encodedPattern}"))
$shell = New-Object -ComObject WScript.Shell
$candidate = Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -match 'Codex' -or $_.MainWindowTitle -match $pattern) } |
  Sort-Object -Property StartTime -Descending |
  Select-Object -First 1
if (-not $candidate) {
  Write-Output (@{ windowFound = $false; pasted = $false; sent = $false } | ConvertTo-Json -Compress)
  exit 0
}
[void]$shell.AppActivate($candidate.Id)
Start-Sleep -Milliseconds 700
$shell.SendKeys('^v')
Start-Sleep -Milliseconds 500
if (${sendEnter ? "$true" : "$false"}) {
  $shell.SendKeys('{ENTER}')
  Start-Sleep -Milliseconds 300
}
Write-Output (@{
  windowFound = $true
  processId = $candidate.Id
  processName = $candidate.ProcessName
  title = $candidate.MainWindowTitle
  pasted = $true
  sent = ${sendEnter ? "$true" : "$false"}
} | ConvertTo-Json -Compress)
`;
  const output = await runPowerShell({ script });
  const trimmed = output.trim();
  if (!trimmed) return { windowFound: false, pasted: false, sent: false };
  return JSON.parse(trimmed);
}

async function writeSendRecord({ task, pasteResult }) {
  const sentAt = new Date().toISOString();
  const record = {
    sentAt,
    taskPath,
    taskJsonPath,
    mode: "controlled-desktop-send",
    dryRun: false,
    copiedToClipboard: true,
    pastedToDesktop: Boolean(pasteResult.pasted),
    sendRequested: true,
    confirmSend: true,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    taskTitle: task.json.title || "",
    taskId: task.json.taskId || "",
    desktopWindow: pasteResult.windowFound ? {
      processId: pasteResult.processId,
      processName: pasteResult.processName,
      title: pasteResult.title,
    } : null,
    note: "Task was sent to Codex Desktop UI by controlled desktop sender; this does not grant auto commit/push permission.",
  };

  await mkdir(runsDir, { recursive: true });
  await writeFile(recordJsonPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await writeFile(recordMarkdownPath, renderRecordMarkdown(record), "utf8");
  return record;
}

function renderRecordMarkdown(record) {
  return [
    "# Controlled Codex Desktop Send Record",
    "",
    `- sentAt: ${record.sentAt}`,
    `- taskPath: ${record.taskPath}`,
    `- taskJsonPath: ${record.taskJsonPath}`,
    `- mode: ${record.mode}`,
    `- dryRun: ${record.dryRun}`,
    `- copiedToClipboard: ${record.copiedToClipboard}`,
    `- pastedToDesktop: ${record.pastedToDesktop}`,
    `- sendRequested: ${record.sendRequested}`,
    `- confirmSend: ${record.confirmSend}`,
    `- codexCliInvoked: ${record.codexCliInvoked}`,
    `- codexExecInvoked: ${record.codexExecInvoked}`,
    `- workflowRunnerEnabled: ${record.workflowRunnerEnabled}`,
    `- worktreeCreated: ${record.worktreeCreated}`,
    `- autoCommit: ${record.autoCommit}`,
    `- autoPush: ${record.autoPush}`,
    "",
    record.note,
  ].join("\n");
}

function runPowerShell({ script, input = "" }) {
  return runProcess({
    command: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    input,
  });
}

function runProcess({ command, args, input = "" }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(stdout);
        return;
      }
      rejectPromise(new Error(stderr || `PowerShell exited with code ${code}`));
    });
    child.stdin.end(input);
  });
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
