# Phase644R External Tool Safety Boundary

## Required

- Phase632 preflight must pass.
- Context pack must exist.
- Relevant files must exist.
- Token budget report must exist.
- Freshness report must show stale=false.
- Full repository scan remains forbidden by default.
- Output budget remains required.

## Blocked

- Provider calls
- auth.json reads
- Codex config writes
- raw secret, webhook, or raw endpoint output
- `/chat` modification
- `/chat-gateway/execute` modification
- provider runtime mutation
- deploy, release, tag, artifact upload, push, or commit
