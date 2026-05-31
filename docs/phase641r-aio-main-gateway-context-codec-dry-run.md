# Phase641R-AIO Main Gateway Context Codec Dry Run

## Dry-Run Adapter

The main AI Gateway dry-run adapter lives at:

`apps/ai-gateway-service/src/gateway/contextCodecAdapter.js`

It calls `runContextCodecDryRun` from `packages/context-codec-core` and returns
a compactContext preview with token saving, fact recovery, pointer coverage,
and safety boundary fields.

## Scenarios

- Normal mode: summarizes a simple task and keeps `providerCallsMade=false`.
- God mode: preserves multi-review intent, mode, no-provider-call boundary, and
  evidence pointer.
- Tianshu mode: preserves planning mission, recommendedMode, safety boundary,
  and evidence pointer.
- Secret-like input: masks or rejects secret-like values and keeps
  `secretValueExposed=false`.

## Non-Changes

- No Provider runtime path is called.
- No CredentialRef secret value is read.
- No real `/chat` behavior is changed.
- No `/chat-gateway/execute` behavior is changed.
- compactContext is not appended to a real Provider request prompt.
