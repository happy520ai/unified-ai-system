[CmdletBinding()]
param(
  [string]$Goal = "",
  [string]$GoalFile = "",
  [string]$Template = "feature-development",
  [string]$BaseUrl = "http://127.0.0.1:3100",
  [int]$MaxRounds = 0,
  [int]$TimeoutSeconds = 1800,
  [int]$PollSeconds = 5,
  [int]$SleepSecondsBetweenRounds = 3,
  [object]$UseSampleResult = $false,
  [object]$CopyFeedbackToClipboard = $true,
  [object]$EnableDesktopGuiSend = $false,
  [object]$DryRun = $true,
  [object]$IExplicitlyApproveGuiSend = $false,
  [object]$ClearStopOnStart = $true
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

function Invoke-Script {
  param(
    [string]$ScriptName,
    [array]$ArgsList
  )
  $scriptPath = Join-Path $PSScriptRoot $ScriptName
  $output = & powershell -ExecutionPolicy Bypass -File $scriptPath @ArgsList
  if ($LASTEXITCODE -ne 0) {
    throw "$ScriptName failed."
  }
  return ($output | Out-String).Trim()
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

function Get-FileWriteTimeUtc {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    return [DateTime]::MinValue
  }
  return (Get-Item $Path).LastWriteTimeUtc
}

function Wait-ForNewResult {
  param(
    [string]$Path,
    [DateTime]$AfterUtc,
    [int]$Timeout,
    [int]$Poll,
    [string]$StopPath
  )
  $started = Get-Date
  while ($true) {
    if (Test-Path $StopPath) {
      return @{ status = "stopped"; waitedSeconds = [Math]::Round(((Get-Date) - $started).TotalSeconds, 3) }
    }
    if ((Test-Path $Path) -and ((Get-Item $Path).LastWriteTimeUtc -gt $AfterUtc)) {
      return @{ status = "found"; waitedSeconds = [Math]::Round(((Get-Date) - $started).TotalSeconds, 3) }
    }
    if ($Timeout -gt 0 -and ((Get-Date) - $started).TotalSeconds -ge $Timeout) {
      return @{ status = "timeout"; waitedSeconds = [Math]::Round(((Get-Date) - $started).TotalSeconds, 3) }
    }
    Start-Sleep -Seconds ([Math]::Max(1, $Poll))
  }
}

function Write-SampleResult {
  param(
    [string]$Path,
    [int]$Round
  )
  $content = @"
# Codex Result

## Summary
Sample/manual bridge result for continuous loop verification round $Round.

## Changed Files
- none

## Commands Run
- cmd /c pnpm run agent:auto:continuous:test

## Tests Passed
- passed

## Evidence Paths
- .codex-handoff/inbox/latest-codex-result.md
- .codex-handoff/runs/latest-continuous-controlled-loop-summary.json

## Known Issues
- none

## Boundary Check
- legacy/ modified: no
- PROJECT_CONTEXT.md created: no
- oh-my-codex / OMX called: no
- worktree created: no
- workflow run hookup: no
- default NVIDIA /chat lane changed: no
- secret exposed: no
- failed verification: no

## Next Steps
- Continue the controlled loop only if the operator has not stopped it.
"@
  Write-Utf8NoBom -Path $Path -Content $content
}

$UseSampleResult = Convert-ToBool $UseSampleResult
$CopyFeedbackToClipboard = Convert-ToBool $CopyFeedbackToClipboard
$EnableDesktopGuiSend = Convert-ToBool $EnableDesktopGuiSend
$DryRun = Convert-ToBool $DryRun
$IExplicitlyApproveGuiSend = Convert-ToBool $IExplicitlyApproveGuiSend
$ClearStopOnStart = Convert-ToBool $ClearStopOnStart

if ($MaxRounds -lt 0) {
  throw "MaxRounds must be 0 or greater. Use 0 to run until STOP is requested."
}
if ($PollSeconds -lt 1) {
  throw "PollSeconds must be at least 1."
}

$realGuiApproved = ($EnableDesktopGuiSend -and -not $DryRun -and $IExplicitlyApproveGuiSend)
if ($realGuiApproved -and ($MaxRounds -eq 0 -or $MaxRounds -gt 3)) {
  throw "Real Codex Desktop GUI send is capped at 3 rounds and cannot run until stopped."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$handoffDir = Join-Path $repoRoot ".codex-handoff"
$controlDir = Join-Path $handoffDir "control"
$inboxDir = Join-Path $handoffDir "inbox"
$reviewDir = Join-Path $handoffDir "review"
$runsDir = Join-Path $handoffDir "runs"
New-Item -ItemType Directory -Force -Path $controlDir, $inboxDir, $reviewDir, $runsDir | Out-Null

$stopPath = Join-Path $controlDir "STOP"
if ($ClearStopOnStart -and (Test-Path $stopPath)) {
  Remove-Item -LiteralPath $stopPath -Force
}

$resultPath = Join-Path $inboxDir "latest-codex-result.md"
$summaryPath = Join-Path $runsDir "latest-continuous-controlled-loop-summary.json"
$normalizedBaseUrl = $BaseUrl.TrimEnd("/")
$rounds = @()
$startedAt = (Get-Date).ToUniversalTime().ToString("o")
$finalStatus = "running"

if ([string]::IsNullOrWhiteSpace($Goal) -and [string]::IsNullOrWhiteSpace($GoalFile)) {
  throw "Goal is required for the continuous loop. Pass -Goal or -GoalFile once at startup."
}

if (-not (Test-ServiceReady -Url $normalizedBaseUrl)) {
  Push-Location $repoRoot
  try {
    cmd /c pnpm run dev:phase7b | Out-Null
  } finally {
    Pop-Location
  }
}
if (-not (Test-ServiceReady -Url $normalizedBaseUrl)) {
  throw "Local service is not ready at $normalizedBaseUrl after startup attempt."
}

$round = 0
while ($true) {
  if (Test-Path $stopPath) {
    $finalStatus = "stopped-by-stop-file"
    break
  }
  if ($MaxRounds -gt 0 -and $round -ge $MaxRounds) {
    $finalStatus = "max-rounds-complete"
    break
  }

  $round += 1
  $lastResultWriteTime = Get-FileWriteTimeUtc -Path $resultPath
  $roundStartedAt = (Get-Date).ToUniversalTime().ToString("o")

  $handoffArgs = @("-BaseUrl", $normalizedBaseUrl, "-Template", $Template, "-CopyToClipboard", "1")
  if (-not [string]::IsNullOrWhiteSpace($Goal)) {
    $handoffArgs += @("-Goal", $Goal)
  } else {
    $handoffArgs += @("-GoalFile", $GoalFile)
  }
  $handoffOutput = Invoke-Script -ScriptName "goal-to-codex-handoff.ps1" -ArgsList $handoffArgs

  $desktopSendOutput = ""
  if ($EnableDesktopGuiSend) {
    $desktopArgs = @("-PromptPath", ".codex-handoff/outbox/latest-codex-handoff.md")
    if ($realGuiApproved) {
      $desktopArgs += @("-EnableGuiSend", "1", "-DryRun", "0", "-IExplicitlyApproveGuiSend", "1")
    }
    $desktopSendOutput = Invoke-Script -ScriptName "send-handoff-to-codex-desktop.ps1" -ArgsList $desktopArgs
  }

  if ($UseSampleResult) {
    Write-SampleResult -Path $resultPath -Round $round
  }

  $wait = Wait-ForNewResult -Path $resultPath -AfterUtc $lastResultWriteTime -Timeout $TimeoutSeconds -Poll $PollSeconds -StopPath $stopPath
  if ($wait.status -eq "stopped") {
    $finalStatus = "stopped-by-stop-file"
    break
  }
  if ($wait.status -eq "timeout") {
    $finalStatus = "waiting-timeout"
    $rounds += [ordered]@{
      round = $round
      status = "waiting-timeout"
      startedAt = $roundStartedAt
      waitedSeconds = $wait.waitedSeconds
      handoffOutput = $handoffOutput
      desktopSendOutput = $desktopSendOutput
    }
    break
  }

  $copyFeedbackArg = if ($CopyFeedbackToClipboard) { "1" } else { "0" }
  $importOutput = Invoke-Script -ScriptName "import-codex-result.ps1" -ArgsList @(
    "-InputPath", ".codex-handoff/inbox/latest-codex-result.md",
    "-CopyFeedbackToClipboard", $copyFeedbackArg,
    "-FailOnBoundaryViolation", "1"
  )

  $reviewSummaryPath = Join-Path $reviewDir "latest-review-summary.json"
  $decision = "unknown"
  if (Test-Path $reviewSummaryPath) {
    $decision = (Get-Content -Path $reviewSummaryPath -Raw | ConvertFrom-Json).decision
  }

  $rounds += [ordered]@{
    round = $round
    status = "completed"
    startedAt = $roundStartedAt
    waitedSeconds = $wait.waitedSeconds
    decision = $decision
    handoffOutput = $handoffOutput
    desktopSendOutput = $desktopSendOutput
    importOutput = $importOutput
  }

  $summary = [ordered]@{
    phase = "phase-236a-continuous-controlled-loop-supervisor"
    status = "running"
    startedAt = $startedAt
    updatedAt = (Get-Date).ToUniversalTime().ToString("o")
    mode = "continuous-controlled-loop"
    maxRounds = $MaxRounds
    roundsCompleted = ($rounds | Where-Object { $_.status -eq "completed" }).Count
    stopFile = $stopPath
    sampleResultMode = $UseSampleResult
    enableDesktopGuiSend = $EnableDesktopGuiSend
    realGuiSendApproved = $realGuiApproved
    rounds = $rounds
    safety = [ordered]@{
      codexCliInvoked = $false
      codexExecInvoked = $false
      guiAutomationInvoked = $realGuiApproved
      autoApply = $false
      autoMerge = $false
      autoCommit = $false
      autoPush = $false
      worktreeCreated = $false
      workflowRun = $false
      realExternalRunnerDispatch = $false
      defaultNvidiaChatLaneChanged = $false
      plaintextApiKeyWritten = $false
      manualStopEnabled = $true
    }
  }
  Write-Utf8NoBom -Path $summaryPath -Content ($summary | ConvertTo-Json -Depth 50)

  if ($SleepSecondsBetweenRounds -gt 0) {
    Start-Sleep -Seconds $SleepSecondsBetweenRounds
  }
}

$completedCount = ($rounds | Where-Object { $_.status -eq "completed" }).Count
$finalSummary = [ordered]@{
  phase = "phase-236a-continuous-controlled-loop-supervisor"
  status = $finalStatus
  startedAt = $startedAt
  finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  mode = "continuous-controlled-loop"
  maxRounds = $MaxRounds
  roundsCompleted = $completedCount
  stopFile = $stopPath
  sampleResultMode = $UseSampleResult
  enableDesktopGuiSend = $EnableDesktopGuiSend
  realGuiSendApproved = $realGuiApproved
  rounds = $rounds
  outputFiles = [ordered]@{
    handoff = (Join-Path $handoffDir "outbox/latest-codex-handoff.md")
    inboxResult = $resultPath
    systemReview = (Join-Path $reviewDir "latest-system-review.md")
    feedback = (Join-Path $reviewDir "latest-feedback-to-codex.md")
    reviewSummary = (Join-Path $reviewDir "latest-review-summary.json")
    summary = $summaryPath
  }
  safety = [ordered]@{
    codexCliInvoked = $false
    codexExecInvoked = $false
    guiAutomationInvoked = $realGuiApproved
    autoApply = $false
    autoMerge = $false
    autoCommit = $false
    autoPush = $false
    worktreeCreated = $false
    workflowRun = $false
    realExternalRunnerDispatch = $false
    defaultNvidiaChatLaneChanged = $false
    plaintextApiKeyWritten = $false
    manualStopEnabled = $true
  }
}

Write-Utf8NoBom -Path $summaryPath -Content ($finalSummary | ConvertTo-Json -Depth 50)

[ordered]@{
  status = $finalStatus
  phase = "phase-236a-continuous-controlled-loop-supervisor"
  roundsCompleted = $completedCount
  stopFile = $stopPath
  summaryPath = $summaryPath
  codexExecInvoked = $false
  realGuiSendApproved = $realGuiApproved
} | ConvertTo-Json -Depth 10
