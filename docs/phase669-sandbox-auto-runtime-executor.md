# Phase669 Sandbox Auto Runtime Executor

Phase669 executes admitted capability neurons through deterministic local dry-run adapters.

The executor writes:
- `capabilities/_runtime_executions/{capabilityId}/execution-result.json`
- `capabilities/_runtime_evidence/{capabilityId}/runtime-evidence.json`

It does not perform network calls, Provider calls, secret reads, deploys, Codex config writes, relay starts, `/chat` mutations, or `/chat-gateway/execute` mutations.
