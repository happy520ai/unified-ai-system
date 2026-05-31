[CmdletBinding()]
param(
  [string]$Goal = "",
  [string]$GoalFile = "",
  [string]$Template = "feature-development",
  [object]$EnableCodexExec = $false,
  [object]$DryRun = $true,
  [int]$MaxRounds = 1,
  [object]$RequireCleanGit = $true,
  [object]$NoCommit = $true,
  [object]$NoPush = $true,
  [object]$NoWorktree = $true,
  [object]$IExplicitlyApproveCodexExec = $false,
  [string]$BaseUrl = "http://127.0.0.1:3100"
)

$ErrorActionPreference = "Stop"

function Convert-ToBool {
  param($Value)
  if ($Value -is [bool]) { return $Value }
  $text = ([string]$Value).Trim().ToLowerInvariant()
  return @("1", "true", "yes", "y") -contains $text
}

$EnableCodexExec = Convert-ToBool $EnableCodexExec
$DryRun = Convert-ToBool $DryRun
$RequireCleanGit = Convert-ToBool $RequireCleanGit
$NoCommit = Convert-ToBool $NoCommit
$NoPush = Convert-ToBool $NoPush
$NoWorktree = Convert-ToBool $NoWorktree
$IExplicitlyApproveCodexExec = Convert-ToBool $IExplicitlyApproveCodexExec

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

if ($MaxRounds -lt 1 -or $MaxRounds -gt 3) {
  throw "MaxRounds must be between 1 and 3."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runsDir = Join-Path $repoRoot ".codex-handoff/runs"
New-Item -ItemType Directory -Force -Path $runsDir | Out-Null

$handoffArgs = @("-BaseUrl", $BaseUrl, "-Template", $Template, "-CopyToClipboard", "1")
if (-not [string]::IsNullOrWhiteSpace($Goal)) {
  $handoffArgs += @("-Goal", $Goal)
} elseif (-not [string]::IsNullOrWhiteSpace($GoalFile)) {
  $handoffArgs += @("-GoalFile", $GoalFile)
} else {
  throw "Goal is required. Pass -Goal or -GoalFile."
}

$handoffOutput = & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "goal-to-codex-handoff.ps1") @handoffArgs
if ($LASTEXITCODE -ne 0) {
  throw "goal-to-codex-handoff.ps1 failed."
}

$realApproved = ($EnableCodexExec -and -not $DryRun -and $IExplicitlyApproveCodexExec)
$gitStatus = (& git -c "safe.directory=$repoRoot" status --short 2>&1 | Out-String).Trim()
if ($realApproved -and $RequireCleanGit -and -not [string]::IsNullOrWhiteSpace($gitStatus)) {
  throw "Real codex exec is blocked because git workspace is not clean."
}
if ($realApproved) {
  $codexPath = (& cmd /c where codex 2>&1 | Out-String).Trim()
  if ([string]::IsNullOrWhiteSpace($codexPath)) {
    throw "Real codex exec is blocked because codex command was not found."
  }
}

$loopArgs = @(
  "-PromptPath", ".codex-handoff/outbox/latest-codex-handoff.md",
  "-FeedbackPath", ".codex-handoff/review/latest-feedback-to-codex.md",
  "-MaxRounds", "$MaxRounds",
  "-RequireCleanGit", ([int]$RequireCleanGit).ToString(),
  "-NoCommit", ([int]$NoCommit).ToString(),
  "-NoPush", ([int]$NoPush).ToString()
)
if ($realApproved) {
  $loopArgs += @("-EnableCodexExec", "1", "-DryRun", "0")
} else {
  $loopArgs += @("-EnableCodexExec", "0", "-DryRun", "1")
}

$loopOutput = & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run-codex-exec-loop.ps1") @loopArgs
if ($LASTEXITCODE -ne 0) {
  throw "run-codex-exec-loop.ps1 failed."
}

$summaryPath = Join-Path $runsDir "latest-controlled-auto-loop-summary.json"
$summary = [ordered]@{
  phase = "phase-229a-controlled-codex-exec-auto-loop"
  status = if ($realApproved) { "one-shot-requested" } else { "dry-run-complete" }
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  enableCodexExec = $EnableCodexExec
  dryRun = -not $realApproved
  explicitlyApproved = $IExplicitlyApproveCodexExec
  maxRounds = $MaxRounds
  requireCleanGit = $RequireCleanGit
  noCommit = $NoCommit
  noPush = $NoPush
  noWorktree = $NoWorktree
  gitWorkspaceClean = [string]::IsNullOrWhiteSpace($gitStatus)
  handoffOutput = ($handoffOutput | Out-String).Trim()
  loopOutput = ($loopOutput | Out-String).Trim()
  safety = [ordered]@{
    codexCliInvoked = $realApproved
    codexExecInvoked = $realApproved
    autoApply = $false
    autoMerge = $false
    autoCommit = $false
    autoPush = $false
    worktreeCreated = $false
    workflowRun = $false
    realExternalRunnerDispatch = $false
    defaultNvidiaChatLaneChanged = $false
    infiniteLoop = $false
  }
}

Write-Utf8NoBom -Path $summaryPath -Content ($summary | ConvertTo-Json -Depth 30)

[ordered]@{
  status = $summary.status
  phase = "phase-229a-controlled-codex-exec-auto-loop"
  codexExecInvoked = $realApproved
  maxRounds = $MaxRounds
  summaryPath = $summaryPath
  note = if ($realApproved) { "Real one-shot mode was explicitly approved." } else { "Dry-run only; Codex CLI was not invoked." }
} | ConvertTo-Json -Depth 10
