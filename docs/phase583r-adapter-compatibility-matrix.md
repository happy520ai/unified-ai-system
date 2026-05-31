# Phase583R Adapter Compatibility Matrix

## Scope

Phase583R belongs to External Adapter Readiness Without Real Send. Prepare Feishu, WeCom, Web, and API adapter contracts without reading raw webhooks or sending any external message.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase583r/adapter-compatibility-matrix-result.json
- verifier: tools/phase583r/validate-phase583r-adapter-compatibility-matrix.mjs
- execution report: docs/phase583r-execution-report.md

## Preview Snapshot

- requiredFlag: adapterCompatibilityMatrixExists
- traceRef: phase583r-trace-ref
- evidenceId: phase583r-evidence
- laneId: adapter-readiness
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase583r-adapter-compatibility-matrix.md, docs/phase583r-execution-report.md, tools/phase583r/validate-phase583r-adapter-compatibility-matrix.mjs, and apps/ai-gateway-service/evidence/phase583r/adapter-compatibility-matrix-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
