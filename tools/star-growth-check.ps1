param([string]$OutputFile = "docs/star-growth-check.md")

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

    return @{
      OpenIssues = [int]$openIssues
      OpenPullRequests = [int]$openPullRequests
    }
  } catch {
    return @{
      OpenIssues = $null
      OpenPullRequests = $null
    }
  }
}

try {
  gh --version | Out-Null

  $repo = "happy520ai/unified-ai-system"
  $issueCounts = Get-RepoIssueCounts -Repo $repo
  $lines = [System.Collections.Generic.List[string]]::new()

  $externalPrs = @(
    "sickn33/agentic-awesome-skills#1073",
    "composio-community/awesome-codex-skills#206",
    "toolleeo/awesome-cli-apps-in-a-csv#347",
    "tensorchord/Awesome-LLMOps#710",
    "punkpeye/awesome-mcp-devtools#257",
    "WagnerAgent/awesome-mcp-servers-devops#65",
    "yzfly/Awesome-MCP-ZH#422",
    "punkpeye/awesome-mcp-servers#11745",
    "TensorBlock/awesome-mcp-servers#1616",
    "mahseema/awesome-ai-tools#1941",
    "docker/mcp-registry#4584",
    "up-for-grabs/up-for-grabs.net#5995",
    "frechdi/awesome-self-hosted-ai#7"
  )

  $repoStatsRaw = gh api "repos/$repo"
  $repoStats = $repoStatsRaw | ConvertFrom-Json

  $updatedAt = Get-DateString $repoStats.updated_at
  [void]$lines.Add(("# Star Growth Check ({0})" -f (Get-Date -Format "yyyy-MM-dd")))
  [void]$lines.Add("")
  [void]$lines.Add("## Repository")
  [void]$lines.Add(("- Stars: {0}" -f $repoStats.stargazers_count))
  [void]$lines.Add(("- Forks: {0}" -f $repoStats.forks_count))
  [void]$lines.Add(("- Subscribers: {0}" -f $repoStats.subscribers_count))
  $openIssues = if ($null -ne $issueCounts.OpenIssues) { $issueCounts.OpenIssues } else { $repoStats.open_issues_count }
  $openPrs = $issueCounts.OpenPullRequests
  [void]$lines.Add(("- Open issues (non-PR): {0}" -f $openIssues))
  if ($null -ne $openPrs) {
    [void]$lines.Add(("- Open pull requests: {0}" -f $openPrs))
  }
  [void]$lines.Add(("- Last updated: {0}" -f $updatedAt))
  [void]$lines.Add("")

  [void]$lines.Add("## External PR Funnel")
  [void]$lines.Add("| Target PR | State | Merge State | Updated | Comments |")
  [void]$lines.Add("| --- | --- | --- | --- | --- |")
  foreach ($target in $externalPrs) {
    $parts = $target -split "#"
    $prRepo = $parts[0]
    $prNumber = $parts[1]
    try {
      $prRaw = gh api "repos/$prRepo/pulls/$prNumber" | ConvertFrom-Json
      $mergeState = Get-MergeStateLabel -MergeableState $prRaw.mergeable_state
      $url = "https://github.com/$prRepo/pull/$prNumber"
      [void]$lines.Add(("| [{0}#{1}]({2}) | {3} | {4} | {5} | {6} |" -f $prRepo, $prNumber, $url, $prRaw.state, $mergeState, (Get-DateString $prRaw.updated_at), $prRaw.comments))
    }
    catch {
      $url = "https://github.com/$prRepo/pull/$prNumber"
      [void]$lines.Add(("| [{0}#{1}]({2}) | unknown | FETCH_FAILED ({3}) | N/A | N/A |" -f $prRepo, $prNumber, $url, $_.Exception.Message))
    }
  }

  $outputText = $lines -join [Environment]::NewLine
  Set-Content -Path $OutputFile -Value $outputText -Encoding utf8 -NoNewline
  Write-Output $outputText
}
catch {
  throw $_.Exception.Message
}
finally {
  [Console]::OutputEncoding = $previousOutputEncoding
}
