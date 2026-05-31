# Phase662 Codex Context Neuron Migration

Registers Codex Context Gateway as a built-in codex neuron for long-task token-saving preflight.
It uses context pack, relevant files, freshness, token budget, and native notation context when present.

## Safety Boundary

- Dry-run / preview only; this is not production runtime enablement.
- No Provider call is made.
- No secret, auth.json, webhook, or raw base_url is read or printed.
- Codex config and Codex base_url are not modified.
- `/chat`, `/chat-gateway/execute`, provider runtime, and CredentialRef logic stay unchanged.
- No deploy, release, tag, artifact upload, push, or commit is performed.
- Capability runtime auto-enable is blocked; human approval is required before any future runtime use.
