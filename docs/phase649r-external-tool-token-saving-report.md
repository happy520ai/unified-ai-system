# Phase649R External Tool Token Saving Report

Phase649R summarizes token-saving evidence for the external Codex tool. This is an estimate-only report, not a real billing or invoice report.

## How Token Saving Works

- Context pack reduces repeated project-state reconstruction.
- Relevant files avoid full repo scans by giving Codex a bounded file list first.
- Stale gate avoids using old or contradictory context.
- Token budget limits input size before the tool is used.
- Output budget keeps the response short and auditable.

## Evidence Inputs

- Phase596 historical repeated usage benchmark: estimated only.
- Phase632 mandatory preflight: current hard gate before Codex work.
- Phase645 benchmark recheck: current estimate check after external-tool productization.

## Boundaries

- `estimatedSavingOnly=true`
- `realBillingClaimed=false`
- `invoiceGenerated=false`
- No Provider call was made.
- No `codex exec` was executed by this phase.
