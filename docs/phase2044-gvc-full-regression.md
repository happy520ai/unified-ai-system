# Phase2044 GVC Full Regression

## Goal

Run the complete verifier chain for Phase2034 through Phase2043 plus safety, recovery, UI smoke, and workspace checks.

## Required Commands

```powershell
pnpm run verify:phase2034-gvc-task-quality-gate
pnpm run verify:phase2035-gvc-auto-next-actions-planner
pnpm run verify:phase2038-gvc-batch-rollback-audit
pnpm run verify:phase2040-gvc-runaway-guard
pnpm run verify:phase2041-gvc-daily-cap-enforcer
pnpm run verify:phase2042-gvc-owner-autonomous-daily-report
pnpm run verify:phase2043-gvc-dashboard-real-mutation-status
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm run smoke:phase308a-desktop-workbench-ui
pnpm -r --if-present check
```

