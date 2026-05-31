# Phase1881A Legacy To Owner Automation Kernel Migration Plan

## Current Decision

Legacy automation exists, but it is not current Owner OS capability. Reuse must be by audited concept migration, not direct execution or copy.

## Reusable With Reimplementation

- Reusable as design reference only: evidence/log ledger shape, runner naming, dry-run preview language, and local file persistence boundaries.
- Reusable after reimplementation: browser automation patterns and UI screenshot evidence, because current Owner OS already has its own verified browser path.
- Reusable after isolation: file/table automation concepts such as CSV/XLSX naming, allowed output directory contracts, and write-evidence ledgers.
- Reusable after strict gates: agent runner/orchestration ideas, approval records, queues, and workflow result ledgers.

## Blocked From Direct Reuse

- Any node_modules, generated snapshot, temp runtime, or archived worktree content under legacy.
- Any script that can start shell/PowerShell commands, copy/move/delete files, download external resources, publish, deploy, or call providers.
- Any provider/runtime integration path because it is outside current Owner Automation Kernel and lacks current Phase1881A approval.
- Any desktop automation that opens applications or sends input without Owner Automation permission gates.

## Minimum Migration Path

1. Phase1882A: create Owner Automation Kernel capability contract for local file/table actions, default dry-run, no Provider, no secret reads, no legacy writes.
2. Phase1883A: add a CSV-only dry-run table generator in current tools/apps, writing only to an approved output directory and evidence ledger.
3. Phase1884A: add verifier for permissionMode, approvalRecord, allowedFiles, forbiddenPaths, dryRun default, and no legacy/script execution.
4. Phase1885A: add optional owner UI preview for generated table artifacts, still not opening Excel or using desktop input.
5. Phase1886A: only after explicit approval, consider XLSX or desktop-open adapter with a separate gate and rollback plan.

## Required Gate For File/Table Creation

- permissionMode is required.
- approvalRecord is required before apply.
- allowedFiles is required before apply.
- forbiddenPaths must block legacy/, PROJECT_CONTEXT.md, .env, .git, node_modules, auth.json, and raw credential paths.
- dryRun defaults on.
- no legacy script execution.
- no Provider calls.
- no deploy/release/tag/artifact upload/push/commit.
- no /chat or /chat-gateway/execute mutation.
- evidence must record generated file path, dryRun state, and whether any desktop open action was skipped or approved.

## Recommended Next Phase

Phase1882A should define the Owner Automation Kernel local file/table capability contract before any spreadsheet or desktop automation implementation.
