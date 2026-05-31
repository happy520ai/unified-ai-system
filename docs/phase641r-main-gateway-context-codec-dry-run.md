# Phase641R Main Gateway Context Codec Dry Run

## Scope

The main gateway dry-run creates compact context for normal, god, tianshu, and
secret-boundary scenarios without touching the real Provider runtime.

## Entry Points

- `apps/ai-gateway-service/src/gateway/contextCodecRequestBuilder.js`
- `apps/ai-gateway-service/src/gateway/contextCodecAdapter.js`
- `apps/ai-gateway-service/src/gateway/contextCodecDryRun.js`

## Boundary

- No Provider call.
- No `/chat` behavior change.
- No `/chat-gateway/execute` behavior change.
- No credential lookup.
- No deploy, release, tag, artifact upload, push, or commit.

## Validation

`tools/phase641r/run-main-gateway-context-codec-dry-run.mjs` writes:

`apps/ai-gateway-service/evidence/phase641r/main-gateway-context-codec-dry-run.json`
