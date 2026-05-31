# Phase606R Clone Read Dry-Run Demo Guide

## Clone And Read

After clone, start with:

- `README.md`
- `AGENTS.md`
- `docs/phase606r-open-source-minimum-readiness-lock.md`
- `docs/phase606r-open-source-known-limits.md`

These files explain the current local-first AI Gateway Workbench posture, safety boundaries, and dry-run readiness.

## Dry-Run Demo Path

Use local verification commands only:

```powershell
cmd /c pnpm install
cmd /c pnpm verify:phase606r-open-source-minimum-readiness-lock
cmd /c pnpm verify:phase107a-secret-safety
cmd /c pnpm verify:phase321a-workbench-product-recovery
cmd /c pnpm smoke:phase308a-desktop-workbench-ui
```

The dry-run demo does not require a real Provider and does not require deployment.

## What This Proves

- The repository can be read by a new operator.
- The minimum open-source readiness docs exist.
- The local dry-run safety and UI smoke checks remain available.
- The project still avoids secret exposure and real Provider calls by default.

## What This Does Not Prove

- It does not prove production readiness.
- It does not prove real Provider connectivity.
- It does not publish the project.
- It does not create a release, tag, deployment, artifact upload, or package publication.
