param()

$ErrorActionPreference = "Stop"
$expectedRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$taskName = "PME-AI-Gateway-Nightly-Safe-Runner"
$preflightCommand = "cmd /c pnpm run preflight:phase632-token-saving"

function Write-Result([hashtable]$payload, [int]$exitCode) {
  $payload | ConvertTo-Json -Depth 6 | Write-Output
  exit $exitCode
}

$currentPath = (Get-Location).Path
if ($currentPath -ne $expectedRoot) {
  Write-Result @{
    completed = $false
    blocker = "working_directory_mismatch"
    expectedRoot = $expectedRoot
    currentPath = $currentPath
    taskName = $taskName
    phase632PreflightPassed = $false
    scheduledTaskRegistered = $false
    permissionedRetryAttempted = $false
    autoElevationAttempted = $false
    permissionBypassAttempted = $false
    providerCallsMade = $false
    secretValueExposed = $false
    authJsonRead = $false
    codexConfigModified = $false
    chatModified = $false
    chatGatewayExecuteModified = $false
    deployExecuted = $false
    releaseExecuted = $false
    pushExecuted = $false
    commitCreated = $false
  } 1
}

cmd /c $preflightCommand
if ($LASTEXITCODE -ne 0) {
  Write-Result @{
    completed = $false
    blocker = "phase632_preflight_failed"
    expectedRoot = $expectedRoot
    taskName = $taskName
    phase632PreflightPassed = $false
    scheduledTaskRegistered = $false
    permissionedRetryAttempted = $false
    autoElevationAttempted = $false
    permissionBypassAttempted = $false
    providerCallsMade = $false
    secretValueExposed = $false
    authJsonRead = $false
    codexConfigModified = $false
    chatModified = $false
    chatGatewayExecuteModified = $false
    deployExecuted = $false
    releaseExecuted = $false
    pushExecuted = $false
    commitCreated = $false
  } $LASTEXITCODE
}

try {
  $triggerStart = [datetime]::Now.Date.AddHours(20)
  if ($triggerStart -le [datetime]::Now) {
    $triggerStart = $triggerStart.AddDays(1)
  }

  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$expectedRoot'; cmd /c pnpm run nightly:phase638-safe-runner`""
  $trigger = New-ScheduledTaskTrigger -Daily -At $triggerStart
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType InteractiveToken -RunLevel LeastPrivilege

  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "PME AI Gateway nightly safe engineering runner" -Force | Out-Null
  $registeredTask = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
  $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction Stop

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
    phase632PreflightPassed = $true
    permissionedRetryAttempted = $true
    autoElevationAttempted = $false
    permissionBypassAttempted = $false
    providerCallsMade = $false
    secretValueExposed = $false
    authJsonRead = $false
    codexConfigModified = $false
    chatModified = $false
    chatGatewayExecuteModified = $false
    deployExecuted = $false
    releaseExecuted = $false
    pushExecuted = $false
    commitCreated = $false
    scheduledTaskExists = $registeredTask -ne $null
  } 0
} catch {
  $message = $_.Exception.Message
  $blocker = "registration_failed"
  if ($message -match "access is denied" -or $message -match "Access is denied") {
    $blocker = "windows_task_scheduler_access_denied"
  }

  Write-Result @{
    completed = $false
    blocker = $blocker
    taskName = $taskName
    scheduledTaskRegistered = $false
    phase632PreflightPassed = $true
    permissionedRetryAttempted = $true
    autoElevationAttempted = $false
    permissionBypassAttempted = $false
    providerCallsMade = $false
    secretValueExposed = $false
    authJsonRead = $false
    codexConfigModified = $false
    chatModified = $false
    chatGatewayExecuteModified = $false
    deployExecuted = $false
    releaseExecuted = $false
    pushExecuted = $false
    commitCreated = $false
    errorMessage = $message
  } 1
}
