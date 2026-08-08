param(
  [string]$Repo = "happy520ai/unified-ai-system",
  [string]$LatestFile = "docs/star-growth-latest.md",
  [string]$FeedbackFile = "docs/star-growth-feedback.md",
  [string]$EvidencePackFile = "docs/star-growth-evidence-pack.md"
)

$ErrorActionPreference = "Stop"

function Get-IntFromText {
  param(
    [string]$Text,
    [string]$Metric
  )

  $dashPattern = "^-\\s*" + [regex]::Escape($Metric) + "\\s*:\\s*(\\d+)"
  $dashMatch = [regex]::Match($Text, $dashPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  if ($dashMatch.Success) {
    return [int]$dashMatch.Groups[1].Value
  }

  $tablePattern = "\\|\\s*" + [regex]::Escape($Metric) + "\\s*\\|\\s*(\\d+)\\s*\\|"
  $tableMatch = [regex]::Match($Text, $tablePattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  if ($tableMatch.Success) {
    return [int]$tableMatch.Groups[1].Value
  }

  return $null
}

function Get-FeedbackSummary {
  param([string]$Text)

  $total = 0
  $open = 0
  $closed = 0

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return @{ total = 0; open = 0; closed = 0 }
  }

  $totalMatch = [regex]::Match($Text, "-\\s*Total feedback reports:\\s*(\\d+)")
  if ($totalMatch.Success) { $total = [int]$totalMatch.Groups[1].Value }

  $openMatch = [regex]::Match($Text, "-\\s*Open:\\s*(\\d+)")
  if ($openMatch.Success) { $open = [int]$openMatch.Groups[1].Value }

  $closedMatch = [regex]::Match($Text, "-\\s*Closed:\\s*(\\d+)")
  if ($closedMatch.Success) { $closed = [int]$closedMatch.Groups[1].Value }

  return @{
    total = $total
    open = $open
    closed = $closed
  }
}

function Normalize-FeedbackSummary {
  param(
    [hashtable]$ParsedSummary,
    [hashtable]$FallbackSummary
  )

  if (($ParsedSummary.total -gt 0) -or ($ParsedSummary.open -gt 0) -or ($ParsedSummary.closed -gt 0)) {
    return $ParsedSummary
  }

  if ($FallbackSummary.total -gt 0 -or $FallbackSummary.open -gt 0 -or $FallbackSummary.closed -gt 0) {
    return $FallbackSummary
  }

  return $ParsedSummary
}

function Count-PrStates {
  param([string]$Raw)

  $result = @{ CLEAN = 0; BLOCKED = 0; DIRTY = 0; UNKNOWN = 0 }
  if ([string]::IsNullOrWhiteSpace($Raw)) {
    return $result
  }

  $lines = $Raw -split "`r?`n"
  foreach ($line in $lines) {
    if (-not $line.TrimStart().StartsWith("|")) { continue }
    $cells = $line -split "\|"
    if ($cells.Length -lt 6) { continue }

    $state = $cells[4].Trim().ToUpperInvariant()
    switch ($state) {
      "CLEAN" { $result.CLEAN += 1; break }
      "BLOCKED" { $result.BLOCKED += 1; break }
      "DIRTY" { $result.DIRTY += 1; break }
      "UNKNOWN" { $result.UNKNOWN += 1; break }
      default { }
    }
  }

  return $result
}

function Replace-Or-Append-WeeklyEntry {
  param(
    [string[]]$Lines,
    [hashtable]$Snapshot,
    [hashtable]$FeedbackSummary,
    [hashtable]$IssueSummary,
    [hashtable]$PrSummary,
    [string]$Today
  )

  $marker = "## Weekly Status Log"
  $markerIndex = [Array]::IndexOf($Lines, $marker)
  if ($markerIndex -lt 0) {
    $appendLines = @(
      ""
      "## Weekly Status Log"
      ""
      "### $Today"
      ""
      "- Repository: https://github.com/$Repo"
      "- Snapshot: $($Snapshot.Stars) stars / $($Snapshot.Forks) forks / $($Snapshot.Watchers) subscribers / $($Snapshot.OpenIssues) open issues (non-PR) / $($Snapshot.OpenPullRequests) open PRs"
      "- Community reports: $($FeedbackSummary.total) total, $($FeedbackSummary.open) open, $($FeedbackSummary.closed) closed"
      "- GitHub community-feedback label: $($IssueSummary.total) total / $($IssueSummary.open) open / $($IssueSummary.closed) closed"
      "- PR funnel state: CLEAN $($PrSummary.CLEAN), BLOCKED $($PrSummary.BLOCKED), DIRTY $($PrSummary.DIRTY), UNKNOWN $($PrSummary.UNKNOWN)"
      "- Next action: publish one short bilingual growth snippet and collect one response."
    )
    return @($Lines) + $appendLines
  }

  $todayHeader = "### $Today"
  $start = -1
  for ($i = $markerIndex + 1; $i -lt $Lines.Length; $i++) {
    if ($Lines[$i].Trim() -eq $todayHeader) {
      $start = $i
      break
    }
  }

  if ($start -ge 0) {
    $end = $start + 1
    while ($end -lt $Lines.Length -and -not ($Lines[$end].StartsWith("### "))) {
      $end++
    }

    $section = @(
      $todayHeader
      ""
      "- Repository: https://github.com/$Repo"
      "- Snapshot: $($Snapshot.Stars) stars / $($Snapshot.Forks) forks / $($Snapshot.Watchers) subscribers / $($Snapshot.OpenIssues) open issues (non-PR) / $($Snapshot.OpenPullRequests) open PRs"
      "- Community reports: $($FeedbackSummary.total) total, $($FeedbackSummary.open) open, $($FeedbackSummary.closed) closed"
      "- GitHub community-feedback label: $($IssueSummary.total) total / $($IssueSummary.open) open / $($IssueSummary.closed) closed"
      "- PR funnel state: CLEAN $($PrSummary.CLEAN), BLOCKED $($PrSummary.BLOCKED), DIRTY $($PrSummary.DIRTY), UNKNOWN $($PrSummary.UNKNOWN)"
      "- Next action: publish one short bilingual growth snippet and collect one response."
    )

    $updated = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $start; $i++) { $updated.Add($Lines[$i]) }
    foreach ($line in $section) { $updated.Add($line) }
    for ($i = $end; $i -lt $Lines.Length; $i++) { $updated.Add($Lines[$i]) }
    return $updated.ToArray()
  }

  $insert = @(
    ""
    $todayHeader
    ""
    "- Repository: https://github.com/$Repo"
    "- Snapshot: $($Snapshot.Stars) stars / $($Snapshot.Forks) forks / $($Snapshot.Watchers) subscribers / $($Snapshot.OpenIssues) open issues (non-PR) / $($Snapshot.OpenPullRequests) open PRs"
    "- Community reports: $($FeedbackSummary.total) total, $($FeedbackSummary.open) open, $($FeedbackSummary.closed) closed"
    "- GitHub community-feedback label: $($IssueSummary.total) total / $($IssueSummary.open) open / $($IssueSummary.closed) closed"
    "- PR funnel state: CLEAN $($PrSummary.CLEAN), BLOCKED $($PrSummary.BLOCKED), DIRTY $($PrSummary.DIRTY), UNKNOWN $($PrSummary.UNKNOWN)"
    "- Next action: publish one short bilingual growth snippet and collect one response."
  )

  $updated = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $Lines.Length; $i++) { $updated.Add($Lines[$i]) }
  foreach ($line in $insert) { $updated.Add($line) }
  return $updated.ToArray()
}

function Test-GhAvailable {
  gh --version | Out-Null
}

try {
  Test-GhAvailable

  $today = (Get-Date).ToString("yyyy-MM-dd")
  $repoStatsRaw = gh api "repos/$Repo" | ConvertFrom-Json

  $openItems = gh api "repos/$Repo/issues?state=open&per_page=100" | ConvertFrom-Json
  $openPullRequests = @($openItems | Where-Object { $_.pull_request }).Count
  $openIssues = @($openItems | Where-Object { -not $_.pull_request }).Count

  $issueSummaryRaw = gh issue list --repo $Repo --label community-feedback --state all --json number,state
  $issueSummaryItems = @($issueSummaryRaw | ConvertFrom-Json)
  $issueSummary = @{
    total = $issueSummaryItems.Count
    open = @($issueSummaryItems | Where-Object { $_.state.ToUpperInvariant() -eq "OPEN" }).Count
    closed = @($issueSummaryItems | Where-Object { $_.state.ToUpperInvariant() -eq "CLOSED" }).Count
  }

  if (Test-Path $LatestFile) { $latestRaw = Get-Content -Path $LatestFile -Raw -Encoding UTF8 } else { $latestRaw = "" }
  if (Test-Path $FeedbackFile) { $feedbackRaw = Get-Content -Path $FeedbackFile -Raw -Encoding UTF8 } else { $feedbackRaw = "" }

  $feedbackSummary = Normalize-FeedbackSummary -ParsedSummary (Get-FeedbackSummary -Text $feedbackRaw) -FallbackSummary $issueSummary
  $snapshot = @{
    Stars = if (Get-IntFromText -Text $latestRaw -Metric "Stars") { Get-IntFromText -Text $latestRaw -Metric "Stars" } else { [int]$repoStatsRaw.stargazers_count }
    Forks = if (Get-IntFromText -Text $latestRaw -Metric "Forks") { Get-IntFromText -Text $latestRaw -Metric "Forks" } else { [int]$repoStatsRaw.forks_count }
    Watchers = if (Get-IntFromText -Text $latestRaw -Metric "Subscribers") { Get-IntFromText -Text $latestRaw -Metric "Subscribers" } elseif (Get-IntFromText -Text $latestRaw -Metric "Watchers") { Get-IntFromText -Text $latestRaw -Metric "Watchers" } else { [int]$repoStatsRaw.subscribers_count }
    OpenIssues = if (Get-IntFromText -Text $latestRaw -Metric "Open issues (non-PR)") { Get-IntFromText -Text $latestRaw -Metric "Open issues (non-PR)" } else { $openIssues }
    OpenPullRequests = if (Get-IntFromText -Text $latestRaw -Metric "Open pull requests") { Get-IntFromText -Text $latestRaw -Metric "Open pull requests" } else { $openPullRequests }
  }

  $prSummary = Count-PrStates -Raw $latestRaw

  if (-not (Test-Path $EvidencePackFile)) {
    throw "Evidence pack not found: $EvidencePackFile"
  }

  $current = Get-Content -Path $EvidencePackFile -Raw -Encoding UTF8
  $lines = $current -split "`r?`n"

  # update snapshot lines
  for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "^- Stars:\s*\d") { $lines[$i] = "- Stars: $($snapshot.Stars)" }
    if ($lines[$i] -match "^- Forks:\s*\d") { $lines[$i] = "- Forks: $($snapshot.Forks)" }
    if ($lines[$i] -match "^- (?:Subscribers|Watchers):\s*\d") { $lines[$i] = "- Subscribers: $($snapshot.Watchers)" }
    if ($lines[$i] -match "^- Open issues \(non-PR\):\s*\d") { $lines[$i] = "- Open issues (non-PR): $($snapshot.OpenIssues)" }
    if ($lines[$i] -match "^- Open pull requests:\s*\d") { $lines[$i] = "- Open pull requests: $($snapshot.OpenPullRequests)" }
    if ($lines[$i] -match "^- Snapshot date:") { $lines[$i] = "- Snapshot date: $today" }
  }

  $lines = Replace-Or-Append-WeeklyEntry -Lines $lines -Snapshot $snapshot -FeedbackSummary $feedbackSummary -IssueSummary $issueSummary -PrSummary $prSummary -Today $today

  $final = ($lines -join "`n").TrimEnd() + "`n"
  Set-Content -Path $EvidencePackFile -Value $final -Encoding utf8

  Write-Host "Updated evidence pack: $EvidencePackFile"
  Write-Host "Date: $today"
  Write-Host "Snapshot: stars=$($snapshot.Stars), forks=$($snapshot.Forks), subscribers=$($snapshot.Watchers)"
}
catch {
  throw $_
}
