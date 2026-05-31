# Phase791 Provider Cost / Quota Guard

## Goal

建立 Provider cost/quota guard，默认 maxEstimatedCostUsd=0。

## Verified facts

- costQuotaGuardReady=true
- allowed=true

## Boundaries

- maxEstimatedCostUsd must be 0 in this phase
- request caps enforced

## Outputs

- apps/ai-gateway-service/evidence/phase781_800/provider-cost-quota-rate-timeout-result.json

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
