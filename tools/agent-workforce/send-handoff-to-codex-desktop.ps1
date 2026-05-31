[CmdletBinding()]
param(
  [string]$PromptPath = ".codex-handoff/outbox/latest-codex-handoff.md",
  [string]$RunsDir = ".codex-handoff/runs",
  [object]$EnableGuiSend = $false,
  [object]$DryRun = $true,
  [object]$IExplicitlyApproveGuiSend = $false,
  [string]$WindowTitlePattern = "Codex",
  [object]$SendEnter = $true,
  [int]$FocusDelayMs = 700,
  [int]$PasteDelayMs = 700,
  [int]$SendDelayMs = 700,
  [object]$NoCommit = $true,
  [object]$NoPush = $true
)

$ErrorActionPreference = "Stop"

function Convert-ToBool {
  param($Value)
  if ($Value -is [bool]) { return $Value }
  $text = ([string]$Value).Trim().ToLowerInvariant()
  return @("1", "true", "yes", "y") -contains $text
}

function Resolve-RepoPath {
  param([string]$PathValue)
  if ([System.IO.Path]::IsPathRooted($PathValue)) { return $PathValue }
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
  return (Join-Path $repoRoot $PathValue)
}

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Test-PlainSecret {
  param([string]$Text)
  return ($Text -match "(?i)(sk-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|BEGIN\s+(RSA\s+)?PRIVATE\s+KEY)")
}

function Get-CodexDesktopWindow {
  param([string]$TitlePattern)
  $candidates = Get-Process -Name Codex -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 } |
    Sort-Object -Property StartTime -Descending
  if (-not $candidates) { return $null }
  $matched = $candidates | Where-Object { $_.MainWindowTitle -match $TitlePattern } | Select-Object -First 1
  if ($matched) { return $matched }
  return $candidates | Select-Object -First 1
}

function Ensure-DesktopAutomationTypes {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class CodexDesktopWindowTools {
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
"@
}

function Set-ClipboardText {
  param([string]$Text)
  try {
    [System.Windows.Forms.Clipboard]::SetText($Text)
  } catch {
    Set-Clipboard -Value $Text
  }
}

function Focus-CodexWindow {
  param($WindowProcess)
  [void][CodexDesktopWindowTools]::ShowWindowAsync($WindowProcess.MainWindowHandle, 9)
  Start-Sleep -Milliseconds $FocusDelayMs
  [void][CodexDesktopWindowTools]::SetForegroundWindow($WindowProcess.MainWindowHandle)
  Start-Sleep -Milliseconds $FocusDelayMs
}

$EnableGuiSend = Convert-ToBool $EnableGuiSend
$DryRun = Convert-ToBool $DryRun
$IExplicitlyApproveGuiSend = Convert-ToBool $IExplicitlyApproveGuiSend
$SendEnter = Convert-ToBool $SendEnter
$NoCommit = Convert-ToBool $NoCommit
$NoPush = Convert-ToBool $NoPush

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$resolvedPromptPath = Resolve-RepoPath $PromptPath
$resolvedRunsDir = Resolve-RepoPath $RunsDir
New-Item -ItemType Directory -Force -Path $resolvedRunsDir | Out-Null

$dryRunSummaryPath = Join-Path $resolvedRunsDir "codex-desktop-gui-send-dry-run-summary.json"
$runSummaryPath = Join-Path $resolvedRunsDir "codex-desktop-gui-send-run-summary.json"
$generatedAt = (Get-Date).ToUniversalTime().ToString("o")
$promptExists = Test-Path $resolvedPromptPath
$promptText = ""
if ($promptExists) {
  $promptText = Get-Content -Path $resolvedPromptPath -Raw
}

$window = Get-CodexDesktopWindow -TitlePattern $WindowTitlePattern
$codexDesktopWindowFound = $null -ne $window
$noPlaintextSecretsInPrompt = -not (Test-PlainSecret $promptText)
$explicitlyEnabled = ($EnableGuiSend -and -not $DryRun -and $IExplicitlyApproveGuiSend)

$summaryBase = [ordered]@{
  phase = "phase-235a-codex-desktop-gui-send-bridge"
  generatedAt = $generatedAt
  promptPath = $resolvedPromptPath
  runsDir = $resolvedRunsDir
  enableGuiSend = $EnableGuiSend
  dryRun = $DryRun
  explicitlyApproved = $IExplicitlyApproveGuiSend
  explicitlyEnabled = $explicitlyEnabled
  promptExists = $promptExists
  promptLength = $promptText.Length
  noPlaintextSecretsInPrompt = $noPlaintextSecretsInPrompt
  codexDesktopWindowFound = $codexDesktopWindowFound
  codexDesktopWindow = if ($codexDesktopWindowFound) {
    [ordered]@{
      processId = $window.Id
      processName = $window.ProcessName
      title = $window.MainWindowTitle
      handle = [string]$window.MainWindowHandle
    }
  } else {
    $null
  }
  windowTitlePattern = $WindowTitlePattern
  noCommit = $NoCommit
  noPush = $NoPush
  outputFiles = [ordered]@{
    dryRunSummary = $dryRunSummaryPath
    runSummary = $runSummaryPath
  }
  safety = [ordered]@{
    codexCliInvoked = $false
    codexExecInvoked = $false
    guiAutomationInvoked = $false
    handoffCopiedToClipboard = $false
    pasteKeysSent = $false
    enterKeySent = $false
    autoCommit = $false
    autoPush = $false
    worktreeCreated = $false
    workflowRun = $false
    realExternalRunnerDispatch = $false
    defaultNvidiaChatLaneChanged = $false
    plaintextApiKeyWritten = $false
    infiniteLoop = $false
    maxRounds = 1
  }
  notes = @(
    "This bridge targets the existing Codex Desktop GUI window.",
    "It does not invoke Codex CLI and cannot capture GUI output automatically.",
    "Codex result import still requires Codex to write .codex-handoff/inbox/latest-codex-result.md or a separate capture step."
  )
}

if (-not $explicitlyEnabled) {
  $summary = [ordered]@{} + $summaryBase
  $summary.status = "dry-run-complete"
  $summary.conclusion = "gui-send-dry-run-only"
  Write-Utf8NoBom -Path $dryRunSummaryPath -Content ($summary | ConvertTo-Json -Depth 30)
  [ordered]@{
    status = "dry-run-complete"
    guiAutomationInvoked = $false
    promptExists = $promptExists
    codexDesktopWindowFound = $codexDesktopWindowFound
    dryRunSummaryPath = $dryRunSummaryPath
  } | ConvertTo-Json -Depth 10
  exit 0
}

if (-not $promptExists) {
  throw "PromptPath does not exist: $resolvedPromptPath"
}
if (-not $codexDesktopWindowFound) {
  throw "Codex Desktop window was not found."
}
if (-not $NoCommit -or -not $NoPush) {
  throw "GUI send is blocked because NoCommit and NoPush must remain true."
}
if (-not $noPlaintextSecretsInPrompt) {
  throw "GUI send is blocked because the prompt appears to contain a plaintext secret."
}

Ensure-DesktopAutomationTypes
Set-ClipboardText -Text $promptText
Focus-CodexWindow -WindowProcess $window
[System.Windows.Forms.SendKeys]::SendWait("^v")
Start-Sleep -Milliseconds $PasteDelayMs
if ($SendEnter) {
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  Start-Sleep -Milliseconds $SendDelayMs
}

$summary = [ordered]@{} + $summaryBase
$summary.status = "sent-attempted"
$summary.conclusion = "handoff-pasted-to-codex-desktop-gui"
$summary.safety.guiAutomationInvoked = $true
$summary.safety.handoffCopiedToClipboard = $true
$summary.safety.pasteKeysSent = $true
$summary.safety.enterKeySent = $SendEnter
Write-Utf8NoBom -Path $runSummaryPath -Content ($summary | ConvertTo-Json -Depth 30)

[ordered]@{
  status = "sent-attempted"
  guiAutomationInvoked = $true
  handoffCopiedToClipboard = $true
  pasteKeysSent = $true
  enterKeySent = $SendEnter
  codexDesktopWindowFound = $codexDesktopWindowFound
  codexDesktopWindowTitle = $window.MainWindowTitle
  runSummaryPath = $runSummaryPath
} | ConvertTo-Json -Depth 10
