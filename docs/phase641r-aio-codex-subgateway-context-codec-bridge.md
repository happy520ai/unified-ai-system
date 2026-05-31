# Phase641R-AIO Codex Subgateway Context Codec Bridge

## Bridge

The Codex Context Gateway bridge lives at:

`packages/codex-context-gateway/src/contextCodecBridge.js`

It reads sanitized `.codex-context` files when present and falls back to a safe
fixture when optional inputs are missing.

## Generated Outputs

- `.codex-context/native-notation-context.yaml`
- `.codex-context/native-notation-context.jsonl`
- `.codex-context/native-notation-context.trace`
- `.codex-context/context-codec-token-report.json`
- `.codex-context/context-codec-fact-recovery-report.json`

## Prompt Pack Preview

`contextCodecPromptPackBuilder.js` can render:

```text
[Context Codec Compact State]
{compactContext}
```

This is preview text only. It does not execute Codex, does not modify Codex
config or base_url, does not start a relay, and does not call a Provider.
