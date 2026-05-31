# Phase2040 GVC Runner Runaway Guard

## Goal

Stop autonomous loops from spinning on no-op, low-value blocked tasks, high mutation failure rate, or excessive same-file touches.

## Rules

- Three no-op loops stop the runner.
- Two low-value blocked loops stop the runner unless real mutation progress exists.
- Mutation failure rate over 30 percent blocks sealing.
- The same file may not be touched more than three times per day.

## Verification

Run:

```powershell
pnpm run verify:phase2040-gvc-runaway-guard
```

