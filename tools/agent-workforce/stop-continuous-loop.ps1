[CmdletBinding()]
param(
  [string]$ControlDir = ".codex-handoff/control",
  [string]$Reason = "manual-stop"
)

$ErrorActionPreference = "Stop"

function Resolve-RepoPath {
  param([string]$PathValue)
  if ([System.IO.Path]::IsPathRooted($PathValue)) { return $PathValue }
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
  return (Join-Path $repoRoot $PathValue)
}

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

$resolvedControlDir = Resolve-RepoPath $ControlDir
New-Item -ItemType Directory -Force -Path $resolvedControlDir | Out-Null
$stopPath = Join-Path $resolvedControlDir "STOP"
$body = [ordered]@{
  status = "stop-requested"
  reason = $Reason
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
}
Write-Utf8NoBom -Path $stopPath -Content ($body | ConvertTo-Json -Depth 10)

[ordered]@{
  status = "stop-requested"
  stopFile = $stopPath
} | ConvertTo-Json -Depth 10
