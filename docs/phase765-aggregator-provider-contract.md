# Phase765 Aggregator Provider Contract

## Goal

定义 OpenRouter、LiteLLM-compatible 等聚合器 catalog bridge 的只读契约。

## Verified facts

- supported family: openrouter
- supported family: litellm-compatible
- supported family: siliconflow
- supported family: modelscope
- supported family: volcano-ark

## Boundaries

- aggregatorCatalogIsNotRuntimeCall=true
- aggregatorModelAliasMustResolveToCanonicalId=true
- userOwnedCredentialRefRequiredForFutureRuntime=true
- rawSecretAllowed=false
- selectableUnchangedInDryRun=true

## Outputs

- aggregatorProviderContractReady=true

## Non-claims

- This phase does not call any Provider.
- This phase does not read API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not modify selectable model status.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
