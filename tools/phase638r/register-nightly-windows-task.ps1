param(
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$taskName = "PME-AI-Gateway-Nightly-Safe-Runner"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$command = "Set-Location -LiteralPath '$workspace'; cmd /c pnpm run nightly:phase638-safe-runner"

Write-Host "Phase638R register preview"
Write-Host "TaskName=$taskName"
Write-Host "Trigger=daily 20:00"
Write-Host "Workspace=$workspace"
Write-Host "Action=powershell.exe -NoProfile -ExecutionPolicy Bypass -Command `"$command`""
Write-Host "Boundary=no provider calls, no secrets, no Codex config write, no /chat changes, no deploy/release/push/commit"

if ($WhatIf) {
  Write-Host "WhatIf=true; task not registered."
  exit 0
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"$command`""
$trigger = New-ScheduledTaskTrigger -Daily -At 20:00
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "PME AI Gateway nightly safe engineering runner. Low/medium-safe only." -Force | Out-Null
Write-Host "registered=true"
