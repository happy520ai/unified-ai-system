param()

$ErrorActionPreference = "Stop"
$taskName = "PME-AI-Gateway-Nightly-Safe-Runner"

function Write-Result([hashtable]$payload) {
  $payload | ConvertTo-Json -Depth 6 | Write-Output
}

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Result @{
    completed = $true
    blocker = "task_not_found"
    taskName = $taskName
    scheduledTaskRegistered = $false
    evidenceDeleted = $false
    docsDeleted = $false
    gitResetExecuted = $false
    gitCleanExecuted = $false
  }
  exit 0
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false

Write-Result @{
  completed = $true
  blocker = $null
  taskName = $taskName
  scheduledTaskRegistered = $false
  evidenceDeleted = $false
  docsDeleted = $false
  gitResetExecuted = $false
  gitCleanExecuted = $false
}
