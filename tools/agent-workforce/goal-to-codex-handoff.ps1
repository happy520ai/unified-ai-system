[CmdletBinding()]
param(
  [string]$Goal = "",
  [string]$GoalFile = "",
  [string]$Template = "feature-development",
  [string]$BaseUrl = "http://127.0.0.1:3100",
  [string]$OutputDir = ".codex-handoff",
  [object]$CopyToClipboard = $true,
  [object]$OpenUi = $false
)

$ErrorActionPreference = "Stop"

function Convert-ToBool {
  param($Value)
  if ($Value -is [bool]) { return $Value }
  $text = ([string]$Value).Trim().ToLowerInvariant()
  return @("1", "true", "yes", "y") -contains $text
}

$CopyToClipboard = Convert-ToBool $CopyToClipboard
$OpenUi = Convert-ToBool $OpenUi

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

function Invoke-Json {
  param(
    [string]$Uri,
    [string]$Method = "GET",
    $Body = $null
  )

  $params = @{
    UseBasicParsing = $true
    Uri = $Uri
    Method = $Method
    ErrorAction = "Stop"
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 50)
  }

  $response = Invoke-WebRequest @params
  if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
    throw "HTTP $($response.StatusCode) from $Uri"
  }
  return ($response.Content | ConvertFrom-Json)
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$normalizedBaseUrl = $BaseUrl.TrimEnd("/")
$resolvedOutputDir = Resolve-RepoPath $OutputDir
$outboxDir = Join-Path $resolvedOutputDir "outbox"
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $outboxDir | Out-Null

$goalText = $Goal
if ([string]::IsNullOrWhiteSpace($goalText) -and -not [string]::IsNullOrWhiteSpace($GoalFile)) {
  $goalPath = Resolve-RepoPath $GoalFile
  if (-not (Test-Path $goalPath)) {
    throw "Goal file not found: $goalPath"
  }
  $goalText = Get-Content -Path $goalPath -Raw
}
$goalText = [string]$goalText
$goalText = $goalText.Trim()
if ([string]::IsNullOrWhiteSpace($goalText)) {
  throw "Goal is required. Pass -Goal or -GoalFile."
}

$healthUrl = "$normalizedBaseUrl/health/check"
$health = Invoke-Json -Uri $healthUrl
if ($health.status -ne "ready" -and $health.data.status -ne "ready") {
  throw "Local service is not ready at $healthUrl"
}

$planEnvelope = Invoke-Json -Uri "$normalizedBaseUrl/workforce/plan" -Method "POST" -Body @{
  goal = $goalText
  selectedTemplate = $Template
  context = @{
    traceId = "phase226a-goal-to-handoff-automation"
  }
}

$plan = $planEnvelope.data
if ($null -eq $plan -or -not $plan.success) {
  throw "Agent Workforce plan generation failed."
}

$autoSaved = [bool]$plan.autoSaved
$planId = [string]$plan.planId
if ([string]::IsNullOrWhiteSpace($planId) -and $null -ne $plan.autoSave) {
  $planId = [string]$plan.autoSave.planId
}
if ([string]::IsNullOrWhiteSpace($planId)) {
  $saveEnvelope = Invoke-Json -Uri "$normalizedBaseUrl/workforce/plans/save" -Method "POST" -Body @{
    plan = $plan
    context = @{
      traceId = "phase226a-goal-to-handoff-fallback-save"
    }
  }
  $planId = [string]$saveEnvelope.data.planId
  $autoSaved = $false
}
if ([string]::IsNullOrWhiteSpace($planId)) {
  throw "Plan was generated but no saved plan ID was returned."
}

$copyToClipboardArg = if ($CopyToClipboard) { "1" } else { "0" }
$pullOutput = & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "pull-codex-handoff.ps1") `
  -BaseUrl $normalizedBaseUrl `
  -PlanId $planId `
  -Format markdown `
  -OutputDir $OutputDir `
  -CopyToClipboard $copyToClipboardArg
if ($LASTEXITCODE -ne 0) {
  throw "pull-codex-handoff.ps1 failed."
}

$generatedAt = (Get-Date).ToUniversalTime().ToString("o")
$summaryPath = Join-Path $resolvedOutputDir "latest-auto-handoff-summary.json"
$metadataPath = Join-Path $resolvedOutputDir "latest-metadata.json"
$markdownPath = Join-Path $resolvedOutputDir "latest-codex-handoff.md"
$jsonPath = Join-Path $resolvedOutputDir "latest-codex-handoff.json"
$outboxMarkdownPath = Join-Path $outboxDir "latest-codex-handoff.md"

$summary = [ordered]@{
  phase = "phase-226a-goal-to-handoff-automation"
  status = "ok"
  generatedAt = $generatedAt
  baseUrl = $normalizedBaseUrl
  healthUrl = $healthUrl
  goal = $goalText
  template = $Template
  autoSaved = $autoSaved
  planId = $planId
  pullOutput = ($pullOutput | Out-String).Trim()
  outputFiles = [ordered]@{
    markdown = $markdownPath
    json = $jsonPath
    metadata = $metadataPath
    outboxMarkdown = $outboxMarkdownPath
    summary = $summaryPath
  }
  clipboardCopied = $CopyToClipboard
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

if ($OpenUi) {
  Start-Process "$normalizedBaseUrl/ui" | Out-Null
}

[ordered]@{
  status = "ok"
  phase = "phase-226a-goal-to-handoff-automation"
  planId = $planId
  autoSaved = $autoSaved
  markdownPath = $markdownPath
  jsonPath = $jsonPath
  metadataPath = $metadataPath
  outboxMarkdownPath = $outboxMarkdownPath
  clipboardCopied = $CopyToClipboard
  codexExecInvoked = $false
} | ConvertTo-Json -Depth 10
