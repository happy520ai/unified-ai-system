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
    trigger = "daily"
    startTimeLocal = "20:00"
    nextRunTime = $null
    lastTaskResult = $null
    actionContains = "pnpm run nightly:phase638-safe-runner"
    verifyPass = $false
  }
  exit 0
}

$taskInfo = Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction SilentlyContinue
$actions = @($task.Actions)
$triggers = @($task.Triggers)
$actionText = ($actions | ForEach-Object { $_.Execute + " " + $_.Arguments }) -join " | "
$triggerText = ($triggers | ForEach-Object { $_.ScheduleType + " " + $_.StartBoundary }) -join " | "
$daily20 = $triggers | Where-Object {
  $_.ScheduleType -eq "Daily" -and $_.StartBoundary -match "T20:00"
}

Write-Result @{
  completed = $true
  blocker = $null
  taskName = $taskName
  scheduledTaskRegistered = $true
  trigger = "daily"
  startTimeLocal = "20:00"
  nextRunTime = $taskInfo.NextRunTime
  lastTaskResult = $taskInfo.LastTaskResult
  actionContains = "pnpm run nightly:phase638-safe-runner"
  verifyPass = [bool]($daily20 -and ($actionText -match "nightly:phase638-safe-runner"))
  taskExists = $true
  triggerText = $triggerText
}
exit 0
