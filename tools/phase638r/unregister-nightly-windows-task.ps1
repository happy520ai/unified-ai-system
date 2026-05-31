param(
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$taskName = "PME-AI-Gateway-Nightly-Safe-Runner"

Write-Host "Phase638R unregister preview"
Write-Host "TaskName=$taskName"
Write-Host "Boundary=do not delete evidence, do not delete docs, no git reset, no git clean"

if ($WhatIf) {
  Write-Host "WhatIf=true; task not unregistered."
  exit 0
}

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($null -ne $existing) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Host "unregistered=true"
} else {
  Write-Host "unregistered=false; reason=task_not_found"
}
