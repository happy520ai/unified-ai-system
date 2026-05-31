# Phase1955P-Fix Minimal Repair Plan

## Scope

This phase prepares the next safe retry plan only. It does not execute a Provider call and does not claim one-shot success or Provider stability.

## Minimal Repair Priority

- P1 keep_one_shot_budget: Keep maxRequests=1 and retryAttemptCount=0 for the next retry authorization.
- P2 shorten_prompt: Use the shortest marker prompt: Reply only: OK.
- P3 explicit_non_streaming: Keep stream=false in the NVIDIA chat payload and treat streaming as out of scope for the retry.
- P4 increase_timeout_with_new_owner_approval: Raise timeoutMs to 60000 only in a new owner approval packet.
- P5 preserve_timeout_stage_classification: Record provider_fetch_or_response_wait_timeout when status is null, response is absent, and elapsed time reaches the client timeout.
- P6 prepare_light_model_candidate: Use nvidia/llama-3.1-nemotron-nano-8b-v1 as a lower-timeout-risk candidate only after explicit approval.

## Retry Approval Template

The retry template is written to `docs/phase1955p-retry-owner-approval-template.json`. It requires a fresh owner approval before any Provider call.

Important boundaries:

- maxRequests: 1
- retryAttemptCount: 0
- timeoutMs: 60000
- modelId: nvidia/llama-3.1-nemotron-nano-8b-v1
- prompt: Reply only: OK
- expectedResponseContains: OK

The lighter model candidate may reduce one-shot timeout risk. It is not a stability claim and must not be auto-selected without explicit approval.

## Not Claimed

- oneShotProviderCallPassed: false
- providerStabilityVerified: false
- productionReadyClaimed: false
- commercialReadyClaimed: false
- workspaceCleanClaimed: false
