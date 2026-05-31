# Phase667-674 Taiji / Beidou Auto Runtime v0

This bundle adds sandbox/local auto runtime v0 on top of the Phase651-666 Taiji / Beidou self-use foundation.

Flow:
1. Review registry preview manifests for sandbox eligibility.
2. Admit safe capabilities into a runtime registry.
3. Schedule bounded local executions with lease, TTL, request, token, runtime, and spawn-depth budgets.
4. Execute deterministic dry-run adapters only.
5. Write execution evidence and merge result previews.
6. Inject failure cases and disable unsafe runtime attempts through a kill-switch policy.
7. Display status in Mission Control through a read-only panel.

Safety boundary:
- no Provider calls
- no secret/auth.json/raw base_url reads
- no Codex config/base_url writes
- no `/chat` behavior change
- no `/chat-gateway/execute` behavior change
- no provider runtime change
- no deploy/release/tag/artifact/push/commit
- not production ready
