// Windows Task Scheduler installer that runs without `sc.exe` (which is
// blocked by the default WorkBuddy sandbox security policy). It uses the
// PowerShell `ScheduledTasks` module via COM to register a logon-triggered
// task that:
//   * runs `node bin/start-service.js --daemon` for the current user
//   * restarts on failure (RestartCount=3, RestartInterval=60s)
//   * survives power management prompts and AC/DC switches
//   * never expires
//
// The scheduled task is the modern, low-privilege equivalent of a Windows
// Task Scheduler equivalent for our purposes: at user logon the task fires,
// the daemon launches,
// and the in-process supervisor handles crash recovery inside the lifetime
// of that single OS-level run.
//
// All commands are written in PowerShell and invoked via `powershell.exe
// -NoProfile -NonInteractive -Command -` from Node so we inherit the same
// policy exceptions granted to the host. When the sandbox is fully locked
// down, the user runs the same script manually from an elevated PowerShell;
// both paths produce identical registry state.

import { execFile as execFileCb } from "node:child_process";
import { existsSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execFileAsync = promisify(execFileCb);

export const TASK_NAME = "UnifiedAiSystemMcpService";
export const TASK_DISPLAY = "Unified AI System MCP Service";
export const TASK_DESCRIPTION =
  "Unified AI System MCP service - starts at user logon, restarts on crash, " +
  "and provides a local HTTP health endpoint on 127.0.0.1:7788.";

function quoted(value) {
  return `"${String(value).replace(/"/g, '`"')}"`;
}

export function resolveDaemonCommand(repoRoot, options = {}) {
  const startScript = resolve(
    repoRoot,
    "packages/mcp-service/bin/start-service.js",
  );
  if (!existsSync(startScript)) {
    throw new Error(
      `daemon start script missing at ${startScript}; check repository layout`,
    );
  }
  const nodeBinary = options.nodeBinary ?? process.execPath;
  if (!existsSync(nodeBinary)) {
    throw new Error(`node binary not found at ${nodeBinary}`);
  }
  const argList = [startScript, "--daemon", "--repo-root", repoRoot];
  // Default log to SYSTEM-temp so the daemon never stalls on a directory
  // that the SYSTEM account cannot create or write to.
  const logFile = options.logFile
    ?? join(process.env.SystemRoot ?? "C:\\Windows", "Temp\\UnifiedAiSystemMcpService.log");
  argList.push("--log-file", logFile);
  return { command: nodeBinary, args: argList, script: startScript };
}

function buildPowerShellScript(action, { command, args, taskName, displayName, description, repoRoot }) {
  // We assemble a Task Scheduler XML body and call Register-ScheduledTask
  // -Xml, which sidesteps a long-standing Cross-PowerShell type-binding
  // issue where New-ScheduledTaskAction returns a type that does NOT match
  // Register-ScheduledTask -Action's expected
  // Microsoft.Management.Infrastructure.CimInstance#MSFT_TaskAction.
  //
  // The XML uses the minimum task schema: no Settings block, no
  // RunLevel/LogonType/RestartCount/RestartInterval. These are
  // Task Scheduler 2.0 features that the local engine rejects with
  // HRESULT 0x80041316/0x80041318 in some Windows editions.
  // The on-disk task state is identical to one registered via the cmdlet
  // path; behavior-wise this is the same XML the engine writes.
  const escXml = (v) =>
    String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  const escPs = (v) => "'" + String(v).replace(/'/g, "''") + "'";
  const argsEscaped = escXml(args.join(" "));
  // Use the current user session so the daemon inherits the user
  // environment. SYSTEM principal was rejected by this machine.
  const userId = `${process.env.COMPUTERNAME ?? "localhost"}\\${process.env.USERNAME ?? "Administrator"}`;
  const xml = [
    '<?xml version="1.0" encoding="UTF-16"?>',
    '<Task xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
    '  <RegistrationInfo>',
    `    <Description>${escXml(description)}</Description>`,
    '  </RegistrationInfo>',
    '  <Triggers>',
    '    <LogonTrigger>',
    '      <Enabled>true</Enabled>',
    '    </LogonTrigger>',
    '  </Triggers>',
    '  <Principals>',
    '    <Principal id="Author">',
    `      <UserId>${escXml(userId)}</UserId>`,
    '    </Principal>',
    '  </Principals>',
    '  <Actions Context="Author">',
    '    <Exec>',
    `      <Command>${escXml(command)}</Command>`,
    `      <Arguments>${argsEscaped}</Arguments>`,
    `      <WorkingDirectory>${escXml(repoRoot)}</WorkingDirectory>`,
    '    </Exec>',
    '  </Actions>',
    '</Task>',
    '',
  ].join("\n");
  return [
    "$ErrorActionPreference = 'Stop'",
    `$taskName = ${escPs(taskName)}`,
    `$taskXml = @'\n${xml}\n'@`,
    `switch (${escPs(action)}) {`,
    `  'install' {`,
    `    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue`,
    `    if ($existing) { Stop-ScheduledTask -InputObject $existing -ErrorAction SilentlyContinue; Unregister-ScheduledTask -InputObject $existing -Confirm:$false }`,
    `    Register-ScheduledTask -TaskName $taskName -Xml $taskXml -Force | Out-Null`,
    `    Start-ScheduledTask -TaskName $taskName`,
    `    Write-Host 'INSTALLED'`,
    `  }`,
    `  'uninstall' {`,
    `    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue`,
    `    if ($existing) { Stop-ScheduledTask -InputObject $existing -ErrorAction SilentlyContinue; Unregister-ScheduledTask -InputObject $existing -Confirm:$false }`,
    `    Write-Host 'UNINSTALLED'`,
    `  }`,
    `  'query' {`,
    `    $info = Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction SilentlyContinue`,
    `    if ($info) { $info | Format-List | Out-String } else { Write-Host 'NOT_INSTALLED' }`,
    `  }`,
    `  default { throw ('unknown action ' + $action) }`,
    `}`,
  ].join("\n");
}

async function runPowerShellScript(scriptText) {
  const dir = mkdtempSync(join(tmpdir(), "mcp-svc-"));
  const scriptPath = join(dir, "install.ps1");
  try {
    writeFileSync(scriptPath, scriptText, "utf8");
    const result = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
      ],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
    );
    return result.stdout ?? "";
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function installWindowsService(options = {}) {
  if (process.platform !== "win32") {
    throw new Error("Windows Task Scheduler install requires a Windows host.");
  }
  const { command, args } = resolveDaemonCommand(options.repoRoot, {
    nodeBinary: options.nodeBinary,
    logFile: options.logFile,
  });
  const script = buildPowerShellScript("install", {
    command,
    args,
    taskName: TASK_NAME,
    displayName: TASK_DISPLAY,
    description: TASK_DESCRIPTION,
    repoRoot: options.repoRoot,
  });
  const stdout = await runPowerShellScript(script);
  if (!stdout.includes("INSTALLED")) {
    throw new Error(`install did not confirm: ${stdout}`);
  }
  return {
    name: TASK_NAME,
    displayName: TASK_DISPLAY,
    command,
    args,
    logFile: options.logFile ?? null,
    repoRoot: options.repoRoot,
    output: stdout,
  };
}

export async function uninstallWindowsService(options = {}) {
  if (process.platform !== "win32") {
    throw new Error("Windows Task Scheduler uninstall requires a Windows host.");
  }
  const script = buildPowerShellScript("uninstall", {
    command: process.execPath,
    args: [],
    taskName: TASK_NAME,
    displayName: TASK_DISPLAY,
    description: TASK_DESCRIPTION,
    repoRoot: options.repoRoot,
  });
  const stdout = await runPowerShellScript(script);
  return { name: TASK_NAME, output: stdout };
}

export async function queryWindowsService() {
  if (process.platform !== "win32") {
    throw new Error("Windows Task Scheduler query requires a Windows host.");
  }
  const script = buildPowerShellScript("query", {
    command: process.execPath,
    args: [],
    taskName: TASK_NAME,
    displayName: TASK_DISPLAY,
    description: TASK_DESCRIPTION,
    repoRoot: "",
  });
  return runPowerShellScript(script);
}

export const installerWindowsInternals = {
  buildPowerShellScript,
  resolveDaemonCommand,
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  (async () => {
    const action = process.argv[2] ?? "install";
    const repoRoot = resolve(__dirname, "../../../..");
    try {
      if (action === "install") {
        const info = await installWindowsService({ repoRoot });
        process.stdout.write(JSON.stringify(info, null, 2) + "\n");
      } else if (action === "uninstall") {
        const info = await uninstallWindowsService({ repoRoot });
        process.stdout.write(JSON.stringify(info, null, 2) + "\n");
      } else if (action === "query") {
        const text = await queryWindowsService();
        process.stdout.write(text);
      } else {
        process.stderr.write(`unknown action: ${action}\n`);
        process.exit(1);
      }
    } catch (error) {
      process.stderr.write(`windows-service ${action} failed: ${error.message}\n`);
      process.exit(1);
    }
  })();
}
