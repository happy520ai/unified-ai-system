# Contributing

## Default Posture

Treat this project as local-first and dry-run-first unless a later approved phase explicitly says otherwise.

## Hard Boundaries

- Do not modify `legacy/`.
- Do not expose `.env`, API keys, tokens, credential values, raw endpoint values, or webhook values.
- Do not change the default `/chat` path or `/chat-gateway/execute` behavior for public-readiness work.
- Do not run OpenAI, Claude, OpenRouter, MiMo, NVIDIA, or other real Providers by default.
- Do not claim the workspace is clean unless it was explicitly verified.
- Do not weaken verifier assertions just to make a phase look complete.

## Safe Contribution Areas

- Documentation cleanup
- README polish
- Verifier and evidence consistency fixes
- Dry-run workflow improvements
- UI copy and operator-facing clarity improvements that do not break established safety boundaries

## Before You Finish

Run these commands:

```powershell
pnpm run preflight:phase632-token-saving
pnpm sync:readme-agents-current-state
pnpm verify:phase606r-open-source-minimum-readiness-lock
pnpm verify:phase607r-public-repo-hygiene-preflight
pnpm verify:phase306c-readme-agents-auto-sync-guard
```

If your work touches verifier scripts, also run:

```powershell
node --check <changed-verifier-file>
```

## Collaboration Notes

- Keep changes small, reviewable, and reversible.
- Prefer evidence-backed statements over optimistic claims.
- If a change needs real credentials, real Provider requests, deployment, release, or persistent config writes, split it into a separately approved phase rather than sneaking it into a general contribution.
