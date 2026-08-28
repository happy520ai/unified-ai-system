param(
    [string]$RepoUrl = "https://github.com/happy520ai/unified-ai-system",
    [string]$DemoCommand = 'docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.6.0 pnpm gateway demo "Build a small API for my team" --enhance --profile coding',
    [string]$IssueTemplate = "https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml",
    [string]$OutputFile = ".tmp/growth/star-growth-publish-output.md"
)

$date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
$previousOutputEncoding = [Console]::OutputEncoding
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
if ($Host.Name -eq "ConsoleHost") {
    chcp 65001 > $null
}
$posts = @{
    githubEn = @"
I verified Unified AI System in 60 seconds:

$DemoCommand

No API key is needed for the local prompt-enhancement preview.
Repo: $RepoUrl
"@
    githubZh = @"
我在 60 秒内验证了 Unified AI System：

$DemoCommand

默认使用本地 fake-provider，不需要 API Key。
仓库：$RepoUrl
"@
    telegramZh = @"
我在 60 秒内验证了 Unified AI System：

$DemoCommand

如果你愿意试一下，请分享一行输出并提交验证报告：
$IssueTemplate
"@
    twitterLike = @"
Built a terminal-first AI gateway with deterministic local verification:
- prompt enhancement with a local fake-provider
- explicit provider boundaries
- CLI + MCP + Codex / Cursor / Cline

Repo: $RepoUrl
$DemoCommand
"@
    redditEn = @"
Open-source AI infrastructure update:
- local fake-provider verification in 60 seconds
- prompt enhancement turns rough language into structured intent
- explicit approval & provider policy

Repo: $RepoUrl
$DemoCommand
"@
    starEn = @"
Use this once and spread the signal:
1) Star: $RepoUrl
2) Submit one output line + OS through the structured Usage Report:
   https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml
3) Ask one teammate to run the same command

$DemoCommand
"@
    starZh = @"
如果它对你有价值，请快速帮我扩散：
1) 点赞：https://github.com/happy520ai/unified-ai-system
2) 通过结构化 Usage Report 留下命令输出 + OS：
   https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml
3) 邀请一位同事一起跑一次

$DemoCommand
"@
    discordEn = @"
Want to try a verifiable AI gateway?
Try:
$DemoCommand

If it works, share one output line and open:
$IssueTemplate
"@
}

function New-PublishSnippets {
    param([hashtable]$PostMap)

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("# Star Growth Blast Kit ($date)")
    $lines.Add("")
    $lines.Add("## Core publish links")
    $lines.Add("- Repo: $RepoUrl")
    $lines.Add("- Verification issue template: $IssueTemplate")
    $lines.Add("")
    $lines.Add("## One-click text snippets")
    $lines.Add("")

    foreach ($item in $PostMap.GetEnumerator()) {
        $lines.Add("### $($item.Key)")
        $lines.Add('```text')
        $lines.Add($item.Value.TrimEnd())
        $lines.Add('```')
        $lines.Add("")
    }

    return $lines
}

Write-Output "# Star Growth Blast Kit ($date)"
Write-Output ""
Write-Output "## Core publish links"
Write-Output "- Repo: $RepoUrl"
Write-Output "- Verification issue template: $IssueTemplate"
Write-Output ""
Write-Output "## One-click text snippets"

try {
    foreach ($item in $posts.GetEnumerator()) {
        Write-Output "### $($item.Key)"
        Write-Output '```text'
        Write-Output $item.Value.TrimEnd()
        Write-Output '```'
        Write-Output ""
    }

    $outputLines = New-PublishSnippets -PostMap $posts
    Set-Content -Path $OutputFile -Value ($outputLines -join [Environment]::NewLine) -Encoding UTF8
    Write-Output "Saved to $OutputFile"
}
finally {
    [Console]::OutputEncoding = $previousOutputEncoding
}
