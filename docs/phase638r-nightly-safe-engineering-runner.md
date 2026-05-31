# Phase638R Nightly Safe Engineering Runner

## Summary

nightlyRunnerAvailable=true
scheduledTaskRegistered=false
nightlyRunnerEnabledByUserRegistration=false
nightlyStartTimeLocal=20:00
phase632PreflightRequired=true
tokenSavingTemplateRequired=true
maxTasksPerNightDefault=8
maxTasksPerNightHardLimit=12
highRiskAutoExecute=false
highRiskGateOnly=true

The nightly runner is a local one-shot batch. It is available after this phase, but it is not enabled until the Windows Task Scheduler registration script is run by explicit user command.

## Execution

Run manually:

```powershell
cmd /c pnpm run nightly:phase638-safe-runner
```

The runner first executes:

```powershell
cmd /c pnpm run preflight:phase632-token-saving
```

If preflight fails, no engineering task runs.
