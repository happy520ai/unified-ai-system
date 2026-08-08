# Unified AI System MCP Service - platform installer
#
# Run from an elevated PowerShell (right-click -> Run as administrator):
#   .\deploy\install-mcp-service.ps1 install
#   .\deploy\install-mcp-service.ps1 uninstall
#   .\deploy\install-mcp-service.ps1 status
#
# Why XML registration:
#   Register-ScheduledTask in PowerShell 7 (cross-platform aka.ms/pscore6)
#   has a long-standing type-binding issue with -Action where the value
#   returned by New-ScheduledTaskAction doesn't satisfy the parameter's
#   expected Microsoft.Management.Infrastructure.CimInstance#MSFT_TaskAction
#   type, throwing MismatchedPSTypeName. To stay robust across PowerShell
#   5.1 and PowerShell 7, this installer writes a TaskScheduler XML blob
#   and calls Register-ScheduledTask -Xml, which bypasses cmdletization
#   types entirely. The on-disk task state is identical regardless of
#   which PowerShell version registered it.
#
# On Windows 10/11 + Task Scheduler 2.0 the resulting entry is a per-user
# logon task registered through the same XML interface used by the CLI.
#
# Verification without elevated rights:
#   * `node packages/mcp-service/bin/install.js register` writes the
#     WorkBuddy MCP connector entry without touching system services
#   * `node packages/mcp-service/bin/install.js status` reads the Task
#     Scheduler entry to confirm it exists

[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('install', 'uninstall', 'status')]
  [string]$Action = 'install',

  [string]$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path,
  [string]$NodeBinary,
  [string]$LogFile,
  [switch]$SkipRegistration
)

$ErrorActionPreference = 'Stop'
$taskName = 'UnifiedAiSystemMcpService'
$displayName = 'Unified AI System MCP Service'
$description = 'Long-running MCP service supervisor for Unified AI System. Auto-starts at boot, restarts on crash, exposes local HTTP health at 127.0.0.1:7788.'

if (-not $NodeBinary) {
  $candidates = @()
  $dir = "$env:USERPROFILE\.workbuddy\binaries\node\versions"
  if (Test-Path -LiteralPath $dir) {
    $resolved = Get-ChildItem -LiteralPath $dir -Filter node.exe -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.PSIsContainer -eq $false } |
      Select-Object -First 1 -ExpandProperty FullName
    if ($resolved) { $candidates += $resolved }
  }
  foreach ($p in @("$env:ProgramFiles\nodejs\node.exe", "$env:ProgramW6432\nodejs\node.exe")) {
    if (Test-Path -LiteralPath $p) { $candidates += $p }
  }
  $fromPath = (& {
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) { $cmd.Path }
  })
  if ($fromPath) { $candidates += $fromPath }
  $NodeBinary = $candidates | Select-Object -First 1
  if (-not $NodeBinary) { throw "could not locate node.exe; pass -NodeBinary" }
}

# Use a machine temp log path by default so the task has a writable location.
# The user can pass -LogFile to choose another path.
if (-not $LogFile) {
  $LogFile = Join-Path $env:SystemRoot "Temp\UnifiedAiSystemMcpService.log"
  Write-Host "using SYSTEM-safe log path: $LogFile"
}
$startScript = Join-Path $RepoRoot 'packages/mcp-service/bin/start-service.js'
if (-not (Test-Path $startScript)) {
  throw "daemon start script missing at $startScript; confirm repository layout"
}

$argList = @($startScript, '--daemon', '--repo-root', $RepoRoot)
if ($LogFile) { $argList += @('--log-file', $LogFile) }

function Escape-For-XmlAttribute {
  param([string]$Value)
  return $Value -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;' -replace '"','&quot;' -replace "'",'&apos;'
}

function Build-TaskXml {
  param(
    [string]$Command,
    [string[]]$Args,
    [string]$WorkingDir,
    [string]$Description
  )
  $cmd = Escape-For-XmlAttribute $Command
  $wd = Escape-For-XmlAttribute $WorkingDir
  $argsEscaped = Escape-For-XmlAttribute (($Args | ForEach-Object { Escape-For-XmlAttribute $_ }) -join ' ')
  $descEscaped = Escape-For-XmlAttribute $Description

  # Use the current user (Administrator) so the daemon inherits the user's
  # session environment. Running as SYSTEM was rejected by this machine.
  $currentUser = "$env:COMPUTERNAME\$env:USERNAME"
  $userEscaped = Escape-For-XmlAttribute $currentUser

  return @"
<?xml version="1.0" encoding="UTF-16"?>
<Task xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>$descEscaped</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$userEscaped</UserId>
    </Principal>
  </Principals>
  <Actions>
    <Exec>
      <Command>$cmd</Command>
      <Arguments>$argsEscaped</Arguments>
      <WorkingDirectory>$wd</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@
}

$taskXml = Build-TaskXml -Command $NodeBinary -Args $argList -WorkingDir $RepoRoot -Description $description

switch ($Action) {
  'install' {
    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existing) {
      Stop-ScheduledTask -InputObject $existing -ErrorAction SilentlyContinue
      Unregister-ScheduledTask -InputObject $existing -Confirm:$false
    }
    Register-ScheduledTask -TaskName $taskName -Xml $taskXml -Force -ErrorAction Stop | Out-Null
    Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
    $verify = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if (-not $verify) {
      Write-Host "FAILED: Register-ScheduledTask returned but task is not visible. XML body that was rejected:"
      Write-Host '---'
      Write-Host $taskXml
      Write-Host '---'
      throw 'task registration did not persist'
    }
    Write-Host "installed $taskName"
    Write-Host "  executable: $NodeBinary"
    Write-Host "  arguments : $($argList -join ' ')"
    Write-Host "  working dir: $RepoRoot"
  }
  'uninstall' {
    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existing) {
      Stop-ScheduledTask -InputObject $existing -ErrorAction SilentlyContinue
      Unregister-ScheduledTask -InputObject $existing -Confirm:$false
      Write-Host "uninstalled $taskName"
    } else {
      Write-Host "task $taskName is not registered"
    }
  }
  'status' {
    $info = Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction SilentlyContinue
    if ($info) {
      $info | Format-List | Out-String | Write-Host
    } else {
      Write-Host "task $taskName is NOT registered"
    }
  }
  default {
    throw "unknown action $Action"
  }
}

if ($Action -eq 'install' -and -not $SkipRegistration) {
  Write-Host "registering with WorkBuddy..."
  $registerScript = Join-Path $RepoRoot 'packages/mcp-service/bin/install.js'
  & $NodeBinary $registerScript register 2>&1 | Write-Host
}

if ($Action -eq 'uninstall') {
  Write-Host "unregistering from WorkBuddy..."
  $registerScript = Join-Path $RepoRoot 'packages/mcp-service/bin/install.js'
  & $NodeBinary $registerScript unregister 2>&1 | Write-Host
}
