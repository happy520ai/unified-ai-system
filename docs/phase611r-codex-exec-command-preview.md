# Phase611R-Fix Codex Exec Command Preview

This file is a command preview only. It is not execution evidence.

```powershell
codex exec -c model_provider="crs" "Read .codex-context/current-context-pack.md. Check .codex-context/context-freshness-report.json and confirm stale=false. Read .codex-context/relevant-files.json. Do not edit files. Do not scan the full repository. Do not read secrets. Reply with one line only: CONTEXT_GATEWAY_MODEL_PROVIDER_OK."
```

## Boundaries

- previewOnly=true
- noExecutionInPhase611=true
- maxPlannedAttempts=3
- maxRequestsPerAttempt=1
- maxRequestsTotal=3
- retryLimitPerAttempt=0
- stopOnFirstFailure=true
- explicitConfirmationRequiredForExecution=true
- authJsonAccessAllowed=false
- codexConfigWriteAllowed=false
- projectCodexConfigWriteAllowed=false
- chatModificationAllowed=false
- chatGatewayExecuteModificationAllowed=false
- deployAllowed=false
- releaseAllowed=false
- tagAllowed=false
- artifactUploadAllowed=false
- pushAllowed=false
- commitAllowed=false
