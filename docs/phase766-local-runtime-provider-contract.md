# Phase766 Local Runtime Provider Contract

## Goal

定义 Ollama、LM Studio、private vLLM 的本地 runtime catalog 契约。

## Verified facts

- supported local family: ollama-local
- supported local family: lm-studio-local
- supported local family: vllm-private

## Boundaries

- local manifests may be read only after explicit operator selection in a future phase
- this phase uses static fixtures only
- local models stay cataloged or credential_missing until a local smoke gate exists
- private endpoints and raw base_url values must not be printed

## Outputs

- localRuntimeProviderContractReady=true

## Non-claims

- This phase does not call any Provider.
- This phase does not read API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not modify selectable model status.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
