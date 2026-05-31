# Phase610R-Fix Codex Exec Guarded One-Shot Execution

## Scope

This phase is the explicitly confirmed `codex exec` custom `model_provider` guarded one-shot.

User confirmation:

`我确认执行 Phase610R-Fix codex exec custom model_provider guarded one-shot，maxRequests=1，retryLimit=0，不碰 auth.json，不写 Codex config。`

## Guardrails

- selectedProviderId=crs
- maxRequests=1
- retryLimit=0
- authJsonRead=false
- codexConfigModified=false
- projectCodexConfigModified=false
- chatModified=false
- chatGatewayExecuteModified=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- pushExecuted=false
- commitCreated=false
- workspaceCleanClaimed=false

## Command

```powershell
codex exec -c model_provider="crs" "Read .codex-context/current-context-pack.md. Check .codex-context/context-freshness-report.json and confirm stale=false. Read .codex-context/relevant-files.json. Do not edit files. Do not scan the full repository. Do not read secrets. Reply with one line only: CONTEXT_GATEWAY_MODEL_PROVIDER_OK."
```

## Pass Condition

The one-shot passes only if the sanitized stdout contains:

```text
CONTEXT_GATEWAY_MODEL_PROVIDER_OK
```
