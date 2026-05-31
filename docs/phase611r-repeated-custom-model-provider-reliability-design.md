# Phase611R-Fix Repeated Custom Model Provider Reliability Design

## Scope

This phase designs a repeated reliability verification package for the custom `model_provider` route after the Phase610R-Fix user-reported `codex exec` one-shot pass.

This phase is design-only. It does not execute `codex exec`, does not call a Provider by this phase, and does not write persistent Codex config.

## Imported Baseline

- phase610rImported=true
- priorOneShotPass=true
- selectedProviderId=crs
- priorRequestAttemptCount=1
- priorRetryAttemptCount=0
- priorResponseClassification=pass
- priorPassMarker=CONTEXT_GATEWAY_MODEL_PROVIDER_OK

## Reliability Design

- maxPlannedAttempts=3
- retryLimitPerAttempt=0
- oneShotPerAttempt=true
- manualOrExplicitExecutionRequired=true
- noAutomaticExecutionInThisPhase=true
- requestAttemptCountNotIncreased=true
- repeatedReliabilityProven=false

## Pass Criteria

Each attempt may be counted as pass only when:

- exitCode=0
- stdoutSanitized or passMarker contains `CONTEXT_GATEWAY_MODEL_PROVIDER_OK`
- requestAttemptCount=1
- retryAttemptCount=0
- cleanupCompleted=true
- authJsonAccessed=false
- codexConfigModified=false
- projectCodexConfigModified=false
- rawBaseUrlValueIncluded=false
- secretValueIncluded=false
- webhookValueIncluded=false

Repeated reliability may only be classified as `repeated_pass` in a later intake phase when 3/3 real user-approved attempts pass.

## Fail Criteria

- failed_provider_route: any attempt exits non-zero and is not a known TTY failure
- failed_tty: stderr contains `stdin is not a terminal`
- invalid_response: exitCode=0 but the pass marker is missing
- blocked_by_invalid_result_input: result input cannot be parsed or violates safety gates

## Timeout Criteria

An attempt is `timeout` when the manual or explicitly authorized runner reports timeout before the pass marker is observed.

## Stop Conditions

- Stop on first failed, timeout, TTY, invalid, or unsafe attempt.
- Stop if requestAttemptCount exceeds 1 for any attempt.
- Stop if retryAttemptCount exceeds 0 for any attempt.
- Stop if any attempt reports auth.json access, Codex config writes, `/chat` changes, `/chat-gateway/execute` changes, Provider runtime changes, deploy, release, tag, artifact upload, push, or commit.
- Stop if sanitized stdout/stderr includes raw base_url, secret, webhook, API key, token, or credential material.

## Rollback / Cleanup Policy

- No persistent config write is allowed, so rollback should be unnecessary.
- If a future explicit execution writes temporary local files, cleanup must be recorded before an attempt can pass.
- Evidence must preserve failure details without exposing raw endpoint or secret values.

## Evidence Policy

- This phase writes only design evidence.
- Future execution must use a separate result input file and a separate intake verifier.
- The Phase611R example input must not be counted as a real reliability result.
- No repeated reliability claim is allowed until a later phase imports real results.

## Safety Boundary

- authJsonRead=false
- authJsonAccessed=false
- codexConfigModified=false
- projectCodexConfigModified=false
- providerRuntimeModified=false
- codexOneShotExecutedByThisPhase=false
- providerCallsMadeByThisPhase=false
- chatModified=false
- chatGatewayExecuteModified=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- pushExecuted=false
- commitCreated=false
- productionReadyClaimed=false
- repeatedReliabilityProven=false
- workspaceCleanClaimed=false
