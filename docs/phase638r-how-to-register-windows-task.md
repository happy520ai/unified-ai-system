# Phase638R How To Register Windows Task

## Register

Only run this after explicit approval to register the Windows scheduled task:

```powershell
powershell -ExecutionPolicy Bypass -File tools/phase638r/register-nightly-windows-task.ps1
```

Task name: `PME-AI-Gateway-Nightly-Safe-Runner`

Trigger: daily at 20:00 local machine time.

Action:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "cd 'E:\AI-Data\AI网关系统\unified-ai-system'; cmd /c pnpm run nightly:phase638-safe-runner"
```

## Boundary

The task runs a one-shot local batch only. It does not call Providers, read secrets, write Codex config, modify `/chat`, modify `/chat-gateway/execute`, deploy, release, push, or commit.
