# Phase1308A Codex Context Gateway Neural Relevance Preview

## Goal

Add a read-only neural relevance preview for Codex Context Gateway.

## Scope

- Dry-run scoring only.
- Files relevance preview.
- Evidence relevance preview.
- Phase relevance preview.
- No Codex base_url change.
- No Codex call.
- No Provider call.
- No secret read.
- No `/chat` integration.
- No `/chat-gateway/execute` integration.

## Result

`packages/codex-context-gateway/src/neuralRelevancePreview.js` exports `buildNeuralRelevancePreview()`.

## Evidence

`apps/ai-gateway-service/evidence/phase1308a/codex-context-gateway-neural-relevance-preview-result.json`
