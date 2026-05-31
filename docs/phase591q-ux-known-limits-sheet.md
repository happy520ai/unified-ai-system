# Phase591Q UX Known Limits Sheet

## Scope

Phase591Q belongs to UI UX Operator Acceptance Test Expansion. Expand Mission Control UI, dead button, screenshot, operator comprehension, runbook, and acceptance tests.

## Boundary

- dry-run / preview only
- no provider call
- no raw secret or raw webhook read
- no external IM / email send
- no deploy, release, tag, or artifact upload
- no billing or invoice action
- no /chat modification
- no /chat-gateway/execute modification
- no Yiyi / Character / Guided Showcase / floating avatar restoration

## Evidence

- evidence JSON: apps/ai-gateway-service/evidence/phase591q/ux-known-limits-sheet-result.json
- verifier: tools/phase591q/validate-phase591q-ux-known-limits-sheet.mjs
- execution report: docs/phase591q-execution-report.md

## Preview Snapshot

- requiredFlag: uxKnownLimitsSheetExists
- traceRef: phase591q-trace-ref
- evidenceId: phase591q-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase591q-ux-known-limits-sheet.md, docs/phase591q-execution-report.md, tools/phase591q/validate-phase591q-ux-known-limits-sheet.mjs, and apps/ai-gateway-service/evidence/phase591q/ux-known-limits-sheet-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
