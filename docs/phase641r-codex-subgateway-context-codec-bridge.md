# Phase641R Codex Subgateway Context Codec Bridge

## Scope

The Codex Context Gateway bridge reads the existing `.codex-context` pack files
and writes compact native notation artifacts for prompt-pack preview.

## Inputs

- `.codex-context/current-context-pack.md`
- `.codex-context/relevant-files.json`
- `.codex-context/context-freshness-report.json`
- `.codex-context/token-budget-report.json`

## Outputs

- `.codex-context/native-notation-context.yaml`
- `.codex-context/native-notation-context.jsonl`
- `.codex-context/native-notation-context.trace`
- `.codex-context/context-codec-token-report.json`
- `.codex-context/context-codec-fact-recovery-report.json`

## Prompt Pack

The optional prompt-pack section is:

```text
[Context Codec Compact State]
{nativeNotationContext}
```

This phase does not write Codex config, does not modify base_url, and does not
call any real Codex relay or Provider.
