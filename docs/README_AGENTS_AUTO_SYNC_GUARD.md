# README / AGENTS Auto Sync Guard

This document explains the documentation-only current-state sync guard for
`README.md` and `AGENTS.md`.

## What it does

- Keeps a managed current-state block in `README.md`.
- Keeps a managed rules block in `AGENTS.md`.
- Provides a local sync command that updates only those managed blocks.
- Provides a verifier that checks the blocks, scripts, and evidence shape.

## Managed blocks

- `<!-- BEGIN UNIFIED_AI_SYSTEM_CURRENT_STATE -->`
- `<!-- END UNIFIED_AI_SYSTEM_CURRENT_STATE -->`
- `<!-- BEGIN UNIFIED_AI_SYSTEM_AGENT_RULES -->`
- `<!-- END UNIFIED_AI_SYSTEM_AGENT_RULES -->`

## Sync command

```powershell
cmd /c pnpm run sync:readme-agents-current-state
```

The sync command only updates the managed block content in `README.md` and
`AGENTS.md`. It does not change business code, UI, routes, provider behavior,
or execution logic.

## Verification command

```powershell
cmd /c pnpm run verify:phase306c-readme-agents-auto-sync-guard
```

The verifier checks:

- Managed blocks are present.
- README captures the current phase summary and blocker state.
- AGENTS captures the managed rules and synchronization rule.
- The new scripts exist in root and service `package.json`.
- The generated evidence contains the expected safety fields.

## Safety boundary

- No `.env` or secrets are read.
- No provider or paid API is called.
- No execution capability is added.
- No `legacy/` changes are made.
- No `PROJECT_CONTEXT.md` is created.
- Workspace dirty is informational only and is not claimed clean.
