[CmdletBinding()]
param(
  [string]$BaseUrl = "http://127.0.0.1:3100",
  [string]$PlanId = "",
  [ValidateSet("markdown", "json")]
  [string]$Format = "markdown",
  [string]$OutputDir = ".codex-handoff",
  [object]$CopyToClipboard = $true,
  [object]$OpenFile = $false,
  [object]$OpenCodex = $false
)

$ErrorActionPreference = "Stop"

function Convert-ToBool {
  param($Value)
  if ($Value -is [bool]) { return $Value }
  $text = ([string]$Value).Trim().ToLowerInvariant()
  return @("1", "true", "yes", "y") -contains $text
}

$CopyToClipboard = Convert-ToBool $CopyToClipboard
$OpenFile = Convert-ToBool $OpenFile
$OpenCodex = Convert-ToBool $OpenCodex

function Write-Utf8NoBom {
  param(
    [string]$Path,
    [string]$Content
  )

  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Resolve-OutputDirectory {
  param([string]$PathValue)

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }

  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
  return (Join-Path $repoRoot $PathValue)
}

function Invoke-HandoffJson {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method Get -ErrorAction Stop
  } catch {
    throw "Failed to call $Url. Ensure the local service is running and reachable. $($_.Exception.Message)"
  }

  if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
    throw "HTTP $($response.StatusCode) from $Url"
  }

  try {
    return ($response.Content | ConvertFrom-Json)
  } catch {
    throw "Response from $Url was not valid JSON."
  }
}

function To-StringArray {
  param($Value)

  if ($null -eq $Value) {
    return @()
  }

  if ($Value -is [System.Array]) {
    return @($Value | ForEach-Object { [string]$_ })
  }

  return @([string]$Value)
}

function Add-ListSection {
  param(
    [System.Collections.Generic.List[string]]$Lines,
    [string]$Title,
    $Items
  )

  $Lines.Add("")
  $Lines.Add("## $Title")
  $listItems = To-StringArray $Items
  if ($listItems.Count -eq 0) {
    $Lines.Add("- n/a")
    return
  }

  foreach ($item in $listItems) {
    $Lines.Add("- $item")
  }
}

function Convert-HandoffPackToMarkdown {
  param(
    $Pack,
    $Metadata
  )

  $lines = [System.Collections.Generic.List[string]]::new()
  $lines.Add("# Codex Desktop Handoff Pack")
  $lines.Add("")
  $lines.Add("- Phase: phase-205a-desktop-handoff-pull-script")
  $lines.Add("- Source plan ID: $($Metadata.planId)")
  $lines.Add("- Source URL: $($Metadata.exportMarkdownUrl)")
  $lines.Add("- Generated at: $($Metadata.generatedAt)")
  $lines.Add("- Manual copy/paste only: $($Pack.manualOnly)")
  $lines.Add("- Codex execution enabled in web system: $($Pack.codexExecutionEnabled)")
  $lines.Add("- Auto dispatch enabled: $($Pack.autoDispatchEnabled)")
  $lines.Add("- Target: $($Pack.target)")
  $lines.Add("- Copy/paste required: $($Pack.copyPasteRequired)")
  $lines.Add("")
  $lines.Add("## Task Goal")
  $lines.Add([string]$Pack.taskGoal)

  Add-ListSection -Lines $lines -Title "Context Summary" -Items $Pack.contextSummary
  Add-ListSection -Lines $lines -Title "Allowed Files" -Items $Pack.allowedFiles
  Add-ListSection -Lines $lines -Title "Recommended Files" -Items $Pack.recommendedFiles
  Add-ListSection -Lines $lines -Title "Forbidden Actions" -Items $Pack.forbiddenActions
  Add-ListSection -Lines $lines -Title "Implementation Constraints" -Items $Pack.implementationConstraints
  Add-ListSection -Lines $lines -Title "Verification Commands" -Items $Pack.verificationCommands
  Add-ListSection -Lines $lines -Title "Evidence Expectations" -Items $Pack.evidenceExpectations
  Add-ListSection -Lines $lines -Title "Response Format" -Items $Pack.responseFormat
  Add-ListSection -Lines $lines -Title "Blocked Reasons" -Items $Pack.blockedReasons

  $lines.Add("")
  $lines.Add("## Safety Boundary")
  $lines.Add("- No automatic Codex CLI execution.")
  $lines.Add("- No automatic patch apply, merge, commit, or push.")
  $lines.Add("- No worktree creation.")
  $lines.Add("- No workflow run hookup.")
  $lines.Add("- No real external runner dispatch.")
  $lines.Add("- No default NVIDIA /chat lane change.")
  $lines.Add("- approval-preview is not execution approval.")

  return ($lines -join [Environment]::NewLine)
}

$normalizedBaseUrl = $BaseUrl.TrimEnd("/")
$outputPath = Resolve-OutputDirectory $OutputDir
$outboxPath = Join-Path $outputPath "outbox"
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
New-Item -ItemType Directory -Force -Path $outboxPath | Out-Null

$plansUrl = "$normalizedBaseUrl/workforce/plans"
$plansEnvelope = Invoke-HandoffJson $plansUrl
$plans = @($plansEnvelope.data.plans)
if ($plans.Count -eq 0) {
  throw "No saved Agent Workforce plan found. Open $normalizedBaseUrl/ui, generate a plan, and click Save Plan first."
}

$selectedPlanId = $PlanId
if ([string]::IsNullOrWhiteSpace($selectedPlanId)) {
  $selectedPlanId = [string]$plans[0].planId
}

if ([string]::IsNullOrWhiteSpace($selectedPlanId)) {
  throw "Could not determine a saved plan ID from /workforce/plans."
}

$encodedPlanId = [System.Uri]::EscapeDataString($selectedPlanId)
$exportMarkdownUrl = "$normalizedBaseUrl/workforce/plans/$encodedPlanId/export?format=markdown"
$exportJsonUrl = "$normalizedBaseUrl/workforce/plans/$encodedPlanId/export?format=json"

$markdownEnvelope = Invoke-HandoffJson $exportMarkdownUrl
$jsonEnvelope = Invoke-HandoffJson $exportJsonUrl

$taskPackage = $jsonEnvelope.data.json
if ($null -eq $taskPackage) {
  $taskPackage = $jsonEnvelope.data.taskPackage
}
if ($null -eq $taskPackage) {
  throw "Export response did not contain data.json or data.taskPackage."
}

$handoffPack = $taskPackage.codexDesktopHandoffPack
if ($null -eq $handoffPack -and $null -ne $taskPackage.exportableJson) {
  $handoffPack = $taskPackage.exportableJson.codexDesktopHandoffPack
}
if ($null -eq $handoffPack) {
  throw "Codex Desktop Handoff Pack was not present in the export. Restart the local service on the current code, then generate and save a new Agent Workforce plan."
}

$generatedAt = (Get-Date).ToUniversalTime().ToString("o")
$markdownPath = Join-Path $outputPath "latest-codex-handoff.md"
$jsonPath = Join-Path $outputPath "latest-codex-handoff.json"
$metadataPath = Join-Path $outputPath "latest-metadata.json"
$outboxMarkdownPath = Join-Path $outboxPath "latest-codex-handoff.md"
$outboxFeedbackPath = Join-Path $outboxPath "feedback-to-codex.md"

$metadata = [ordered]@{
  phase = "phase-205a-desktop-handoff-pull-script"
  status = "pulled"
  generatedAt = $generatedAt
  baseUrl = $normalizedBaseUrl
  planId = $selectedPlanId
  requestedFormat = $Format
  plansUrl = $plansUrl
  exportMarkdownUrl = $exportMarkdownUrl
  exportJsonUrl = $exportJsonUrl
  outputFiles = [ordered]@{
    markdown = $markdownPath
    json = $jsonPath
    metadata = $metadataPath
    outboxMarkdown = $outboxMarkdownPath
    outboxFeedback = $outboxFeedbackPath
  }
  copyToClipboardRequested = $CopyToClipboard
  clipboardCopied = $false
  openFileRequested = $OpenFile
  openCodexRequested = $OpenCodex
  codexCommandFound = $false
  safety = [ordered]@{
    codexCliAutoExecution = $false
    automaticPromptDispatch = $false
    realAgentExecution = $false
    worktreeCreated = $false
    workflowRun = $false
    realExternalRunnerDispatch = $false
    autoApply = $false
    autoMerge = $false
    autoCommit = $false
    autoPush = $false
    defaultNvidiaChatLaneChanged = $false
    plaintextApiKeyWritten = $false
  }
}

$handoffMarkdown = Convert-HandoffPackToMarkdown -Pack $handoffPack -Metadata $metadata
$handoffJson = [ordered]@{
  phase = "phase-205a-desktop-handoff-pull-script"
  generatedAt = $generatedAt
  planId = $selectedPlanId
  source = [ordered]@{
    plansUrl = $plansUrl
    exportMarkdownUrl = $exportMarkdownUrl
    exportJsonUrl = $exportJsonUrl
  }
  taskPackageSummary = [ordered]@{
    workforceId = $taskPackage.workforceId
    goal = $taskPackage.goal
    planVersion = $taskPackage.planVersion
    savedAt = $taskPackage.savedAt
  }
  codexDesktopHandoffPack = $handoffPack
  safety = $metadata.safety
}

Write-Utf8NoBom -Path $markdownPath -Content $handoffMarkdown
Write-Utf8NoBom -Path $jsonPath -Content ($handoffJson | ConvertTo-Json -Depth 100)
Write-Utf8NoBom -Path $outboxMarkdownPath -Content $handoffMarkdown
if (-not (Test-Path $outboxFeedbackPath)) {
  Write-Utf8NoBom -Path $outboxFeedbackPath -Content "# Feedback to Codex`r`n`r`nNo feedback has been generated yet."
}

if ($CopyToClipboard) {
  try {
    Set-Clipboard -Value $handoffMarkdown
    $metadata.clipboardCopied = $true
  } catch {
    try {
      $handoffMarkdown | clip.exe
      $metadata.clipboardCopied = $true
      $metadata.clipboardFallback = "clip.exe"
    } catch {
      throw "Failed to copy handoff markdown to the Windows clipboard. $($_.Exception.Message)"
    }
  }
}

if ($OpenFile) {
  Start-Process -FilePath $markdownPath | Out-Null
}

if ($OpenCodex) {
  $codexCommand = Get-Command codex -ErrorAction SilentlyContinue
  if ($null -eq $codexCommand) {
    Write-Warning "Codex command was not found. Open Codex Desktop manually, then paste the clipboard content."
  } else {
    $metadata.codexCommandFound = $true
    Write-Host "Codex command found. Opening Codex without prompt/task arguments; no execution is requested."
    Start-Process -FilePath $codexCommand.Source | Out-Null
  }
}

Write-Utf8NoBom -Path $metadataPath -Content ($metadata | ConvertTo-Json -Depth 20)

[ordered]@{
  status = "ok"
  planId = $selectedPlanId
  markdownPath = $markdownPath
  jsonPath = $jsonPath
  metadataPath = $metadataPath
  clipboardCopied = $metadata.clipboardCopied
  openCodexRequested = $OpenCodex
  codexCommandFound = $metadata.codexCommandFound
  note = "Handoff was written and copied only; no Codex task execution was requested."
} | ConvertTo-Json -Depth 10
