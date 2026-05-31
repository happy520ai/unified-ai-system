[CmdletBinding()]
param(
  [string]$InputPath = ".codex-handoff/inbox/latest-codex-result.md",
  [string]$OutputDir = ".codex-handoff/review",
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
  param(
    [string]$Path,
    [string]$Content
  )

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Test-ContainsAllSections {
  param(
    [string]$Text,
    [string[]]$Sections
  )

  $missing = @()
  foreach ($section in $Sections) {
    if ($Text -notmatch "(?m)^##\s+$([Regex]::Escape($section))\s*$") {
      $missing += $section
    }
  }
  return $missing
}

function Find-SignalMatches {
  param(
    [string]$Text,
    [array]$Signals
  )

  $matches = @()
  foreach ($signal in $Signals) {
    if ($Text -match $signal.Pattern) {
      $matches += [ordered]@{
        id = $signal.Id
        label = $signal.Label
        pattern = $signal.Pattern
      }
    }
  }
  return $matches
}

$resolvedInputPath = Resolve-RepoPath $InputPath
$resolvedOutputDir = Resolve-RepoPath $OutputDir
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$outboxDir = Join-Path $repoRoot ".codex-handoff/outbox"

if (-not (Test-Path $resolvedInputPath)) {
  throw "Codex result inbox file not found: $resolvedInputPath"
}

New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $outboxDir | Out-Null

$resultMarkdown = Get-Content -Path $resolvedInputPath -Raw
$requiredSections = @(
  "Summary",
  "Changed Files",
  "Commands Run",
  "Tests Passed",
  "Evidence Paths",
  "Known Issues",
  "Boundary Check",
  "Next Steps"
)

$missingSections = Test-ContainsAllSections -Text $resultMarkdown -Sections $requiredSections
$forbiddenSignals = @(
  @{ Id = "legacy-modified"; Label = "legacy/ was modified"; Pattern = "(?i)(legacy/.*(modified|changed|touched).*(yes|true)|modified\s+legacy/)" },
  @{ Id = "project-context-created"; Label = "PROJECT_CONTEXT.md was created"; Pattern = "(?i)(PROJECT_CONTEXT\.md.*(created|added).*(yes|true)|created\s+PROJECT_CONTEXT\.md)" },
  @{ Id = "omx-called"; Label = "oh-my-codex / OMX was called"; Pattern = "(?i)((oh-my-codex|OMX|team|ralph).*(called|executed|ran).*(yes|true)|called\s+(oh-my-codex|OMX|team|ralph))" },
  @{ Id = "worktree-created"; Label = "worktree was created"; Pattern = "(?i)(worktree.*(created|added).*(yes|true)|created\s+worktree)" },
  @{ Id = "workflow-run-hookup"; Label = "workflow run hookup was used"; Pattern = "(?i)(workflow\s+run.*(hookup|connected|called|used).*(yes|true)|connected\s+workflow\s+run)" },
  @{ Id = "nvidia-chat-changed"; Label = "default NVIDIA /chat lane changed"; Pattern = "(?i)(NVIDIA\s+/chat.*(changed|modified).*(yes|true)|changed\s+default\s+NVIDIA\s+/chat)" },
  @{ Id = "secret-exposed"; Label = "secret was exposed"; Pattern = "(?i)(secret.*(exposed|leaked|printed).*(yes|true)|API\s*key.*(exposed|leaked|printed).*(yes|true))" },
  @{ Id = "verification-failed"; Label = "verification did not pass"; Pattern = "(?i)((failed\s+verification.*(yes|true))|(verification.*(failed|not\s+passed).*(yes|true))|(tests.*(failed|not\s+passed).*(yes|true)))" }
)
$boundaryViolations = Find-SignalMatches -Text $resultMarkdown -Signals $forbiddenSignals

$verificationGaps = @()
if ($missingSections.Count -gt 0) {
  $verificationGaps += "Missing required sections: $($missingSections -join ', ')"
}
if ($resultMarkdown -notmatch "(?im)^##\s+Tests Passed\s*$[\s\S]*?(passed|success|ok|none failed)") {
  $verificationGaps += "Tests Passed section does not clearly state a passing verification result."
}

$decision = "accepted-preview"
if ($verificationGaps.Count -gt 0) {
  $decision = "needs-fix"
}
if ($boundaryViolations.Count -gt 0) {
  $decision = "blocked"
}

$generatedAt = (Get-Date).ToUniversalTime().ToString("o")
$systemReviewPath = Join-Path $resolvedOutputDir "latest-system-review.md"
$feedbackPath = Join-Path $resolvedOutputDir "latest-feedback-to-codex.md"
$summaryPath = Join-Path $resolvedOutputDir "latest-review-summary.json"
$outboxFeedbackPath = Join-Path $outboxDir "feedback-to-codex.md"

$reviewLines = [System.Collections.Generic.List[string]]::new()
$reviewLines.Add("# System Review")
$reviewLines.Add("")
$reviewLines.Add("- Decision: $decision")
$reviewLines.Add("- Source: $resolvedInputPath")
$reviewLines.Add("- Generated at: $generatedAt")
$reviewLines.Add("- Copy feedback to clipboard: $CopyFeedbackToClipboard")
$reviewLines.Add("")
$reviewLines.Add("## Section Check")
foreach ($section in $requiredSections) {
  $present = $missingSections -notcontains $section
  $reviewLines.Add("- ${section}: $present")
}
$reviewLines.Add("")
$reviewLines.Add("## Boundary Issues")
if ($boundaryViolations.Count -eq 0) {
  $reviewLines.Add("- none")
} else {
  foreach ($violation in $boundaryViolations) {
    $reviewLines.Add("- $($violation.label)")
  }
}
$reviewLines.Add("")
$reviewLines.Add("## Verification Gaps")
if ($verificationGaps.Count -eq 0) {
  $reviewLines.Add("- none")
} else {
  foreach ($gap in $verificationGaps) {
    $reviewLines.Add("- $gap")
  }
}
$reviewLines.Add("")
$reviewLines.Add("## Safety Conclusion")
$reviewLines.Add("- No automatic patch apply, merge, commit, or push was performed by this import script.")
$reviewLines.Add("- No Codex CLI invocation was performed by this import script.")

$feedbackLines = [System.Collections.Generic.List[string]]::new()
$feedbackLines.Add("# Feedback to Codex")
$feedbackLines.Add("")
$feedbackLines.Add("## Review Decision")
$feedbackLines.Add($decision)
$feedbackLines.Add("")
$feedbackLines.Add("## Required Fixes")
if ($decision -eq "accepted-preview") {
  $feedbackLines.Add("- none")
} elseif ($boundaryViolations.Count -gt 0) {
  foreach ($violation in $boundaryViolations) {
    $feedbackLines.Add("- Resolve boundary issue: $($violation.label)")
  }
} else {
  foreach ($gap in $verificationGaps) {
    $feedbackLines.Add("- $gap")
  }
}
$feedbackLines.Add("")
$feedbackLines.Add("## Verification Gaps")
if ($verificationGaps.Count -eq 0) {
  $feedbackLines.Add("- none")
} else {
  foreach ($gap in $verificationGaps) {
    $feedbackLines.Add("- $gap")
  }
}
$feedbackLines.Add("")
$feedbackLines.Add("## Boundary Issues")
if ($boundaryViolations.Count -eq 0) {
  $feedbackLines.Add("- none")
} else {
  foreach ($violation in $boundaryViolations) {
    $feedbackLines.Add("- $($violation.label)")
  }
}
$feedbackLines.Add("")
$feedbackLines.Add("## Follow-up Instructions")
$feedbackLines.Add("- Keep changes scoped to the original handoff.")
$feedbackLines.Add("- Do not modify legacy/.")
$feedbackLines.Add("- Do not create PROJECT_CONTEXT.md.")
$feedbackLines.Add("- Do not call oh-my-codex / OMX / team / ralph.")
$feedbackLines.Add("- Do not create a worktree or connect a workflow run.")
$feedbackLines.Add("- Do not change the default NVIDIA /chat lane.")
$feedbackLines.Add("- Do not commit, push, or expose secrets.")
$feedbackLines.Add("")
$feedbackLines.Add("## Required Response Format")
$feedbackLines.Add("- Summary")
$feedbackLines.Add("- Changed Files")
$feedbackLines.Add("- Commands Run")
$feedbackLines.Add("- Tests Passed")
$feedbackLines.Add("- Evidence Paths")
$feedbackLines.Add("- Known Issues")
$feedbackLines.Add("- Boundary Check")
$feedbackLines.Add("- Next Steps")

$reviewMarkdown = $reviewLines -join [Environment]::NewLine
$feedbackMarkdown = $feedbackLines -join [Environment]::NewLine

$summary = [ordered]@{
  phase = "phase-210a-codex-result-import-script"
  status = "reviewed"
  generatedAt = $generatedAt
  inputPath = $resolvedInputPath
  outputFiles = [ordered]@{
    systemReview = $systemReviewPath
    feedbackToCodex = $feedbackPath
    reviewSummary = $summaryPath
    outboxFeedback = $outboxFeedbackPath
  }
  decision = $decision
  missingSections = $missingSections
  boundaryViolations = $boundaryViolations
  verificationGaps = $verificationGaps
  copyFeedbackToClipboardRequested = $CopyFeedbackToClipboard
  feedbackCopiedToClipboard = $false
  safety = [ordered]@{
    codexCliInvoked = $false
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

Write-Utf8NoBom -Path $systemReviewPath -Content $reviewMarkdown
Write-Utf8NoBom -Path $feedbackPath -Content $feedbackMarkdown
Write-Utf8NoBom -Path $outboxFeedbackPath -Content $feedbackMarkdown

if ($CopyFeedbackToClipboard) {
  try {
    Set-Clipboard -Value $feedbackMarkdown
    $summary.feedbackCopiedToClipboard = $true
  } catch {
    try {
      $feedbackMarkdown | clip.exe
      $summary.feedbackCopiedToClipboard = $true
      $summary.clipboardFallback = "clip.exe"
    } catch {
      throw "Failed to copy feedback to the Windows clipboard. $($_.Exception.Message)"
    }
  }
}

Write-Utf8NoBom -Path $summaryPath -Content ($summary | ConvertTo-Json -Depth 20)

if ($FailOnBoundaryViolation -and $boundaryViolations.Count -gt 0) {
  throw "Boundary violation detected in Codex result: $($boundaryViolations.label -join '; ')"
}

[ordered]@{
  status = "ok"
  decision = $decision
  systemReviewPath = $systemReviewPath
  feedbackPath = $feedbackPath
  summaryPath = $summaryPath
  feedbackCopiedToClipboard = $summary.feedbackCopiedToClipboard
  boundaryViolationCount = $boundaryViolations.Count
  verificationGapCount = $verificationGaps.Count
} | ConvertTo-Json -Depth 10
