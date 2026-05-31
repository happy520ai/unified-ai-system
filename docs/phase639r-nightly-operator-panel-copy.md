# Phase639R-Nightly Operator Panel Copy

## Required Copy

- 计划任务未注册
- fallback launcher 可用
- 这不是后台 daemon
- 这不是无限循环
- 这不是 nightly automation enabled
- 需要管理员/有权限会话才能重新注册 Task Scheduler

## Operator Meaning

The panel should tell the operator that Windows Task Scheduler registration failed with `windows_task_scheduler_access_denied`, the fallback one-shot launchers exist, and nightly automation is not actually enabled until a permissioned registration session succeeds.

## Forbidden Copy

- Do not claim the scheduled task is registered.
- Do not claim nightly automation is enabled.
- Do not suggest bypassing permissions.
- Do not imply a Provider call, secret access, deploy, release, push, commit, `/chat` mutation, or `/chat-gateway/execute` mutation.
