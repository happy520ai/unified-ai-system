[CmdletBinding()]
param(
  [string]$PromptPath = ".codex-handoff/outbox/latest-codex-handoff.md",
  [string]$OutputDir = ".codex-handoff/inbox",
  [string]$RunsDir = ".codex-handoff/runs",
  [object]$EnableCodexExec = $false,
  [object]$DryRun = $true,
  [object]$IExplicitlyApproveCodexExec = $false,
  [object]$RequireCleanGit = $true,
  [object]$NoCommit = $true,
  [object]$NoPush = $true,
  [string]$CodexCommandPath = ""
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

function Resolve-CodexCommand {
  param([string]$ExplicitPath = "")

  if (-not [string]::IsNullOrWhiteSpace($ExplicitPath)) {
    $resolvedExplicitPath = Resolve-RepoPath $ExplicitPath
    if (Test-Path $resolvedExplicitPath) { return $resolvedExplicitPath }
    return $ExplicitPath
  }

  $codexExe = Get-Command codex.exe -ErrorAction SilentlyContinue
  if ($null -ne $codexExe) { return $codexExe.Source }
  $codex = Get-Command codex -ErrorAction SilentlyContinue
  if ($null -ne $codex) { return $codex.Source }

  $whereCodexExe = (& cmd /c where codex.exe 2>$null | Select-Object -First 1 | Out-String).Trim()
  if (-not [string]::IsNullOrWhiteSpace($whereCodexExe)) { return $whereCodexExe }
  $whereCodex = (& cmd /c where codex 2>$null | Where-Object { $_ -like "*.exe" } | Select-Object -First 1 | Out-String).Trim()
  if (-not [string]::IsNullOrWhiteSpace($whereCodex)) { return $whereCodex }

  return ""
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
    "Codex exec one-shot completed and stdout was captured. Review stdout for details.",
    "",
    "## Changed Files",
    "- Review git status manually; this bridge does not commit or push.",
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

function Copy-OrderedMap {
  param($Source)
  $copy = [ordered]@{}
  foreach ($key in $Source.Keys) {
    $copy[$key] = $Source[$key]
  }
  return $copy
}

$EnableCodexExec = Convert-ToBool $EnableCodexExec
$DryRun = Convert-ToBool $DryRun
$IExplicitlyApproveCodexExec = Convert-ToBool $IExplicitlyApproveCodexExec
$RequireCleanGit = Convert-ToBool $RequireCleanGit
$NoCommit = Convert-ToBool $NoCommit
$NoPush = Convert-ToBool $NoPush

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$resolvedPromptPath = Resolve-RepoPath $PromptPath
$resolvedOutputDir = Resolve-RepoPath $OutputDir
$resolvedRunsDir = Resolve-RepoPath $RunsDir
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $resolvedRunsDir | Out-Null

$stdoutPath = Join-Path $resolvedRunsDir "codex-stdout.txt"
$stderrPath = Join-Path $resolvedRunsDir "codex-stderr.txt"
$dryRunSummaryPath = Join-Path $resolvedRunsDir "send-to-codex-dry-run-summary.json"
$runSummaryPath = Join-Path $resolvedRunsDir "send-to-codex-run-summary.json"
$resultPath = Join-Path $resolvedOutputDir "latest-codex-result.md"
$generatedAt = (Get-Date).ToUniversalTime().ToString("o")

$promptExists = Test-Path $resolvedPromptPath
$promptText = ""
if ($promptExists) {
  $promptText = Get-Content -Path $resolvedPromptPath -Raw
}
$codexCommandPath = Resolve-CodexCommand -ExplicitPath $CodexCommandPath
$codexCommandFound = -not [string]::IsNullOrWhiteSpace($codexCommandPath)
$gitStatus = (& git -c "safe.directory=$repoRoot" status --short 2>&1 | Out-String).Trim()
$gitWorkspaceClean = [string]::IsNullOrWhiteSpace($gitStatus)
$noPlaintextSecretsInPrompt = -not (Test-PlainSecret $promptText)
$explicitlyEnabled = ($EnableCodexExec -and -not $DryRun -and $IExplicitlyApproveCodexExec)
$plannedCommand = "codex exec < $resolvedPromptPath"

$summaryBase = [ordered]@{
  phase = "phase-234a-codex-exec-auto-send-bridge"
  generatedAt = $generatedAt
  promptPath = $resolvedPromptPath
  outputDir = $resolvedOutputDir
  runsDir = $resolvedRunsDir
  enableCodexExec = $EnableCodexExec
  dryRun = $DryRun
  explicitlyApproved = $IExplicitlyApproveCodexExec
  explicitlyEnabled = $explicitlyEnabled
  promptExists = $promptExists
  codexCommandFound = $codexCommandFound
  codexCommandPath = $codexCommandPath
  requireCleanGit = $RequireCleanGit
  gitWorkspaceClean = $gitWorkspaceClean
  noCommit = $NoCommit
  noPush = $NoPush
  noPlaintextSecretsInPrompt = $noPlaintextSecretsInPrompt
  plannedCommand = $plannedCommand
  outputFiles = [ordered]@{
    stdout = $stdoutPath
    stderr = $stderrPath
    inboxResult = $resultPath
    dryRunSummary = $dryRunSummaryPath
    runSummary = $runSummaryPath
  }
  safety = [ordered]@{
    codexExecInvoked = $false
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
}

if (-not $explicitlyEnabled) {
  $summary = Copy-OrderedMap $summaryBase
  $summary.status = "dry-run-complete"
  $summary.note = "Dry-run only. Codex CLI was not invoked."
  Write-Utf8NoBom -Path $dryRunSummaryPath -Content ($summary | ConvertTo-Json -Depth 30)
  [ordered]@{
    status = "dry-run-complete"
    codexExecInvoked = $false
    promptExists = $promptExists
    codexCommandFound = $codexCommandFound
    plannedCommand = $plannedCommand
    dryRunSummaryPath = $dryRunSummaryPath
  } | ConvertTo-Json -Depth 10
  exit 0
}

if (-not $promptExists) {
  throw "PromptPath does not exist: $resolvedPromptPath"
}
if (-not $codexCommandFound) {
  throw "codex command was not found."
}
if ($RequireCleanGit -and -not $gitWorkspaceClean) {
  throw "Real codex exec is blocked because git workspace is not clean."
}
if (-not $NoCommit -or -not $NoPush) {
  throw "Real codex exec is blocked because NoCommit and NoPush must remain true."
}
if (-not $noPlaintextSecretsInPrompt) {
  throw "Real codex exec is blocked because the prompt appears to contain a plaintext secret."
}

Write-Utf8NoBom -Path $stdoutPath -Content ""
Write-Utf8NoBom -Path $stderrPath -Content ""

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $codexCommandPath
$psi.Arguments = "exec"
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$process = New-Object System.Diagnostics.Process
$process.StartInfo = $psi

[void]$process.Start()
$process.StandardInput.Write($promptText)
$process.StandardInput.Close()
$stdout = $process.StandardOutput.ReadToEnd()
$stderr = $process.StandardError.ReadToEnd()
$process.WaitForExit()

Write-Utf8NoBom -Path $stdoutPath -Content $stdout
Write-Utf8NoBom -Path $stderrPath -Content $stderr

if ($process.ExitCode -ne 0) {
  $summary = Copy-OrderedMap $summaryBase
  $summary.status = "codex-exec-failed"
  $summary.exitCode = $process.ExitCode
  $summary.safety.codexExecInvoked = $true
  Write-Utf8NoBom -Path $runSummaryPath -Content ($summary | ConvertTo-Json -Depth 30)
  throw "codex exec failed with exit code $($process.ExitCode)."
}

Write-CodexResultFromStdout -StdoutText $stdout -OutputPath $resultPath
Push-Location $repoRoot
try {
  cmd /c pnpm run codex:result:import | Out-Null
} finally {
  Pop-Location
}

$summary = Copy-OrderedMap $summaryBase
$summary.status = "complete"
$summary.safety.codexExecInvoked = $true
$summary.resultImportInvoked = $true
Write-Utf8NoBom -Path $runSummaryPath -Content ($summary | ConvertTo-Json -Depth 30)

[ordered]@{
  status = "complete"
  codexExecInvoked = $true
  stdoutPath = $stdoutPath
  stderrPath = $stderrPath
  resultPath = $resultPath
  runSummaryPath = $runSummaryPath
  noCommit = $NoCommit
  noPush = $NoPush
} | ConvertTo-Json -Depth 10
