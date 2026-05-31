[CmdletBinding()]
param(
  [string]$Goal = "",
  [string]$GoalFile = "",
  [string]$Template = "feature-development",
  [object]$WaitForResult = $true,
  [int]$TimeoutSeconds = 1800,
  [int]$MaxRounds = 1,
  [string]$BaseUrl = "http://127.0.0.1:3100"
)

$ErrorActionPreference = "Stop"

function Convert-ToBool {
  param($Value)
  if ($Value -is [bool]) { return $Value }
  $text = ([string]$Value).Trim().ToLowerInvariant()
  return @("1", "true", "yes", "y") -contains $text
}

$WaitForResult = Convert-ToBool $WaitForResult

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

function Test-ServiceReady {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri ($Url.TrimEnd("/") + "/health/check") -Method Get -TimeoutSec 5
    $json = $response.Content | ConvertFrom-Json
    return ($response.StatusCode -eq 200 -and ($json.status -eq "ready" -or $json.data.status -eq "ready"))
  } catch {
    return $false
  }
}

if ($MaxRounds -lt 1 -or $MaxRounds -gt 3) {
  throw "MaxRounds must be between 1 and 3."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$handoffDir = Join-Path $repoRoot ".codex-handoff"
$runsDir = Join-Path $handoffDir "runs"
New-Item -ItemType Directory -Force -Path $runsDir | Out-Null

if (-not (Test-ServiceReady -Url $BaseUrl)) {
  Push-Location $repoRoot
  try {
    cmd /c pnpm run dev:phase7b | Out-Null
  } finally {
    Pop-Location
  }
}
if (-not (Test-ServiceReady -Url $BaseUrl)) {
  throw "Local service is not ready at $BaseUrl after startup attempt."
}

$handoffArgs = @(
  "-BaseUrl", $BaseUrl,
  "-Template", $Template,
  "-CopyToClipboard", "1"
)
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

Write-Host ""
Write-Host "Handoff is copied to clipboard. Paste it into Codex, then save Codex's response to:"
Write-Host ".codex-handoff\inbox\latest-codex-result.md"
Write-Host ""

$importOutput = ""
if ($WaitForResult) {
  $importOutput = & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "wait-and-import-codex-result.ps1") `
    -TimeoutSeconds $TimeoutSeconds `
    -CopyFeedbackToClipboard 1
  if ($LASTEXITCODE -ne 0) {
    throw "wait-and-import-codex-result.ps1 failed."
  }
}

$summaryPath = Join-Path $runsDir "latest-manual-bridge-loop-summary.json"
$summary = [ordered]@{
  phase = "phase-228a-one-click-manual-bridge-loop"
  status = "ok"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  mode = "manual-bridge-loop"
  goalProvided = (-not [string]::IsNullOrWhiteSpace($Goal) -or -not [string]::IsNullOrWhiteSpace($GoalFile))
  waitForResult = $WaitForResult
  timeoutSeconds = $TimeoutSeconds
  maxRounds = $MaxRounds
  handoffOutput = ($handoffOutput | Out-String).Trim()
  importOutput = ($importOutput | Out-String).Trim()
  outputFiles = [ordered]@{
    handoffMarkdown = (Join-Path $handoffDir "outbox/latest-codex-handoff.md")
    inboxResult = (Join-Path $handoffDir "inbox/latest-codex-result.md")
    feedback = (Join-Path $handoffDir "review/latest-feedback-to-codex.md")
    summary = $summaryPath
  }
  safety = [ordered]@{
    codexCliInvoked = $false
    codexExecInvoked = $false
    autoApply = $false
    autoMerge = $false
    autoCommit = $false
    autoPush = $false
    worktreeCreated = $false
    workflowRun = $false
    realExternalRunnerDispatch = $false
    defaultNvidiaChatLaneChanged = $false
  }
}

Write-Utf8NoBom -Path $summaryPath -Content ($summary | ConvertTo-Json -Depth 30)

[ordered]@{
  status = "ok"
  phase = "phase-228a-one-click-manual-bridge-loop"
  handoffCopiedToClipboard = $true
  waitedForResult = $WaitForResult
  codexExecInvoked = $false
  summaryPath = $summaryPath
} | ConvertTo-Json -Depth 10
