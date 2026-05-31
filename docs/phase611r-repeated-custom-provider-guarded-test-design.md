# Phase611R-Fix Codex Exec Custom Provider Repeated Guarded Test Design

## Scope

This phase designs the next repeated guarded reliability test for the custom `model_provider` route after the Phase610R-Fix guarded pass.

It is design-only. It does not execute `codex exec`, does not call a Provider by this phase, and does not write persistent Codex config.

## Imported Phase610R-Fix Baseline

- phase610rImported=true
- priorOneShotPass=true
- selectedProviderId=crs
- priorRequestAttemptCount=1
- priorRetryAttemptCount=0
- priorResponseClassification=pass
- priorAck=CONTEXT_GATEWAY_MODEL_PROVIDER_OK

## Guarded Repeated Test Design

- maxPlannedAttempts=3
- retryLimitPerAttempt=0
- maxRequestsPerAttempt=1
- maxRequestsTotal=3
- stopOnFirstFailure=true
- stopOnTimeout=true
- stopOnInvalidResponse=true
- explicitConfirmationRequiredForExecution=true
- noExecutionInPhase611=true
- authJsonAccessAllowed=false
- codexConfigWriteAllowed=false
- chatIntegrationAllowed=false
- deployAllowed=false

## Pass Criteria

Each future attempt can pass only when:

- exitCode=0
- ACK is exactly `CONTEXT_GATEWAY_MODEL_PROVIDER_OK`
- requestAttemptCount=1
- retryAttemptCount=0
- cleanupCompleted=true
- authJsonAccessed=false
- codexConfigModified=false
- projectCodexConfigModified=false
- chatModified=false
- chatGatewayExecuteModified=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- pushExecuted=false
- commitCreated=false
- rawBaseUrlValueIncluded=false
- secretValueIncluded=false
- webhookValueIncluded=false

## Stop Conditions

- Stop after the first failed, timeout, TTY, invalid response, unsafe, or over-budget attempt.
- Stop if any attempt exceeds maxRequests=1.
- Stop if any retry is attempted.
- Stop if any future result reports auth.json access, Codex config writes, `/chat` changes, `/chat-gateway/execute` changes, Provider runtime changes, deploy, release, tag, artifact upload, push, or commit.
- Stop if sanitized output contains raw base_url, API key, secret, webhook, token, or credential material.

## Non-Claims

- repeatedReliabilityProven=false
- productionReadyClaimed=false
- releaseReadyClaimed=false
- chatIntegrationComplete=false
- workspaceCleanClaimed=false
