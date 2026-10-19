// =============================================================================
// providerAdapterFactory.js — provider 适配器工厂
//
// 从 createGatewayApplication.js 机械拆出（T-073 延续）：装配根里的 provider
// 适配器分派、凭证能力判定与凭证池安全构造属于 providers/ 所有权。
// 行为不变：装配根以同名导入回这些符号。
// =============================================================================

import { createFakeProvider } from "./fakeProvider.js";
import { createOpenAIAdapter } from "./openAiAdapter.js";
import { createNvidiaAdapter } from "./nvidiaAdapter.js";
import { createAnthropicAdapter } from "./anthropicAdapter.js";
import { createGeminiAdapter } from "./geminiAdapter.ts";
import { createHttpLLMProviderAdapter } from "./httpLlmProviderAdapter.js";
import { createCredentialPool } from "./credentialPool.ts";
import { getProviderExecutionDecision } from "./providerExecutionGate.ts";

export function restoreRuntimeCredentialProviders({ providerRegistry, runtimeCredentialStore, runtimeConfig }) {
  for (const record of runtimeCredentialStore.listRecords?.() ?? []) {
    if (!providerRegistry.has(record.providerId)) {
      continue;
    }

    if (Array.isArray(record.models) && record.models.length) {
      providerRegistry.addRuntimeModels(record.providerId, record.models);
    }
    const provider = providerRegistry.get(record.providerId);
    const decision = getProviderExecutionDecision({
      providerId: record.providerId,
      providerType: provider.descriptor?.metadata?.providerType,
      runtimeConfig,
    });
    if (decision.allowed) {
      providerRegistry.enableProvider(record.providerId);
    }
  }
}

export function isRuntimeCredentialCapableProvider(modelConfig) {
  const providerType = modelConfig.providerType ?? modelConfig.providerId;
  return providerType === "openai" ||
    providerType === "nvidia" ||
    providerType === "anthropic" ||
    providerType === "gemini" ||
    providerType === "http-llm" ||
    providerType === "openai-compatible";
}

export function createCredentialPoolSafely(env) {
  try {
    return createCredentialPool({ env });
  } catch (error) {
    // A misconfigured pool store (e.g. encrypted mode without a master key) must
    // not take the whole gateway down. Degrading to no pool preserves the
    // pre-existing single-key behavior exactly.
    console.warn(JSON.stringify({
      event: "credential_pool_init_failed",
      code: error?.code ?? null,
      message: error instanceof Error ? error.message : "Credential pool init failed.",
    }));
    return null;
  }
}

export function createProviderAdapter(modelConfig, config, runtimeCredentialStore, env, credentialPool) {
  const options = {
    timeoutMs: config.aiGatewayService.requestTimeoutMs,
    runtimeCredentialStore,
    credentialPool,
    certificationToolMode: env.AI_GATEWAY_FAKE_PROVIDER_TOOL_MODE,
  };
  if (modelConfig.providerType === "fake") {
    return createFakeProvider(modelConfig, options);
  }

  if (modelConfig.providerType === "openai" || modelConfig.providerId === "openai") {
    return createOpenAIAdapter(modelConfig, options);
  }

  if (modelConfig.providerType === "nvidia" || modelConfig.providerId === "nvidia") {
    return createNvidiaAdapter(modelConfig, options);
  }

  if (modelConfig.providerType === "anthropic" || modelConfig.providerId === "anthropic") {
    return createAnthropicAdapter(modelConfig, options);
  }

  if (modelConfig.providerType === "gemini" || modelConfig.providerId === "gemini") {
    return createGeminiAdapter(modelConfig, options);
  }

  return createHttpLLMProviderAdapter(modelConfig, options);
}
