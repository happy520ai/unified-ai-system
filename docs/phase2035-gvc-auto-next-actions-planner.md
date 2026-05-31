# Phase2035 GVC Auto Next-Actions Planner

## Goal

Generate the next batch of allowed L0/L1/L2 autonomous tasks from project-brain state while routing L3 Provider candidates to `approval_required`.

## Scope

- Writes `docs/project-brain/next-actions.json`.
- Requires the Phase2034 quality gate for generated tasks.
- Generates at least five high-value low-risk task candidates.
- Does not execute Provider calls or modify runtime routes.

## Verification

Run:

```powershell
pnpm run verify:phase2035-gvc-auto-next-actions-planner
```

