param(
  [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"
$previousOutputEncoding = [Console]::OutputEncoding
$OutputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = $OutputEncoding

function Get-MergeStateLabel {
  param([string]$MergeableState)

  switch ($MergeableState) {
    "clean" { "CLEAN" }
    "dirty" { "DIRTY" }
    "unknown" { "UNKNOWN" }
    "unstable" { "UNSTABLE" }
    "behind" { "BEHIND" }
    "blocked" { "BLOCKED" }
    default { "CLEAN" }
  }
}
function Load-PreviousMetrics {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return $null
  }

  $raw = Get-Content -Path $Path -Raw -Encoding utf8
  $metrics = @{
    Stars = $null
    Forks = $null
    Watchers = $null
    OpenIssues = $null
    OpenPullRequests = $null
  }

  $dashMatches = @{
    Stars = [regex]::Match($raw, '-\s*Stars:\s*(\d+)(?:\s*\([^)]*\))?')
    Forks = [regex]::Match($raw, '-\s*Forks:\s*(\d+)(?:\s*\([^)]*\))?')
    Watchers = [regex]::Match($raw, '-\s*Watchers:\s*(\d+)(?:\s*\([^)]*\))?')
    OpenIssues = [regex]::Match($raw, '-\s*Open issues \(non-PR\):\s*(\d+)(?:\s*\([^)]*\))?')
    OpenPullRequests = [regex]::Match($raw, '-\s*Open pull requests:\s*(\d+)(?:\s*\([^)]*\))?')
  }

  if ($dashMatches.Stars.Success) { $metrics.Stars = [int]$dashMatches.Stars.Groups[1].Value }
  if ($dashMatches.Forks.Success) { $metrics.Forks = [int]$dashMatches.Forks.Groups[1].Value }
  if ($dashMatches.Watchers.Success) { $metrics.Watchers = [int]$dashMatches.Watchers.Groups[1].Value }
  if ($dashMatches.OpenIssues.Success) { $metrics.OpenIssues = [int]$dashMatches.OpenIssues.Groups[1].Value }
  if ($dashMatches.OpenPullRequests.Success) { $metrics.OpenPullRequests = [int]$dashMatches.OpenPullRequests.Groups[1].Value }

  $tableMatches = @{
    Stars = [regex]::Match($raw, '\|\s*Stars\s*\|\s*(\d+)(?:\s*\([^)]*\))?\s*\|')
    Forks = [regex]::Match($raw, '\|\s*Forks\s*\|\s*(\d+)(?:\s*\([^)]*\))?\s*\|')
    Watchers = [regex]::Match($raw, '\|\s*Watchers\s*\|\s*(\d+)(?:\s*\([^)]*\))?\s*\|')
    OpenIssues = [regex]::Match($raw, '\|\s*Open issues \(non-PR\)\s*\|\s*(\d+)(?:\s*\([^)]*\))?\s*\|')
    OpenPullRequests = [regex]::Match($raw, '\|\s*Open pull requests\s*\|\s*(\d+)(?:\s*\([^)]*\))?\s*\|')
  }

  if ($null -eq $metrics.Stars -and $tableMatches.Stars.Success) { $metrics.Stars = [int]$tableMatches.Stars.Groups[1].Value }
  if ($null -eq $metrics.Forks -and $tableMatches.Forks.Success) { $metrics.Forks = [int]$tableMatches.Forks.Groups[1].Value }
  if ($null -eq $metrics.Watchers -and $tableMatches.Watchers.Success) { $metrics.Watchers = [int]$tableMatches.Watchers.Groups[1].Value }
  if ($null -eq $metrics.OpenIssues -and $tableMatches.OpenIssues.Success) { $metrics.OpenIssues = [int]$tableMatches.OpenIssues.Groups[1].Value }
  if ($null -eq $metrics.OpenPullRequests -and $tableMatches.OpenPullRequests.Success) { $metrics.OpenPullRequests = [int]$tableMatches.OpenPullRequests.Groups[1].Value }

  return $metrics
}

function Format-Delta {
  param(
    [int]$Current,
    [int]$Previous
  )

  if ($null -eq $Previous) {
    return ""
  }

  $delta = $Current - $Previous
  if ($delta -gt 0) { return " (+$delta)" }
  if ($delta -lt 0) { return " ($delta)" }
  return " (0)"
}

function Get-DateString {
  param([string]$Iso)
  [DateTime]$dt = [DateTime]::Parse($Iso)
  $dt.ToString("yyyy-MM-dd")
}

function Get-RepoIssueCounts {
  param([string]$Repo)
  try {
    $items = gh api "repos/$Repo/issues?state=open&per_page=100" | ConvertFrom-Json
    $openPullRequests = @($items | Where-Object { $_.pull_request }).Count
    $openIssues = $items.Count - $openPullRequests
    return @{ OpenIssues = $openIssues; OpenPullRequests = $openPullRequests }
  } catch {
    return @{ OpenIssues = $null; OpenPullRequests = $null }
  }
}

function Invoke-GhJson {
  param([string]$Command)
  return (gh $Command.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)) | ConvertFrom-Json
}

try {
  gh --version | Out-Null

  $repo = "happy520ai/unified-ai-system"
  $externalPrs = @(
    "sickn33/agentic-awesome-skills#1073",
    "composio-community/awesome-codex-skills#206",
    "toolleeo/awesome-cli-apps-in-a-csv#347",
    "tensorchord/Awesome-LLMOps#710",
    "punkpeye/awesome-mcp-devtools#257",
    "WagnerAgent/awesome-mcp-servers-devops#65",
    "yzfly/Awesome-MCP-ZH#422",
    "punkpeye/awesome-mcp-servers#11207",
    "docker/mcp-registry#4584",
    "up-for-grabs/up-for-grabs.net#5995"
  )

  $repoStats = Invoke-GhJson "api repos/$repo"
  $issueCounts = Get-RepoIssueCounts -Repo $repo
  $openIssues = if ($null -ne $issueCounts.OpenIssues) { $issueCounts.OpenIssues } else { $repoStats.open_issues_count }
  $openPrs = $issueCounts.OpenPullRequests
  $rows = @()
  foreach ($target in $externalPrs) {
    $parts = $target -split "#"
    $prRepo = $parts[0]
    $prNumber = $parts[1]
    try {
      $pr = Invoke-GhJson "api repos/$prRepo/pulls/$prNumber"
      $rows += [pscustomobject]@{
        Repo = $prRepo
        PR = $prNumber
        State = $pr.state
        MergeState = Get-MergeStateLabel $pr.mergeable_state
        Updated = Get-DateString $pr.updated_at
        Comments = $pr.comments
      }
    }
    catch {
      $rows += [pscustomobject]@{
        Repo = $prRepo
        PR = $prNumber
        State = "unknown"
        MergeState = "FETCH_FAILED"
        Updated = "N/A"
        Comments = "N/A"
      }
    }
  }

  $lastUpdated = Get-DateString $repoStats.updated_at
  $generatedAt = (Get-Date -Format "yyyy-MM-dd")

  $previous = Load-PreviousMetrics -Path $OutputFile

  $mdLines = @(
    "# Star Growth Check Report",
    "",
    "Generated: $generatedAt",
    "",
    "## Repository",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    "| Stars | $($repoStats.stargazers_count)$(Format-Delta -Current $repoStats.stargazers_count -Previous $previous.Stars) |",
    "| Forks | $($repoStats.forks_count)$(Format-Delta -Current $repoStats.forks_count -Previous $previous.Forks) |",
    "| Watchers | $($repoStats.subscribers_count)$(Format-Delta -Current $repoStats.subscribers_count -Previous $previous.Watchers) |",
    "| Open issues (non-PR) | $openIssues$(Format-Delta -Current $openIssues -Previous $previous.OpenIssues) |"
  )

  if ($null -ne $openPrs) {
    $mdLines += "| Open pull requests | $openPrs$(Format-Delta -Current $openPrs -Previous $previous.OpenPullRequests) |"
  }

  $mdLines += @(
    "| Last updated | $lastUpdated |",
    "",
    "## External PR Funnel",
    "",
    "| Repository | PR | State | Merge State | Updated | Comments |",
    "| --- | --- | --- | --- | --- | --- |"
  )

  $md = $mdLines -join [Environment]::NewLine

  foreach ($row in $rows) {
    $url = "https://github.com/$($row.Repo)/pull/$($row.PR)"
    $md += "`n| [$($row.Repo)]($url) | [#$($row.PR)]($url) | $($row.State) | $($row.MergeState) | $($row.Updated) | $($row.Comments) |"
  }

  if ($OutputFile) {
    $md | Set-Content -Path $OutputFile -Encoding utf8
  }

  Write-Output $md
}
catch {
  throw "GitHub CLI (gh) is required to gather growth metrics."
}
finally {
  [Console]::OutputEncoding = $previousOutputEncoding
}
