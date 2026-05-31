# Phase650R External Tool Next-Use Playbook

1. Every run starts with `cmd /c pnpm run preflight:phase632-token-saving`.
2. Use `docs/phase632-codex-token-saving-task-template.md`.
3. Start from `.codex-context/relevant-files.json`.
4. Do not full-repo scan by default.
5. Do not read secret, auth.json, webhook, or raw base_url values.
6. Output short A-Z or task-specific result summaries.
7. High-risk tasks only generate approval gates.
8. Nightly runner only runs low/medium-safe tasks.
9. Fallback launcher may be run manually when scheduling is unavailable.
10. Production and release remain not recommended until a separate authorized phase proves them.
