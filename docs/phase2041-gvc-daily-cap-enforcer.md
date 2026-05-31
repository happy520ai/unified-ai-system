# Phase2041 GVC Daily Cap Enforcer

## Goal

Enforce daily autonomous runner caps.

## Limits

- `loops <= 500`
- `realMutationLoops <= 100`
- `failedMutationLoops <= 10`
- `rollbackFailures <= 0`

## Verification

Run:

```powershell
pnpm run verify:phase2041-gvc-daily-cap-enforcer
```

