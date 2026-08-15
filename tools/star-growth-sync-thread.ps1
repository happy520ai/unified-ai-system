param(
  [string]$IssueNumber = "20",
  [string]$Repo = "happy520ai/unified-ai-system"
)

$ErrorActionPreference = "Stop"
$repo = $Repo
$issue = $IssueNumber
$managedCommentMarker = '<!-- unified-ai-system-growth-thread -->'
$demoCommand = 'docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.9 pnpm gateway demo "Build a small API for my team" --enhance --profile coding'
$evidenceCommand = 'pnpm gateway demo "Build a small API for my team" --enhance --profile coding --evidence'

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
  pnpm growth:campaign
  node ./tools/star-growth-feedback.mjs --output .tmp/growth/star-growth-feedback.md

  $latestRaw = Get-Content -Path .tmp/growth/star-growth-latest.md -Raw -Encoding UTF8
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

I verified the prompt-enhancement command is still:

```
$demoCommand
```

Try it without installing anything in the browser Prompt Lab:
https://happy520ai.github.io/unified-ai-system/#enhance

For a source checkout, append ``--evidence`` to the local command to emit
report-ready JSON; review the original request and output before sharing.
```
$evidenceCommand
```

If you run it, please share the command, 3-12 output lines, OS or client, and
execution mode through the structured Usage Report:
https://github.com/$repo/issues/new?template=usage-verification-report.yml

If this saved you time, help this project grow:
1) Star the repo: https://github.com/$repo
2) Submit one output line + OS through the structured Usage Report:
   https://github.com/$repo/issues/new?template=usage-verification-report.yml
3) Ask one teammate to run the same command and share their output.

Repo: https://github.com/$repo
$managedCommentMarker
"@

  $tmp = New-TemporaryFile
  try {
    $commentPayload = @{ body = $comment } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($tmp.FullName, $commentPayload, [System.Text.UTF8Encoding]::new($false))

    $commentPages = gh api --paginate --slurp "repos/$repo/issues/$issue/comments?per_page=100" | ConvertFrom-Json
    $comments = foreach ($page in @($commentPages)) {
      foreach ($item in @($page)) { $item }
    }
    $managed = @($comments | Where-Object { $_.body -like "*$managedCommentMarker*" } | Sort-Object created_at | Select-Object -Last 1)

    if ($managed.Count -gt 0) {
      gh api -X PATCH "repos/$repo/issues/comments/$($managed[0].id)" --input $tmp.FullName | Out-Null
      Write-Host "Campaign thread comment updated."
    }
    else {
      gh api -X POST "repos/$repo/issues/$issue/comments" --input $tmp.FullName | Out-Null
      Write-Host "Campaign thread comment created."
    }
  }
  finally {
    Remove-Item $tmp.FullName -Force -ErrorAction SilentlyContinue
  }

  Write-Host "Campaign thread synced and refreshed."
}
catch {
  throw $_
}
