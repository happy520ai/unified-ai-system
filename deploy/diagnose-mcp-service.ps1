# diagnose-mcp-service.ps1 - one-shot diagnostic for the MCP service daemon

[CmdletBinding()]
param(
  [string]$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path,
  [string]$LogFile
)

$ErrorActionPreference = 'Continue'
$LogDir = Join-Path $RepoRoot 'logs'
if (-not $LogFile) {
  $LogFile = Join-Path $LogDir 'mcp-service.log'
}
$TaskName = 'UnifiedAiSystemMcpService'

Write-Host '== 1. Task info =='
$info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
if ($info) {
  $info | Format-List LastRunTime, LastTaskResult, NumberOfMissedRuns, NextRunTime
} else {
  Write-Host "task not registered"
}

Write-Host ''
Write-Host '== 2. All Node processes =='
$procs = Get-Process -Name node -ErrorAction SilentlyContinue
if ($procs) {
  $procs | Sort-Object StartTime | Format-Table Id, StartTime, Path -AutoSize
} else {
  Write-Host "no node processes"
}

Write-Host ''
Write-Host '== 3. Who is binding port 7788? =='
$listeners = Get-NetTCPConnection -LocalPort 7788 -LocalAddress 127.0.0.1 -State Listen -ErrorAction SilentlyContinue
if ($listeners) {
  $listeners | ForEach-Object {
    $owningPid = $_.OwningProcess
    $path = (Get-Process -Id $owningPid -ErrorAction SilentlyContinue).Path
    Write-Host "  pid=$owningPid path=$path"
  }
} else {
  Write-Host "  nobody listening on 127.0.0.1:7788"
}

Write-Host ''
Write-Host '== 4. Log freshness =='
if (Test-Path -LiteralPath $LogFile) {
  $fi = Get-Item -LiteralPath $LogFile
  Write-Host "  LastWriteTime: $($fi.LastWriteTime)  Size: $($fi.Length)"
  $age = (Get-Date) - $fi.LastWriteTime
  Write-Host "  Age: $($age.TotalSeconds.ToString('0.0'))s"
  $lastLines = Get-Content -LiteralPath $LogFile -Tail 5 -ErrorAction SilentlyContinue
  if ($lastLines) { Write-Host "  ---last 5 lines---"; $lastLines | ForEach-Object { Write-Host "  $_" } }
} else {
  Write-Host "  log file does not exist (daemon never wrote)"
}

Write-Host ''
Write-Host '== 5. Service-scoped cleanup =='
if ($procs) {
  Write-Host 'Node processes were found; this diagnostic does not stop them.'
  Write-Host 'Use the service installer with the same -RepoRoot to inspect or uninstall only this service.'
  Write-Host "  node packages/mcp-service/bin/install.js status --repo-root `"$RepoRoot`""
  Write-Host "  node packages/mcp-service/bin/install.js uninstall --repo-root `"$RepoRoot`""
} else {
  Write-Host 'No Node processes found.'
}
