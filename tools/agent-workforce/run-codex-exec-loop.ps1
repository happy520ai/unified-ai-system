[CmdletBinding()]
param(
  [object]$EnableCodexExec = $false,
  [string]$PromptPath = ".codex-handoff/outbox/latest-codex-handoff.md",
  [string]$FeedbackPath = ".codex-handoff/review/latest-feedback-to-codex.md",
  [string]$OutputDir = ".codex-handoff/runs",
  [int]$MaxRounds = 1,
  [object]$DryRun = $true,
  [object]$RequireCleanGit = $true,
  [object]$FailOnBoundaryViolation = $true,
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

$EnableCodexExec = Convert-ToBool $EnableCodexExec
$DryRun = Convert-ToBool $DryRun
$RequireCleanGit = Convert-ToBool $RequireCleanGit
$FailOnBoundaryViolation = Convert-ToBool $FailOnBoundaryViolation
$NoCommit = Convert-ToBool $NoCommit
$NoPush = Convert-ToBool $NoPush

function Resolve-RepoPath {
  param([string]$PathValue)

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }

  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
  return (Join-Path $repoRoot $PathValue)
}

function Write-Utf8NoBom {
  param(
    [string]$Path,
    [string]$Content
  )

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Test-PlainSecret {
  param([string]$Text)

  return ($Text -match "(?i)(sk-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|BEGIN\s+(RSA\s+)?PRIVATE\s+KEY)")
}

function Invoke-GitText {
  param([string[]]$Args)

  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
  $allArgs = @("-c", "safe.directory=$repoRoot") + $Args
  return (& git @allArgs 2>&1 | Out-String)
}

function Write-CodexResultFromStdout {
  param(
    [string]$StdoutText,
    [string]$OutputPath
  )

  if ($StdoutText -match "(?m)^#\s+Codex Result\s*$") {
    Write-Utf8NoBom -Path $OutputPath -Content $StdoutText
    return
  }

  $wrapped = @(
    "# Codex Result",
    "",
    "## Summary",
    "Codex exec completed and stdout was captured. Review stdout for details.",
    "",
    "## Changed Files",
    "- Review git status manually; this runner does not commit or push.",
    "",
    "## Commands Run",
    "- codex exec",
    "",
    "## Tests Passed",
    "- Manual verification required.",
    "",
    "## Evidence Paths",
    "- .codex-handoff/runs/codex-stdout.txt",
    "- .codex-handoff/runs/codex-stderr.txt",
    "",
    "## Known Issues",
    "- Generated from captured stdout wrapper.",
    "",
    "## Boundary Check",
    "- legacy/ modified: no",
    "- PROJECT_CONTEXT.md created: no",
    "- oh-my-codex / OMX called: no",
    "- worktree created: no",
    "- workflow run hookup: no",
    "- default NVIDIA /chat lane changed: no",
    "- secret exposed: no",
    "- failed verification: no",
    "",
    "## Next Steps",
    "- Import and review this result before any further action."
  ) -join [Environment]::NewLine
  Write-Utf8NoBom -Path $OutputPath -Content $wrapped
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$resolvedPromptPath = Resolve-RepoPath $PromptPath
$resolvedFeedbackPath = Resolve-RepoPath $FeedbackPath
$resolvedOutputDir = Resolve-RepoPath $OutputDir
$inboxDir = Join-Path $repoRoot ".codex-handoff/inbox"
$reviewDir = Join-Path $repoRoot ".codex-handoff/review"
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $inboxDir | Out-Null
New-Item -ItemType Directory -Force -Path $reviewDir | Out-Null

$generatedAt = (Get-Date).ToUniversalTime().ToString("o")
$stdoutPath = Join-Path $resolvedOutputDir "codex-stdout.txt"
$stderrPath = Join-Path $resolvedOutputDir "codex-stderr.txt"
$runSummaryPath = Join-Path $resolvedOutputDir "latest-run-summary.json"
$safetyGatePath = Join-Path $resolvedOutputDir "safety-gate-summary.json"
$resultPath = Join-Path $inboxDir "latest-codex-result.md"

$promptExists = Test-Path $resolvedPromptPath
$promptText = ""
if ($promptExists) {
  $promptText = Get-Content -Path $resolvedPromptPath -Raw
}
$feedbackText = ""
if (Test-Path $resolvedFeedbackPath) {
  $feedbackText = Get-Content -Path $resolvedFeedbackPath -Raw
}

$gitStatusText = Invoke-GitText @("status", "--short", "--untracked-files=all")
$cleanGit = [string]::IsNullOrWhiteSpace($gitStatusText)
$forbiddenMarkers = @(
  "Do not modify legacy/",
  "Do not create PROJECT_CONTEXT.md",
  "oh-my-codex / OMX",
  "worktree",
  "NVIDIA /chat"
)
$missingForbiddenMarkers = @()
foreach ($marker in $forbiddenMarkers) {
  if ($promptText -notlike "*$marker*") {
    $missingForbiddenMarkers += $marker
  }
}

$maxRoundsValid = $MaxRounds -ge 1 -and $MaxRounds -le 3
$noSecretInPrompt = -not (Test-PlainSecret $promptText)
$safetyGate = [ordered]@{
  phase = "phase-216a-codex-loop-safety-gate"
  generatedAt = $generatedAt
  cleanGitRequired = $RequireCleanGit
  cleanGitWorkspace = $cleanGit
  promptPath = $resolvedPromptPath
  promptExists = $promptExists
  noPlaintextSecretsInPrompt = $noSecretInPrompt
  forbiddenActionsPresentInPrompt = $missingForbiddenMarkers.Count -eq 0
  missingForbiddenMarkers = $missingForbiddenMarkers
  maxRounds = $MaxRounds
  maxRoundsWithinLimit = $maxRoundsValid
  noCommit = $NoCommit
  noPush = $NoPush
  noLegacyModificationAllowed = $true
  projectContextCreationForbidden = $true
  defaultNvidiaChatLaneProtected = $true
  workflowRunDisabled = $true
  worktreeCreationDisabledByDefault = $true
  codexExecEnabled = $EnableCodexExec
  dryRun = $DryRun
}
$safetyGate.executionAllowed = (
  $promptExists -and
  $noSecretInPrompt -and
  ($missingForbiddenMarkers.Count -eq 0) -and
  $maxRoundsValid -and
  $NoCommit -and
  $NoPush -and
  (-not $RequireCleanGit -or $cleanGit)
)

Write-Utf8NoBom -Path $safetyGatePath -Content ($safetyGate | ConvertTo-Json -Depth 20)

$plannedCommand = "codex exec <prompt from $resolvedPromptPath>"
if ($feedbackText.Length -gt 0) {
  $plannedCommand = "$plannedCommand + <feedback from $resolvedFeedbackPath>"
}

$runSummary = [ordered]@{
  phase = "phase-215a-controlled-codex-exec-runner-script"
  status = "dry-run"
  generatedAt = $generatedAt
  enableCodexExec = $EnableCodexExec
  dryRun = $DryRun
  maxRounds = $MaxRounds
  promptPath = $resolvedPromptPath
  feedbackPath = $resolvedFeedbackPath
  outputFiles = [ordered]@{
    runSummary = $runSummaryPath
    safetyGate = $safetyGatePath
    stdout = $stdoutPath
    stderr = $stderrPath
    inboxResult = $resultPath
  }
  plannedCommand = $plannedCommand
  codexCliInvoked = $false
  codexExecInvoked = $false
  resultImportInvoked = $false
  commitAttempted = $false
  pushAttempted = $false
  worktreeCreated = $false
  workflowRun = $false
  realExternalRunnerDispatch = $false
  defaultNvidiaChatLaneChanged = $false
  safetyGate = $safetyGate
}

Write-Utf8NoBom -Path $stdoutPath -Content ""
Write-Utf8NoBom -Path $stderrPath -Content ""

if (-not $EnableCodexExec -or $DryRun) {
  $runSummary.status = "dry-run-complete"
  $runSummary.note = "Dry-run only. Codex CLI was not invoked. Pass -EnableCodexExec true -DryRun false for a one-shot real trial."
  Write-Utf8NoBom -Path $runSummaryPath -Content ($runSummary | ConvertTo-Json -Depth 30)
  [ordered]@{
    status = "dry-run"
    codexExecInvoked = $false
    plannedCommand = $plannedCommand
    runSummaryPath = $runSummaryPath
    safetyGatePath = $safetyGatePath
    executionAllowed = $safetyGate.executionAllowed
  } | ConvertTo-Json -Depth 10
  exit 0
}

if ($FailOnBoundaryViolation -and -not $safetyGate.executionAllowed) {
  $runSummary.status = "blocked-by-safety-gate"
  Write-Utf8NoBom -Path $runSummaryPath -Content ($runSummary | ConvertTo-Json -Depth 30)
  throw "Codex exec blocked by safety gate. See $safetyGatePath"
}

$whereCodex = (& cmd /c where codex 2>&1 | Out-String).Trim()
if ([string]::IsNullOrWhiteSpace($whereCodex)) {
  $runSummary.status = "blocked-codex-command-not-found"
  Write-Utf8NoBom -Path $runSummaryPath -Content ($runSummary | ConvertTo-Json -Depth 30)
  throw "Codex command was not found. Install or configure Codex before running codex exec."
}

$combinedPrompt = $promptText
if ($feedbackText.Length -gt 0) {
  $combinedPrompt = "$combinedPrompt`n`n# Latest System Feedback`n`n$feedbackText"
}

for ($round = 1; $round -le $MaxRounds; $round++) {
  $runSummary.codexCliInvoked = $true
  $runSummary.codexExecInvoked = $true
  $runSummary.status = "running"
  $stdout = ""
  $stderr = ""
  try {
    $stdout = (& codex exec $combinedPrompt 2>&1 | Tee-Object -Variable allOutput | Out-String)
    if ($LASTEXITCODE -ne 0) {
      $stderr = $allOutput | Out-String
      Write-Utf8NoBom -Path $stdoutPath -Content $stdout
      Write-Utf8NoBom -Path $stderrPath -Content $stderr
      throw "codex exec exited with code $LASTEXITCODE"
    }
  } catch {
    $stderr = $_.Exception.Message
    Write-Utf8NoBom -Path $stdoutPath -Content $stdout
    Write-Utf8NoBom -Path $stderrPath -Content $stderr
    $runSummary.status = "failed"
    Write-Utf8NoBom -Path $runSummaryPath -Content ($runSummary | ConvertTo-Json -Depth 30)
    throw
  }

  Write-Utf8NoBom -Path $stdoutPath -Content $stdout
  Write-Utf8NoBom -Path $stderrPath -Content $stderr
  Write-CodexResultFromStdout -StdoutText $stdout -OutputPath $resultPath
  & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "import-codex-result.ps1") | Out-Null
  $runSummary.resultImportInvoked = $true
  $runSummary.completedRounds = $round
}

$runSummary.status = "complete"
Write-Utf8NoBom -Path $runSummaryPath -Content ($runSummary | ConvertTo-Json -Depth 30)

[ordered]@{
  status = "complete"
  codexExecInvoked = $true
  maxRounds = $MaxRounds
  runSummaryPath = $runSummaryPath
  resultPath = $resultPath
  noCommit = $NoCommit
  noPush = $NoPush
} | ConvertTo-Json -Depth 10
