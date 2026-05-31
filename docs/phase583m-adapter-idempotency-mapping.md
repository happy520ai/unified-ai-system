# Phase583M Adapter Idempotency Mapping

## Scope

Phase583M belongs to External Adapter Readiness Without Real Send. Prepare Feishu, WeCom, Web, and API adapter contracts without reading raw webhooks or sending any external message.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase583m/adapter-idempotency-mapping-result.json
- verifier: tools/phase583m/validate-phase583m-adapter-idempotency-mapping.mjs
- execution report: docs/phase583m-execution-report.md

## Preview Snapshot

- requiredFlag: adapterIdempotencyMappingWorks
- traceRef: phase583m-trace-ref
- evidenceId: phase583m-evidence
- laneId: adapter-readiness
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase583m-adapter-idempotency-mapping.md, docs/phase583m-execution-report.md, tools/phase583m/validate-phase583m-adapter-idempotency-mapping.mjs, and apps/ai-gateway-service/evidence/phase583m/adapter-idempotency-mapping-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
