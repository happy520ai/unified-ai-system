# Phase659 Homeostasis Budget / Lease / TTL Governor

Homeostasis policies set TTL=300s, maxRequests=3, maxTokenBudget=4000, maxSpawnDepth=1, leaseRequired=true, and recursiveSpawnBlocked=true.

## Safety Boundary

- Dry-run / preview only; this is not production runtime enablement.
- No Provider call is made.
- No secret, auth.json, webhook, or raw base_url is read or printed.
- Codex config and Codex base_url are not modified.
- `/chat`, `/chat-gateway/execute`, provider runtime, and CredentialRef logic stay unchanged.
- No deploy, release, tag, artifact upload, push, or commit is performed.
- Capability runtime auto-enable is blocked; human approval is required before any future runtime use.
