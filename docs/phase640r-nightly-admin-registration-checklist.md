# Phase640R-Nightly Admin Registration Checklist

## Checklist

1. Use an administrator PowerShell session or a user session with Task Scheduler creation permission.
2. Confirm `pnpm run preflight:phase632-token-saving` passes first; record `Phase632 preflight pass` before continuing.
3. Run `tools/phase640r-nightly/retry-register-nightly-task-permissioned.ps1`.
4. Run `tools/phase640r-nightly/verify-nightly-task-registration.ps1`.
5. Only claim `scheduledTaskRegistered=true` if the task exists and `NextRunTime` has a value.
6. If `windows_task_scheduler_access_denied` remains, keep the blocker unchanged.
7. Do not bypass permissions.
8. Do not use daemon mode or an infinite loop.
9. The fallback launcher remains available for manual use.

## Reminder

- This is a permissioned retry pack, not an automatic elevation flow.
- This does not imply nightly automation is enabled yet.
