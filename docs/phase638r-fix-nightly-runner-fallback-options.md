# Phase638R-Fix Nightly Runner Fallback Options

completed=true
recommended_sealed=true
blocker=null

## Current State

Task Scheduler registration is currently unavailable in this Windows session.

- originalBlocker=windows_task_scheduler_access_denied
- scheduledTaskRegistered=false
- taskName=PME-AI-Gateway-Nightly-Safe-Runner
- targetStartTimeLocal=20:00

## Available Fallbacks

1. Manual one-click CMD launcher
   - Path: tools/phase638r/run-nightly-safe-runner-once.cmd
   - Use: double-click or run from terminal.
   - Behavior: runs Phase632 preflight first, then runs the safe nightly runner once.

2. Manual PowerShell launcher
   - Path: tools/phase638r/run-nightly-safe-runner-once.ps1
   - Use: run with PowerShell ExecutionPolicy Bypass when needed.
   - Behavior: loop-free one-shot run; stops immediately if Phase632 preflight fails.

3. PowerShell loop-free daily launcher template
   - Use the PowerShell launcher from a trusted operator terminal at the desired local time.
   - This is a manual launch template, not a daemon and not an infinite loop.

4. VSCode task / terminal task template
   - Command: `pnpm run nightly:phase638-safe-runner`
   - Run it from a project terminal after `pnpm run preflight:phase632-token-saving`.
   - This remains a manual terminal task unless a future phase adds an explicit editor task file.

5. Startup-folder reminder launcher
   - You may place a shortcut to the CMD launcher in the Windows Startup folder as a reminder.
   - This is not a 20:00 scheduled run and must not be described as Task Scheduler registration.

## Re-registration Option

If the operator has a Windows session with permission to create scheduled tasks, re-run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/phase638r/register-nightly-windows-task.ps1
```

Then verify with:

```powershell
Get-ScheduledTask -TaskName 'PME-AI-Gateway-Nightly-Safe-Runner'
Get-ScheduledTaskInfo -TaskName 'PME-AI-Gateway-Nightly-Safe-Runner'
```

## Not Recommended

- Do not run a daemon.
- Do not run an infinite loop.
- Do not bypass Windows permissions.
- Do not skip Phase632 preflight.
- Do not call Provider.
- Do not read secrets or auth.json.
- Do not modify /chat or /chat-gateway/execute.
- Do not deploy, release, tag, push, or commit.

