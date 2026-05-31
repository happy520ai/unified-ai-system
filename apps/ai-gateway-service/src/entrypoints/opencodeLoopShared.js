import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { containsPlainSecret } from "../security/secretSafety.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "../../../..");

const localAppData = process.env.LOCALAPPDATA || "C:/Users/Administrator/AppData/Local";
const userProfile = process.env.USERPROFILE || "C:/Users/Administrator";

export const openCodeLoopPaths = {
  outboxDir: resolve(repoRoot, ".opencode-handoff/outbox"),
  outboxMarkdownPath: resolve(repoRoot, ".opencode-handoff/outbox/latest-opencode-task.md"),
  outboxJsonPath: resolve(repoRoot, ".opencode-handoff/outbox/latest-opencode-task.json"),
  inboxDir: resolve(repoRoot, ".opencode-handoff/inbox"),
  inboxMarkdownPath: resolve(repoRoot, ".opencode-handoff/inbox/latest-opencode-result.md"),
  inboxJsonPath: resolve(repoRoot, ".opencode-handoff/inbox/latest-opencode-result.json"),
  reviewDir: resolve(repoRoot, ".opencode-handoff/review"),
  reviewJsonPath: resolve(repoRoot, ".opencode-handoff/review/latest-opencode-review.json"),
  reviewMarkdownPath: resolve(repoRoot, ".opencode-handoff/review/latest-opencode-review.md"),
  feedbackMarkdownPath: resolve(repoRoot, ".opencode-handoff/review/latest-feedback-to-opencode.md"),
  runsDir: resolve(repoRoot, ".opencode-handoff/runs"),
  sendRecordJsonPath: resolve(repoRoot, ".opencode-handoff/runs/latest-opencode-send-record.json"),
  sendRecordMarkdownPath: resolve(repoRoot, ".opencode-handoff/runs/latest-opencode-send-record.md"),
  oneShotSealJsonPath: resolve(repoRoot, ".opencode-handoff/runs/opencode-desktop-one-shot-seal.json"),
  oneShotSealMarkdownPath: resolve(repoRoot, ".opencode-handoff/runs/opencode-desktop-one-shot-seal.md"),
  nextRoundTaskJsonPath: resolve(repoRoot, ".opencode-handoff/runs/opencode-desktop-next-round-task.json"),
  nextRoundTaskMarkdownPath: resolve(repoRoot, ".opencode-handoff/runs/opencode-desktop-next-round-task.md"),
  internalRunsDir: resolve(repoRoot, ".opencode-handoff/internal-runs"),
  evidenceDir: resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3990a-opencode-controlled-loop-bridge"),
  phaseDocPath: resolve(repoRoot, "docs/phase3990a-opencode-controlled-loop-bridge.md"),
  phase3991EvidenceDir: resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3991a-opencode-real-one-shot-intake"),
  phase3991EvidenceJsonPath: resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3991a-opencode-real-one-shot-intake/latest-one-shot-seal.json"),
  phase3991EvidenceMarkdownPath: resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3991a-opencode-real-one-shot-intake/latest-one-shot-seal.md"),
  phase3991DocPath: resolve(repoRoot, "docs/phase3991a-opencode-real-one-shot-intake.md"),
  phase3992EvidenceDir: resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3992a-opencode-feedback-driven-next-round"),
  phase3992EvidenceJsonPath: resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3992a-opencode-feedback-driven-next-round/latest-next-round-task.json"),
  phase3992EvidenceMarkdownPath: resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3992a-opencode-feedback-driven-next-round/latest-next-round-task.md"),
  phase3992DocPath: resolve(repoRoot, "docs/phase3992a-opencode-feedback-driven-next-round.md"),
  defaultDbPath: resolve(userProfile, ".local/share/opencode/opencode.db"),
  defaultDesktopExePath: resolve(localAppData, "Programs/OpenCode/OpenCode.exe"),
};

export function resolveRepoPath(...segments) {
  return resolve(repoRoot, ...segments);
}

export function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

export async function safeStat(pathValue) {
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

export async function readJsonIfPresent(pathValue) {
  try {
    return JSON.parse(await readFile(pathValue, "utf8"));
  } catch {
    return null;
  }
}

export async function writeJson(pathValue, value) {
  await mkdir(dirname(pathValue), { recursive: true });
  await writeFile(pathValue, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(pathValue, value) {
  await mkdir(dirname(pathValue), { recursive: true });
  await writeFile(pathValue, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

export function relativeFromRoot(pathValue) {
  return resolve(pathValue).replace(`${repoRoot}\\`, "").replaceAll("\\", "/");
}

export function containsPlaintextSecretText(value) {
  return containsPlainSecret(String(value || ""));
}

export async function copyToClipboard(text) {
  const safeText = String(text || "");
  if (containsPlaintextSecretText(safeText)) {
    throw new Error("Refusing to copy content that appears to contain a plaintext secret.");
  }
  try {
    await runProcess({
      command: "C:\\Windows\\System32\\clip.exe",
      args: [],
      input: safeText,
    });
  } catch {
    await runPowerShell({
      script: "[Console]::InputEncoding = [System.Text.UTF8Encoding]::new(); $text = [Console]::In.ReadToEnd(); Set-Clipboard -Value $text",
      input: safeText,
    });
  }
}

export async function pasteToDesktopWindow({ windowTitlePattern, processPattern, sendEnter }) {
  const encodedTitle = Buffer.from(String(windowTitlePattern || ""), "utf8").toString("base64");
  const encodedProcess = Buffer.from(String(processPattern || ""), "utf8").toString("base64");
  const script = `
$titlePattern = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${encodedTitle}"))
$processPattern = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${encodedProcess}"))
$shell = New-Object -ComObject WScript.Shell
$candidate = Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -match $processPattern -or $_.MainWindowTitle -match $titlePattern) } |
  Sort-Object -Property StartTime -Descending |
  Select-Object -First 1
if (-not $candidate) {
  Write-Output (@{ windowFound = $false; pasted = $false; sent = $false; processName = $null; title = $null } | ConvertTo-Json -Compress)
  exit 0
}
[void]$shell.AppActivate($candidate.Id)
Start-Sleep -Milliseconds 700
$shell.SendKeys('^v')
Start-Sleep -Milliseconds 500
if (${sendEnter ? "$true" : "$false"}) {
  $shell.SendKeys('~')
}
Write-Output (@{
  windowFound = $true
  pasted = $true
  sent = ${sendEnter ? "$true" : "$false"}
  processName = $candidate.ProcessName
  title = $candidate.MainWindowTitle
} | ConvertTo-Json -Compress)
`;
  const stdout = await runPowerShell({ script });
  return JSON.parse(stdout.trim() || "{}");
}

export function resolveCommand(commandName) {
  const result = spawnSync("where.exe", [commandName], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  if (result.status !== 0) {
    return null;
  }
  const firstLine = String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || null;
}

export function defaultDesktopDetection() {
  return {
    executablePath: resolveCommand("opencode") || resolveCommand("opencode.exe") || openCodeLoopPaths.defaultDesktopExePath,
    installed:
      resolveCommand("opencode") !== null
      || resolveCommand("opencode.exe") !== null
      || spawnSync(process.execPath, ["-e", `require("node:fs").accessSync(${JSON.stringify(openCodeLoopPaths.defaultDesktopExePath)})`], {
        cwd: repoRoot,
        stdio: "ignore",
        windowsHide: true,
      }).status === 0,
  };
}

export function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

export function normalizePath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
}

export async function runProcess({ command, args, input = "" }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
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
      rejectPromise(new Error(stderr || `Command failed with code ${code}: ${command}`));
    });
    child.stdin.end(String(input || ""));
  });
}

export async function runPowerShell({ script, input = "" }) {
  return runProcess({
    command: "powershell",
    args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    input,
  });
}
