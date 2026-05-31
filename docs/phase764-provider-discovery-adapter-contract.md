# Phase764 Provider Discovery Adapter Contract

## Goal

定义未来 Provider discovery adapter 的标准输出和安全边界。

## Verified facts

- describeProviderFamily()
- buildDiscoveryPlan({ credentialRef, dryRun })
- normalizeDiscoveredModel(rawModel)
- classifyDiscoveryRisk(normalizedModel)
- toGlobalModelRecord(normalizedModel)

## Boundaries

- dryRun defaults to true
- providerCallsMade must stay false
- raw secret values are never accepted
- credentialRef is referenced by id only
- discovered models must not become selectable

## Outputs

- providerDiscoveryAdapterContractReady=true

## Non-claims

- This phase does not call any Provider.
- This phase does not read API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not modify selectable model status.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
