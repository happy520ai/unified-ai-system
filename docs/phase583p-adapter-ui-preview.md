# Phase583P Adapter UI Preview

## Scope

Phase583P belongs to External Adapter Readiness Without Real Send. Prepare Feishu, WeCom, Web, and API adapter contracts without reading raw webhooks or sending any external message.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase583p/adapter-ui-preview-result.json
- verifier: tools/phase583p/validate-phase583p-adapter-ui-preview.mjs
- execution report: docs/phase583p-execution-report.md

## Preview Snapshot

- requiredFlag: adapterPreviewVisible
- traceRef: phase583p-trace-ref
- evidenceId: phase583p-evidence
- laneId: adapter-readiness
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase583p-adapter-ui-preview.md, docs/phase583p-execution-report.md, tools/phase583p/validate-phase583p-adapter-ui-preview.mjs, and apps/ai-gateway-service/evidence/phase583p/adapter-ui-preview-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
