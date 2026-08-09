param(
  [string]$IssueNumber = "20",
  [string]$Repo = "happy520ai/unified-ai-system"
)

$ErrorActionPreference = "Stop"
$repo = $Repo
$issue = $IssueNumber
$demoCommand = "docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.3 pnpm gateway demo"

function Test-GhAvailable {
  gh --version | Out-Null
}

function Parse-Int {
  param([string]$Text, [string]$MetricName)

  $dashPattern = "^-\\s*$([regex]::Escape($MetricName))\\s*:\\s*(\\d+)"
  $match = [regex]::Match($Text, $dashPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  if ($match.Success) {
    return [int]$match.Groups[1].Value
  }

  $tablePattern = "\\|\\s*$([regex]::Escape($MetricName))\\s*\\|\\s*(\\d+)"
  $match = [regex]::Match($Text, $tablePattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  if ($match.Success) {
    return [int]$match.Groups[1].Value
  }

  return $null
}

function Get-DateFromSnapshot {
  param([string]$Text)
  $match = [regex]::Match($Text, "Generated:\\s*(\\d{4}-\\d{2}-\\d{2})")
  if ($match.Success) { return $match.Groups[1].Value }
  return (Get-Date).ToString("yyyy-MM-dd")
}

try {
  Test-GhAvailable

  Write-Host "Running campaign refresh..."
  pnpm growth:campaign:ps
  pnpm growth:feedback

  $latestRaw = Get-Content -Path docs/star-growth-latest.md -Raw -Encoding UTF8
  $metrics = [ordered]@{
    Date              = Get-DateFromSnapshot -Text $latestRaw
    Stars             = Parse-Int -Text $latestRaw -MetricName "Stars"
    Forks             = Parse-Int -Text $latestRaw -MetricName "Forks"
    Watchers          = Parse-Int -Text $latestRaw -MetricName "Subscribers"
    OpenIssues        = Parse-Int -Text $latestRaw -MetricName "Open issues (non-PR)"
    OpenPullRequests  = Parse-Int -Text $latestRaw -MetricName "Open pull requests"
  }

  if ($null -in @($metrics.Stars, $metrics.Forks, $metrics.Watchers, $metrics.OpenIssues, $metrics.OpenPullRequests)) {
    Write-Host "Fallback to live GitHub API metrics due to missing values..."
    $repoStatsRaw = gh api "repos/$repo" | ConvertFrom-Json
    $openItems = gh api "repos/$repo/issues?state=open&per_page=100" | ConvertFrom-Json
    $openPulls = @($openItems | Where-Object { $_.pull_request }).Count
    $openIssues = @($openItems | Where-Object { -not $_.pull_request }).Count

    $metrics.Stars = $repoStatsRaw.stargazers_count
    $metrics.Forks = $repoStatsRaw.forks_count
    $metrics.Watchers = $repoStatsRaw.subscribers_count
    $metrics.OpenIssues = $openIssues
    $metrics.OpenPullRequests = $openPulls
  }

  Write-Host ("Snapshot: stars={0}, forks={1}, subscribers={2}, openIssues={3}, openPRs={4}" -f $metrics.Stars, $metrics.Forks, $metrics.Watchers, $metrics.OpenIssues, $metrics.OpenPullRequests)

  $comment = @"
## Campaign Thread Refresh - $($metrics.Date)

Updated snapshot:
- Stars: $($metrics.Stars)
- Forks: $($metrics.Forks)
- Subscribers: $($metrics.Watchers)
- Open issues (non-PR): $($metrics.OpenIssues)
- Open pull requests: $($metrics.OpenPullRequests)

I verified the baseline command is still:

```
$demoCommand
```

If you run it, please share one output line + OS:
- please include whether you saw `execution: fake`
- OS / command output line

If this saved you time, help this project grow:
1) Star the repo: https://github.com/$repo
2) Submit one output line + OS through the structured Usage Report:
   https://github.com/$repo/issues/new?template=usage-verification-report.yml
3) Ask one teammate to run the same command and share their output.

Repo: https://github.com/$repo
<!-- unified-ai-system-growth-thread -->
"@

  $tmp = New-TemporaryFile
  [System.IO.File]::WriteAllText($tmp.FullName, $comment, [System.Text.UTF8Encoding]::new($false))
  gh issue comment $issue --repo $repo --body-file $tmp.FullName --edit-last --create-if-none
  Remove-Item $tmp.FullName -Force

  Write-Host "Campaign thread synced and refreshed."
}
catch {
  throw $_
}
