param(
  [string]$OutputFile = ".tmp/growth/star-growth-feedback.md",
  [int]$Top = 10
)

$ErrorActionPreference = "Stop"
$previousOutputEncoding = [Console]::OutputEncoding
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$repo = "happy520ai/unified-ai-system"
$feedbackLabel = "community-feedback"
$today = (Get-Date -Format "yyyy-MM-dd")

function Invoke-GhJson {
  param([string]$Command)

  return (gh @($Command.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries))) | ConvertFrom-Json
}

function Extract-Section {
  param(
    [string]$Text,
    [string]$Heading
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }

  $pattern = "(?s)###\s*$([regex]::Escape($Heading))\s*\r?\n(.*?)(?=\r?\n###\s+|\r?\n\*\*\*|\r?\n##\s+|$)"
  $match = [regex]::Match($Text, $pattern)
  if (-not $match.Success) {
    return ""
  }

  return ($match.Groups[1].Value.Trim() -replace "\r?\n", " " -replace "\s+", " ").Trim()
}

function Escape-Markdown {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return ""
  }
  return $Value.Replace("|", "\|").Replace("`r`n", " ").Replace("`n", " ").Replace("`r", " ")
}

try {
  gh --version | Out-Null
  $issues = Invoke-GhJson "issue list --repo $repo --label $feedbackLabel --state all --json number,title,state,createdAt,body,author,url"
  $issues = @($issues | Where-Object { $_.number -gt 0 })

  $open = @($issues | Where-Object { $_.state -eq "open" }).Count
  $closed = @($issues | Where-Object { $_.state -eq "closed" }).Count
  $recent = @($issues | Sort-Object createdAt -Descending | Select-Object -First $Top)

  $lines = [System.Collections.Generic.List[string]]::new()
  [void]$lines.Add("# Usage Verification Feedback ($today)")
  [void]$lines.Add("")
  [void]$lines.Add("## Report Snapshot")
  [void]$lines.Add("- Total feedback reports: $($issues.Count)")
  [void]$lines.Add("- Open: $open")
  [void]$lines.Add("- Closed: $closed")

  if ($recent.Count -eq 0) {
    [void]$lines.Add("")
    [void]$lines.Add("No usage verification reports found yet.")
    [void]$lines.Add("Share this template link to collect public evidence:")
    [void]$lines.Add("- https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml")
  } else {
    [void]$lines.Add("")
    [void]$lines.Add("## Latest Verified Feedback")
    [void]$lines.Add("")
    [void]$lines.Add("| Date | Reporter | Mode | Command | Environment | Issue |")
    [void]$lines.Add("| --- | --- | --- | --- | --- | --- |")

    foreach ($item in $recent) {
      $command = Escape-Markdown -Value (Extract-Section -Text $item.body -Heading "Command run")
      $environment = Escape-Markdown -Value (Extract-Section -Text $item.body -Heading "Environment")
      $mode = Escape-Markdown -Value (Extract-Section -Text $item.body -Heading "Execution mode")
      $created = if ($item.createdAt) { $item.createdAt.Substring(0, 10) } else { "N/A" }

      $command = if ([string]::IsNullOrWhiteSpace($command)) { "command not provided" } else { $command }
      $environment = if ([string]::IsNullOrWhiteSpace($environment)) { "environment not provided" } else { $environment }

      [void]$lines.Add("| $created | @$($item.author.login) | $mode | $command | $environment | [#$($item.number)]($($item.url)) |")
    }
  }

  [void]$lines.Add("")
  [void]$lines.Add("Update frequency: run `node ./tools/star-growth-feedback.mjs` or `pnpm growth:campaign` after collecting community replies.")

  $text = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
  Set-Content -Path $OutputFile -Value $text -Encoding utf8
  Write-Output $text
}
catch {
  throw "GitHub CLI (gh) is required for feedback collection."
}
finally {
  [Console]::OutputEncoding = $previousOutputEncoding
}
