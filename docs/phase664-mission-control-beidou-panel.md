# Phase664 Mission Control Beidou Panel

Adds a read-only Mission Control panel showing engine status, capability neurons, immune guard, homeostasis, and Codex token-saving subgateway status.
The panel has no provider, secret, deploy, `/chat`, or `/chat-gateway/execute` action buttons.

## Safety Boundary

- Dry-run / preview only; this is not production runtime enablement.
- No Provider call is made.
- No secret, auth.json, webhook, or raw base_url is read or printed.
- Codex config and Codex base_url are not modified.
- `/chat`, `/chat-gateway/execute`, provider runtime, and CredentialRef logic stay unchanged.
- No deploy, release, tag, artifact upload, push, or commit is performed.
- Capability runtime auto-enable is blocked; human approval is required before any future runtime use.
