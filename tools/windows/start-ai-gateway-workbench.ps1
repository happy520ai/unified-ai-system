param(
  [switch]$CreateShortcut
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
$workbenchUrl = "http://127.0.0.1:3100/ui#five-capability-activation-panel"
$healthUrl = "http://127.0.0.1:3100/health/check"
$realCapabilityUrl = "http://127.0.0.1:3100/real-capabilities/status"

function Write-Step {
  param([string]$Message)
  Write-Host "[AI Gateway Workbench] $Message"
}

function Test-Http {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
    return @{ Ok = $true; StatusCode = [int]$response.StatusCode; Body = [string]$response.Content }
  } catch {
    return @{ Ok = $false; StatusCode = 0; Body = ""; Error = $_.Exception.Message }
  }
}

function New-WorkbenchShortcut {
  $desktop = [Environment]::GetFolderPath("Desktop")
  if (-not $desktop) {
    throw "Desktop folder is unavailable."
  }

  $shortcutPath = Join-Path $desktop "AI Gateway Workbench.lnk"
  $target = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
  $launcher = Join-Path $repoRoot "tools\windows\start-ai-gateway-workbench.ps1"
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $target
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcher`""
  $shortcut.WorkingDirectory = $repoRoot
  $shortcut.IconLocation = "$target,0"
  $shortcut.Description = "Open AI Gateway Workbench Owner OS - Five Real Capabilities"
  $shortcut.Save()
  Write-Step "desktop shortcut created: $shortcutPath"
}

if ($CreateShortcut) {
  Write-Step "creating desktop shortcut"
  try {
    New-WorkbenchShortcut
    exit 0
  } catch {
    Write-Step ("failed with reason: " + $_.Exception.Message)
    exit 1
  }
}

Write-Step "checking service"
$health = Test-Http $healthUrl
$ui = Test-Http $workbenchUrl
$realCapabilities = Test-Http $realCapabilityUrl

if ($ui.Ok -and $ui.Body -match "AI Gateway Workbench") {
  if ($realCapabilities.Ok) {
    Write-Step "five real capability status route is reachable"
  }
  Write-Step "opening workbench"
  Start-Process $workbenchUrl
  exit 0
}

if ($health.Ok -and -not $ui.Ok) {
  Write-Step "failed with reason: health endpoint responded, but /ui was not reachable"
  exit 1
}

Write-Step "starting service"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "pnpm run dev:phase7b" -WorkingDirectory $repoRoot -WindowStyle Hidden

$ready = $false
for ($i = 0; $i -lt 45; $i++) {
  Start-Sleep -Seconds 1
  $check = Test-Http $workbenchUrl
  $capabilityCheck = Test-Http $realCapabilityUrl
  if ($check.Ok -and $check.Body -match "AI Gateway Workbench" -and $capabilityCheck.Ok) {
    $ready = $true
    break
  }
}

if (-not $ready) {
  Write-Step "failed with reason: service did not become ready within 45 seconds"
  exit 1
}

Write-Step "opening workbench"
Start-Process $workbenchUrl
