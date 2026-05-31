# Phase2034 GVC Autonomous Task Quality Gate

## Goal

Add a quality gate for `docs/project-brain/next-actions.json` so autonomous GVC loops do not fill the queue with low-value repeated docs-only tasks.

## Scope

- Scores owner value, engineering value, duplicate risk, stale risk, and evidence value.
- Allows high-value low-risk tasks.
- Blocks low-value duplicate docs-only tasks.
- Keeps Provider, secret, deploy, `/chat`, `/chat-gateway/execute`, `legacy/`, and `PROJECT_CONTEXT.md` out of scope.

## Verification

Run:

```powershell
pnpm run verify:phase2034-gvc-task-quality-gate
```

