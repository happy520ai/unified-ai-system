# Phase644R External Tool Contributor Guide

## Contribution Rules

- Keep the external tool independent from the main AI Gateway runtime.
- Do not commit API keys, tokens, secrets, webhooks, or raw endpoint values.
- Do not add Provider calls to dry-run verifiers.
- Do not write Codex config.
- Do not read auth.json.
- Do not wire this tool into `/chat` or `/chat-gateway/execute`.
- Do not add deploy/release/push/commit automation.
- Keep docs and evidence clear about dry-run versus real execution.

## Verification

Run:

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run codex:external-tool:preflight
cmd /c pnpm run verify:phase641r-645r-external-tool-productization-bundle
```
