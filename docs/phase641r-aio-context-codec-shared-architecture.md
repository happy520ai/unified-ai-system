# Phase641R-AIO Context Codec Shared Architecture

## Scope

Phase641R-AIO adds a shared `packages/context-codec-core` implementation for
context compilation. It is a gateway pre-context codec layer, not a Provider,
not a runtime router, and not a production traffic path.

## Shared Core

- Package: `packages/context-codec-core`
- Codec version: `phase641r-aio-native-notation-v1`
- Default format: `yaml_state`
- Additional deterministic formats: `jsonl_facts`, `compact_trace`
- Experimental alnum code remains disabled and is not the default route.

## Consumers

- Main AI Gateway uses
  `apps/ai-gateway-service/src/gateway/contextCodecAdapter.js` for dry-run
  compactContext preview only.
- Codex Context Gateway uses
  `packages/codex-context-gateway/src/contextCodecBridge.js` to generate
  native notation files and prompt-pack preview text.
- Both consumers import the same shared core.

## Boundary

- Provider calls are not made.
- Secrets, webhooks, auth.json, and raw base_url values are not read or output.
- Codex config and base_url are not modified.
- `/chat` behavior is not changed.
- `/chat-gateway/execute` behavior is not changed.
- compactContext is not inserted into real Provider prompts.
- Deploy, release, tag, artifact upload, push, and commit are not performed.
