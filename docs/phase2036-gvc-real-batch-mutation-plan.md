# Phase2036 GVC Real Batch Mutation Plan

## Goal

Create a bounded real low-risk mutation batch plan for the timed runner.

## Scope

- Writes `docs/project-brain/real-batch-mutation-plan.json`.
- Limits the batch to 10 tasks.
- Requires rollback plans and verifier commands for every task.
- Keeps all mutations inside docs/evidence/verifier/tools/package-script safe scopes.

## Verification

Run:

```powershell
pnpm run verify:phase2036-gvc-real-batch-mutation-plan
```

