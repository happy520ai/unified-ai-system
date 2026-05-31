# Phase762 Provider Family Registry

## Goal

建立 Global Provider Family Registry，覆盖直接 Provider、Aggregator 和本地 Runtime。

## Verified facts

- nvidia: direct_provider
- openai: direct_provider
- anthropic: direct_provider
- google-gemini: direct_provider
- xai: direct_provider
- deepseek: direct_provider
- qwen: direct_provider
- moonshot-kimi: direct_provider
- zhipu-glm: direct_provider
- baidu-qianfan: direct_provider
- tencent-hunyuan: direct_provider
- minimax: direct_provider
- mistral: direct_provider
- cohere: direct_provider
- ai21: direct_provider
- groq: direct_provider
- together: direct_provider
- fireworks: direct_provider
- deepinfra: direct_provider
- replicate: direct_provider
- huggingface-inference: direct_provider
- cerebras: direct_provider
- sambanova: direct_provider
- perplexity: direct_provider
- openrouter: aggregator
- litellm-compatible: aggregator
- ollama-local: local_runtime
- lm-studio-local: local_runtime
- vllm-private: local_runtime
- siliconflow: aggregator
- modelscope: aggregator
- volcano-ark: aggregator
- baichuan: direct_provider
- yi-01ai: direct_provider
- mimo: direct_provider

## Boundaries

- runtimeEnabled=false
- providerCallsMade=false
- rawSecretAllowed=false

## Outputs

- apps/ai-gateway-service/evidence/model-library/global-provider-family-registry.json
- apps/ai-gateway-service/evidence/phase761_780/provider-family-registry-result.json

## Non-claims

- This phase does not call any Provider.
- This phase does not read API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not modify selectable model status.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
