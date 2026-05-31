# Phase2065-GVC-Owner-Direct-Use-Guide

## Start

Run from the repository root:

```powershell
pnpm run gvc:timed-runner -- --intervalMs=30000 --dailyLoopLimit=500 --maxTasksPerLoop=1 --dryRunOnly=false
```

This starts controlled low-risk autonomous mutation only. It does not enable Provider calls, secret reads, deploy/release, chat-route changes, or legacy changes.

## Pause

Edit `docs/project-brain/runner-control.json`:

```json
{
  "paused": true
}
```

The runner writes idle evidence and does not execute tasks while paused.

## Resume

Edit `docs/project-brain/runner-control.json`:

```json
{
  "paused": false
}
```

## Stop

Either set:

```json
{
  "stopRequested": true
}
```

or press `Ctrl+C` in the runner terminal.

## Watch Status

- `docs/project-brain/timed-runner-state.json`
- `docs/project-brain/runner-control.json`
- `apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner/`
- Mission Control GVC Runner Dashboard

## Still Forbidden

- Provider calls.
- Raw secret, `.env`, `auth.json`, token, API key, or Authorization header reads.
- Deploy, release, tag, artifact upload, push, or commit.
- `/chat` or `/chat-gateway/execute` modification.
- `legacy/` mutation.
- `PROJECT_CONTEXT.md` creation or modification.
- Production ready, commercial ready, or workspace clean claims without separate evidence.

## Control Precedence Note

- `docs/project-brain/runner-control.json` keeps `dryRunOnly=true` as an owner safety invariant.
- The formal start command may pass `--dryRunOnly=false` to opt into approved low-risk real mutation for that runner session.
- Real mutation still requires low-risk approval, finalPermissionGate allow, low-risk executor allow, and all Provider/secret/deploy/chat-route blocks to remain false.
- If the CLI flag is omitted, the runner remains dry-run by default.
