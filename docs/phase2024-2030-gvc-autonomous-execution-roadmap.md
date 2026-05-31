# Phase2024-2030-GVC-Autonomous-Execution-Roadmap

## Goal

Move the current dry-run GVC runner toward an approval-gated autonomous execution system without bypassing risk, Provider, secret, deploy, or chat-route gates.

This roadmap is evidence-first. It does not enable autonomous mutation by itself.

## Phase Ladder

| Phase | Mode | Default |
| --- | --- | --- |
| Phase2024 | approval-gated writer design | dry-run |
| Phase2025 | approval-gated real control writer | disabled until owner approval |
| Phase2026 | autonomous low-risk real task execution | disabled until owner approval |
| Phase2027 | limited self-repair loop | disabled until owner approval |
| Phase2028 | auto next-action planner | dry-run |
| Phase2029 | long-running health monitor | dry-run |
| Phase2030 | guarded Provider approval bridge | dry-run |

## Phase2025

Phase2025 may write `docs/project-brain/runner-control.json` only after an explicit owner approval record exists. It must not send process signals, kill runner processes, create a Windows service, register startup auto-run, or modify unrelated files.

## Phase2026

Phase2026 is the first real autonomous mutation candidate, but it is still approval-gated and default-off.

Allowed after approval:

- docs/evidence/verifier updates
- package script repair
- non-core UI repair
- stale cleanup
- history compaction
- local dry-run automation

Limits:

- maxMutations<=3
- maxRealExecutionLoops<=100
- mutation evidence required
- rollback or local revert required on verifier failure
- risk escalation stops execution

Forbidden:

- Provider calls
- secret reads
- deploy/release/tag/artifact upload/push/commit
- `/chat` changes
- `/chat-gateway/execute` changes
- credential resolver changes
- billing/payment changes
- `legacy/` changes
- `PROJECT_CONTEXT.md` changes

## Phase2027

Phase2027 may add limited self-repair after verifier failure, but only with `maxRepairAttempts<=2` and repair evidence. Failed repair must rollback or stop.

## Phase2028

Phase2028 generates next-actions, risk classification, and blocked reasons. It remains dry-run.

## Phase2029

Phase2029 monitors loop health, verifier stability, mutation failure rate, runaway detection, and idle detection. It remains dry-run.

## Phase2030

Provider remains approval-gated. Phase2030 may generate a Provider approval bridge and approval packet, but it must not call a Provider by default.

## Global Gates

- No raw secret read.
- No API key or Authorization header output.
- No deploy/release/tag/artifact upload/push/commit.
- No `legacy/` modification.
- No `PROJECT_CONTEXT.md` modification.
- No unauthorized `/chat` modification.
- No unauthorized `/chat-gateway/execute` modification.
- No production ready claim.
- No commercial ready claim.
- No workspace clean claim.

## Evidence

Roadmap JSON:

```text
docs/project-brain/gvc-autonomous-execution-roadmap.json
```

Approval packets:

```text
docs/approvals/gvc-runner-control-writer-approval-required.json
docs/approvals/gvc-autonomous-low-risk-real-execution-approval-required.json
docs/approvals/gvc-provider-approval-bridge-approval-required.json
```

Verifier:

```powershell
pnpm run verify:phase2024-2030-gvc-autonomous-execution-roadmap
```

No production ready claim is made by this roadmap.
