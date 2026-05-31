# Phase583D WeCom Input Adapter Preview

## Scope

Phase583D belongs to External Adapter Readiness Without Real Send. Prepare Feishu, WeCom, Web, and API adapter contracts without reading raw webhooks or sending any external message.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase583d/wecom-input-adapter-preview-result.json
- verifier: tools/phase583d/validate-phase583d-wecom-input-adapter-preview.mjs
- execution report: docs/phase583d-execution-report.md

## Preview Snapshot

- requiredFlag: weComInputAdapterPreviewWorks
- traceRef: phase583d-trace-ref
- evidenceId: phase583d-evidence
- laneId: adapter-readiness
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase583d-wecom-input-adapter-preview.md, docs/phase583d-execution-report.md, tools/phase583d/validate-phase583d-wecom-input-adapter-preview.mjs, and apps/ai-gateway-service/evidence/phase583d/wecom-input-adapter-preview-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
