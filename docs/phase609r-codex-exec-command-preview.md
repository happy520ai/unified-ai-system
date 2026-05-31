# Phase609R-Fix Codex Exec Command Preview

This is a command preview only. Do not treat this document as execution evidence.

```powershell
codex exec -c model_provider="crs" "Read .codex-context/current-context-pack.md. Check .codex-context/context-freshness-report.json and confirm stale=false. Read .codex-context/relevant-files.json. Do not edit files. Do not scan the full repository. Do not read secrets. Reply with one line only: CONTEXT_GATEWAY_MODEL_PROVIDER_OK."
```

## Expected Passing Output

```text
CONTEXT_GATEWAY_MODEL_PROVIDER_OK
```

## Guardrails

- maxRequests=1
- retryLimit=0
- Do not read `~/.codex/auth.json`.
- Do not write `~/.codex/config.toml`.
- Do not write project `.codex/config.toml`.
- Do not expose raw base_url, secrets, webhooks, or tokens.
- Do not modify `/chat` or `/chat-gateway/execute`.
- Do not deploy, release, tag, push, commit, or upload artifacts.
