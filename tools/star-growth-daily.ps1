param([string]$OutputFile = "docs/star-growth-daily.md")

$ErrorActionPreference = "Stop"
$originalOutputEncoding = [Console]::OutputEncoding
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

function Resolve-NodeExists {
  return [bool](Get-Command node -ErrorAction SilentlyContinue)
}
function Invoke-GhJson {
  param([string]$Command)
  $json = gh $Command.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)
  return $json | ConvertFrom-Json
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

try {
  if (Resolve-NodeExists) {
    if (Test-Path "tools/star-growth-check.mjs") {
      node ./tools/star-growth-check.mjs daily --output $OutputFile
      Write-Output "Growth daily draft generated via node: $OutputFile"
      return
    }
    throw "Growth Node script not found: tools/star-growth-check.mjs"
  }

  gh --version | Out-Null

  $repo = "happy520ai/unified-ai-system"
  $repoStats = Invoke-GhJson "api repos/$repo"
  $today = Get-Date -Format "yyyy-MM-dd"
  $updated = $repoStats.updated_at.Substring(0, 10)
  $issueCounts = Get-RepoIssueCounts -Repo $repo
  $openIssues = if ($null -ne $issueCounts.OpenIssues) { $issueCounts.OpenIssues } else { $repoStats.open_issues_count }
  $openPrs = $issueCounts.OpenPullRequests

  $englishPost = @(
    "Today ($today):",
    "",
    "I verified Unified AI System in 60 seconds:",
    "",
    "docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.3 pnpm gateway demo",
    "",
    "No API key is needed for verification.",
    "",
    "Repo: https://github.com/happy520ai/unified-ai-system"
  )

  $chinesePost = @(
    "今天（$today）我在 60 秒内完成了 Unified AI System 的本地验证：",
    "",
    "docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.3 pnpm gateway demo",
    "",
    "默认本地 fake-provider，不需要 API Key，命令可复现。",
    "",
    "仓库：https://github.com/happy520ai/unified-ai-system",
    "",
    "如果你也愿意试一下，请跑下命令并贴出输出，我会继续同步优化下一版文档。"
  )

  $lines = [System.Collections.Generic.List[string]]::new()
  [void]$lines.Add("# Daily Growth Pack ($today)")
  [void]$lines.Add("")
  [void]$lines.Add("## Public metrics snapshot")
  [void]$lines.Add("")
  [void]$lines.Add("- Stars: $($repoStats.stargazers_count)")
  [void]$lines.Add("- Forks: $($repoStats.forks_count)")
  [void]$lines.Add("- Subscribers: $($repoStats.subscribers_count)")
  [void]$lines.Add("- Open issues (non-PR): $openIssues")
  if ($null -ne $openPrs) {
    [void]$lines.Add("- Open pull requests: $openPrs")
  }
  [void]$lines.Add("- Updated: $updated")
  [void]$lines.Add("")
  [void]$lines.Add("## Post text to publish today")
  [void]$lines.Add("")
  [void]$lines.Add("### English")
  [void]$lines.Add("")
  $englishPost | ForEach-Object { [void]$lines.Add($_) }
  [void]$lines.Add("")
  [void]$lines.Add("### 中文")
  [void]$lines.Add("")
  $chinesePost | ForEach-Object { [void]$lines.Add($_) }
  [void]$lines.Add("")
  [void]$lines.Add("## 24h Action")
  [void]$lines.Add("")
  [void]$lines.Add("- Ask at least one reviewer to run the command and paste output.")
  [void]$lines.Add("- Reply to every technical comment in thread within 24h.")
  [void]$lines.Add("- Update [docs/star-growth-checklist.md](star-growth-checklist.md) after posting.")

  $notes = $lines -join [Environment]::NewLine

  Set-Content -Path $OutputFile -Value $notes -Encoding utf8 -NoNewline
  Write-Output $notes
}
catch {
  throw "GitHub CLI (gh) is required for growth snapshot commands."
}
finally {
  [Console]::OutputEncoding = $originalOutputEncoding
}
