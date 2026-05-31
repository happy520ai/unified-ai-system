# Phase666 Codex Long-Task Token-Saving Subgateway Runner

The runner checks `.codex-context` context pack, relevant files, freshness, token budget, and native notation context when available.
If context is missing it uses a safe fallback; if stale=true it records a blocker. It does not read auth.json, write Codex config, start relay, or call Providers.

## Safety Boundary

- Dry-run / preview only; this is not production runtime enablement.
- No Provider call is made.
- No secret, auth.json, webhook, or raw base_url is read or printed.
- Codex config and Codex base_url are not modified.
- `/chat`, `/chat-gateway/execute`, provider runtime, and CredentialRef logic stay unchanged.
- No deploy, release, tag, artifact upload, push, or commit is performed.
- Capability runtime auto-enable is blocked; human approval is required before any future runtime use.
