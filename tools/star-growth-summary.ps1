param([string]$OutputFile = "docs/star-growth-summary.md")

$ErrorActionPreference = "Stop"
$originalOutputEncoding = [Console]::OutputEncoding
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

function Resolve-NodeExists {
  return [bool](Get-Command node -ErrorAction SilentlyContinue)
}
function Get-MergeStateLabel {
  param([string]$MergeableState)

  switch ($MergeableState) {
    "clean" { "CLEAN" }
    "dirty" { "DIRTY" }
    "unknown" { "UNKNOWN" }
    "unstable" { "UNSTABLE" }
    "behind" { "BEHIND" }
    "blocked" { "BLOCKED" }
    default { "UNKNOWN" }
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
  if (Resolve-NodeExists) {
    if (Test-Path "tools/star-growth-check.mjs") {
      node ./tools/star-growth-check.mjs summary --output $OutputFile
      Write-Output "Growth summary generated via node: $OutputFile"
      return
    }
    throw "Growth Node script not found: tools/star-growth-check.mjs"
  }

  gh --version | Out-Null

  $repo = "happy520ai/unified-ai-system"
  $repoStats = Invoke-GhJson "api repos/$repo"
  $today = (Get-Date).ToString("yyyy-MM-dd")
  $issueCounts = Get-RepoIssueCounts -Repo $repo
  $openIssues = if ($null -ne $issueCounts.OpenIssues) { $issueCounts.OpenIssues } else { $repoStats.open_issues_count }
  $openPrs = $issueCounts.OpenPullRequests

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
    "up-for-grabs/up-for-grabs.net#5995"
  )

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

  $clean = ($rows | Where-Object { $_.MergeState -eq "CLEAN" }).Count
  $blocked = ($rows | Where-Object { $_.MergeState -eq "BLOCKED" }).Count
  $dirty = ($rows | Where-Object { $_.MergeState -eq "DIRTY" }).Count
  $unknown = ($rows | Where-Object { $_.MergeState -eq "UNKNOWN" }).Count

  $lines = [System.Collections.Generic.List[string]]::new()
  [void]$lines.Add("# Weekly Growth Summary ($today)")
  [void]$lines.Add("")
  [void]$lines.Add("## Repo Metrics")
  [void]$lines.Add("")
  [void]$lines.Add("- Stars: $($repoStats.stargazers_count)")
  [void]$lines.Add("- Forks: $($repoStats.forks_count)")
  [void]$lines.Add("- Watchers: $($repoStats.subscribers_count)")
  [void]$lines.Add("- Open issues (non-PR): $openIssues")
  if ($null -ne $openPrs) {
    [void]$lines.Add("- Open pull requests: $openPrs")
  }
  [void]$lines.Add("")
  [void]$lines.Add("## PR Funnel Signals")
  [void]$lines.Add("- CLEAN: $clean")
  [void]$lines.Add("- BLOCKED: $blocked")
  [void]$lines.Add("- DIRTY: $dirty")
  [void]$lines.Add("- UNKNOWN: $unknown")
  [void]$lines.Add("- Total tracked PRs: $($rows.Count)")
  [void]$lines.Add("")
  [void]$lines.Add("## Suggested community post")
  [void]$lines.Add("")
  [void]$lines.Add("### English")
  [void]$lines.Add("Current status: $($repoStats.stargazers_count) stars, $($repoStats.forks_count) forks, $($repoStats.subscribers_count) watchers.")
  [void]$lines.Add("I refreshed the growth snapshot and published one reproducible command:")
  [void]$lines.Add("")
  [void]$lines.Add('```text')
  [void]$lines.Add('docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.2 pnpm gateway demo')
  [void]$lines.Add("")
  [void]$lines.Add('Repo: https://github.com/happy520ai/unified-ai-system')
  [void]$lines.Add('```')

  $text = $lines -join [Environment]::NewLine
  Set-Content -Path $OutputFile -Value $text -Encoding utf8 -NoNewline
  Write-Output $text
}
catch {
  throw "GitHub CLI (gh) is required for growth summary commands."
}
finally {
  [Console]::OutputEncoding = $originalOutputEncoding
}
