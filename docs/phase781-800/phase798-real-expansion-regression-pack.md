# Phase798 Real Expansion Regression Pack

## Goal

记录真实 discovery/smoke 扩容回归包；无 approval 时验证 no-execution 路径。

## Verified facts

- realDiscoveryExecuted=false
- realSmokeExecuted=false
- providerCallsMade=false

## Boundaries

- approval missing means no provider execution
- blocked gate is a valid sealed state

## Outputs

- user-owned-provider-expansion-final-result.json

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
