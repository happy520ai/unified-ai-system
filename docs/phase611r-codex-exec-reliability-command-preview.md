# Phase611R-Fix Codex Exec Reliability Command Preview

This file is a command preview only. It is not execution evidence.

```powershell
codex exec -c model_provider="crs" "Read .codex-context/current-context-pack.md. Check .codex-context/context-freshness-report.json and confirm stale=false. Read .codex-context/relevant-files.json. Do not edit files. Do not scan the full repository. Do not read secrets. Reply with one line only: CONTEXT_GATEWAY_MODEL_PROVIDER_OK."
```

## Guardrails

- maxPlannedAttempts=3
- maxRequests=1 per attempt
- retryLimit=0 per attempt
- requiresExplicitConfirmation=true
- stopOnFailure=true
- previewOnly=true
- codexOneShotExecutedByThisPhase=false
- providerCallsMadeByThisPhase=false
- Do not read `~/.codex/auth.json`.
- Do not write `~/.codex/config.toml`.
- Do not write project `.codex/config.toml`.
- Do not expose raw base_url, secrets, webhooks, API keys, tokens, or credentials.
- Do not modify `/chat` or `/chat-gateway/execute`.
- Do not modify provider runtime.
- Do not deploy, release, tag, upload artifacts, push, or commit.
