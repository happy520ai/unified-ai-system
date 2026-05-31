[CmdletBinding()]
param(
  [string]$InputPath = ".codex-handoff/inbox/latest-codex-result.md",
  [int]$TimeoutSeconds = 1800,
  [int]$PollSeconds = 5,
  [object]$CopyFeedbackToClipboard = $true,
  [object]$FailOnBoundaryViolation = $true
)

$ErrorActionPreference = "Stop"

function Convert-ToBool {
  param($Value)
  if ($Value -is [bool]) { return $Value }
  $text = ([string]$Value).Trim().ToLowerInvariant()
  return @("1", "true", "yes", "y") -contains $text
}

$CopyFeedbackToClipboard = Convert-ToBool $CopyFeedbackToClipboard
$FailOnBoundaryViolation = Convert-ToBool $FailOnBoundaryViolation

function Resolve-RepoPath {
  param([string]$PathValue)

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }

  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
  return (Join-Path $repoRoot $PathValue)
}

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$resolvedInputPath = Resolve-RepoPath $InputPath
$reviewDir = Join-Path $repoRoot ".codex-handoff/review"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedInputPath) | Out-Null
New-Item -ItemType Directory -Force -Path $reviewDir | Out-Null

$startedAt = Get-Date
$deadline = $startedAt.AddSeconds($TimeoutSeconds)
while (-not (Test-Path $resolvedInputPath)) {
  if ((Get-Date) -ge $deadline) {
    throw "Timed out waiting for Codex result: $resolvedInputPath"
  }
  Write-Host "Waiting for Codex result: $resolvedInputPath"
  Start-Sleep -Seconds ([Math]::Max(1, $PollSeconds))
}

$copyFeedbackArg = if ($CopyFeedbackToClipboard) { "1" } else { "0" }
$failOnBoundaryArg = if ($FailOnBoundaryViolation) { "1" } else { "0" }
$importOutput = & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "import-codex-result.ps1") `
  -InputPath $InputPath `
  -CopyFeedbackToClipboard $copyFeedbackArg `
  -FailOnBoundaryViolation $failOnBoundaryArg
if ($LASTEXITCODE -ne 0) {
  throw "codex:result:import failed."
}

$summaryPath = Join-Path $reviewDir "latest-wait-import-summary.json"
$systemReviewPath = Join-Path $reviewDir "latest-system-review.md"
$feedbackPath = Join-Path $reviewDir "latest-feedback-to-codex.md"
$reviewSummaryPath = Join-Path $reviewDir "latest-review-summary.json"
$generatedAt = (Get-Date).ToUniversalTime().ToString("o")

$summary = [ordered]@{
  phase = "phase-227a-auto-result-waiter-importer"
  status = "ok"
  generatedAt = $generatedAt
  inputPath = $resolvedInputPath
  waitedSeconds = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 3)
  timeoutSeconds = $TimeoutSeconds
  pollSeconds = $PollSeconds
  importOutput = ($importOutput | Out-String).Trim()
  outputFiles = [ordered]@{
    systemReview = $systemReviewPath
    feedbackToCodex = $feedbackPath
    reviewSummary = $reviewSummaryPath
    waiterSummary = $summaryPath
  }
  feedbackCopiedToClipboard = $CopyFeedbackToClipboard
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
    plaintextApiKeyWritten = $false
  }
}

Write-Utf8NoBom -Path $summaryPath -Content ($summary | ConvertTo-Json -Depth 30)

[ordered]@{
  status = "ok"
  phase = "phase-227a-auto-result-waiter-importer"
  inputPath = $resolvedInputPath
  systemReviewPath = $systemReviewPath
  feedbackPath = $feedbackPath
  reviewSummaryPath = $reviewSummaryPath
  feedbackCopiedToClipboard = $CopyFeedbackToClipboard
  codexExecInvoked = $false
} | ConvertTo-Json -Depth 10
