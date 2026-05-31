# Phase590A Load Chaos Scope Lock

## Scope

Phase590A belongs to Load Chaos Failure Injection Test Expansion. Expand load, chaos, lane fallback, trace consistency, and failure injection dry-run tests without external side effects.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase590a/load-chaos-scope-lock-result.json
- verifier: tools/phase590a/validate-phase590a-load-chaos-scope-lock.mjs
- execution report: docs/phase590a-execution-report.md

## Preview Snapshot

- requiredFlag: loadChaosScopeLocked
- traceRef: phase590a-trace-ref
- evidenceId: phase590a-evidence
- laneId: load-governed
- inputCount: 64
- accepted: 12
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase590a-load-chaos-scope-lock.md, docs/phase590a-execution-report.md, tools/phase590a/validate-phase590a-load-chaos-scope-lock.mjs, and apps/ai-gateway-service/evidence/phase590a/load-chaos-scope-lock-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
