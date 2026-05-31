# Phase2043 GVC Dashboard Real Mutation Status

## Goal

Show real autonomous mutation status in the read-only Mission Control / Owner OS runner panel.

## UI Fields

- `autonomousMutationEnabled`
- `realMutationLoopsToday`
- `lastMutationFiles`
- `lastRollbackStatus`
- `qualityGateBlockedCount`

## Boundary

This is read-only UI. It does not add execution buttons and does not start, stop, or mutate the runner.

## Verification

Run:

```powershell
pnpm run verify:phase2043-gvc-dashboard-real-mutation-status
```

