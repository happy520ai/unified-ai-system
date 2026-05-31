# Phase641R Context Codec Core Shared Architecture

## Goal

Phase641R adds a shared Native Notation Context Codec core for unified-ai-system.
The core is a gateway pre-context compilation layer, not a Provider and not a
runtime execution path.

## Shared Core

- Package: `packages/context-codec-core`
- Default format: `yaml_state`
- Additional supported formats: `jsonl_facts`, `compact_trace`
- Experimental numeric/alphabet-only coding is not the default format.
- Outputs are deterministic, parseable, traceable, and evidence-pointer aware.

## Safety Boundary

- Provider calls are blocked in this phase.
- Secret-like strings are masked before compact context output.
- Codex config and base_url are not modified.
- `/chat` behavior is not changed.
- `/chat-gateway/execute` behavior is not changed.
- Deploy, release, tag, artifact upload, push, and commit are not performed.

## Shared Consumers

- Main AI Gateway uses `apps/ai-gateway-service/src/gateway/contextCodecAdapter.js`
  in dry-run only.
- Codex Context Gateway uses
  `packages/codex-context-gateway/src/contextCodecBridge.js`.
- Both consumers import the same `packages/context-codec-core/src/index.js`.

## Evidence

Primary evidence is written to:

`apps/ai-gateway-service/evidence/phase641r/context-codec-core-shared-result.json`
