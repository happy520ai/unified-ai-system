# Phase611R-Fix Budget / Rate / Rollback Policy

## Budget Policy

- maxEstimatedCostUsd=0
- maxRequestsPerAttempt=1
- maxRequestsTotal=3
- retryLimitPerAttempt=0
- providerCallsMadeByThisPhase=false

Phase611R only prepares the policy and does not execute the attempts. A future Phase612R execution must require explicit confirmation before any real `codex exec` attempt.

## Rate Policy

- maxDurationMinutesPerAttempt=10
- cooldownBetweenAttemptsSeconds=30
- stopOnFirstFailure=true
- stopOnTimeout=true
- stopOnInvalidResponse=true

## Timeout Policy

If a future attempt reaches the configured timeout without observing `CONTEXT_GATEWAY_MODEL_PROVIDER_OK`, classify that attempt as `timeout` and stop the batch.

## Rollback Policy

- codexConfigWriteAllowed=false
- projectCodexConfigWriteAllowed=false
- authJsonAccessAllowed=false

No persistent config write is allowed, so rollback should normally be a verification step rather than a file mutation.

## Cleanup Policy

A future attempt can pass only when `cleanupCompleted=true` and all persistent config write flags remain false.

## Emergency Stop Policy

Immediately stop if any future attempt reports:

- authJsonAccessed=true
- codexConfigModified=true
- projectCodexConfigModified=true
- providerRuntimeModified=true
- chatModified=true
- chatGatewayExecuteModified=true
- secretValueIncluded=true
- rawBaseUrlValueIncluded=true
- webhookValueIncluded=true
- deployExecuted=true
- releaseExecuted=true
- tagCreated=true
- artifactUploaded=true
- pushExecuted=true
- commitCreated=true

## Evidence Preservation Policy

- Preserve sanitized stdout / stderr summaries only.
- Do not record raw base_url, API key, secret, webhook, token, or credential material.
- Keep Phase610R one-shot evidence separate from future Phase612R repeated test intake evidence.
- Do not count example input files as real execution evidence.
