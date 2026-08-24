import { createNvidiaUnifiedClient } from "../providers/nvidia/nvidiaUnifiedClient.js";
import {
  getProviderExecutionDecision,
  readProviderExecutionRuntimeConfig,
} from "../providers/providerExecutionGate.ts";

export function createProviderKeyConfigStore({ env = process.env, runtimeCredentialStore, providerRegistry, modelLibraryStore } = {}) {
  function getStatus() {
    const runtime = runtimeCredentialStore?.describe?.("nvidia");
    const envKeyPresent = Boolean(env.NVIDIA_API_KEY);
    const runtimeKeyPresent = runtime?.apiKeyPresent === true;
    const configured = envKeyPresent || runtimeKeyPresent;
    const state = modelLibraryStore?.getState?.() ?? {};
    const lastProviderTest = state.providerStatus?.nvidia?.lastTestResult ?? null;

    return {
      providers: [
        {
          providerId: "nvidia",
          providerName: "NVIDIA",
          apiKeyName: "NVIDIA_API_KEY",
          baseUrlName: "NVIDIA_BASE_URL",
          keyStatus: configured
            ? lastProviderTest?.success === true
              ? "tested_passed"
              : lastProviderTest?.success === false
                ? "tested_failed"
                : "configured"
            : "not_configured",
          configured,
          apiKeyConfigured: configured,
          apiKeySource: runtimeKeyPresent ? runtime.secretStorage : envKeyPresent ? "environment" : "none",
          baseUrlConfigured: Boolean(env.NVIDIA_BASE_URL || runtime?.endpointConfigured),
          baseUrlSource: runtime?.endpointConfigured ? runtime.secretStorage : env.NVIDIA_BASE_URL ? "environment" : "default",
          secretValueVisible: false,
          lastTestAt: state.providerStatus?.nvidia?.lastTestAt ?? null,
          lastTestResult: lastProviderTest,
          defaultProvider: true,
        },
      ],
      defaultProviderId: "openrouter",
      secretsRedacted: true,
    };
  }

  function save(body = {}) {
    const providerId = String(body.providerId ?? "openrouter").trim().toLowerCase();
    const allowedProviders = readAllowedProviders(env);
    if (!allowedProviders.includes(providerId)) {
      return {
        success: false,
        code: "provider_not_allowed",
        message: `Provider ${providerId} is not allowed. Allowed providers: ${allowedProviders.join(", ")}`,
      };
    }

    const apiKey = String(body.apiKey ?? "").trim();
    const defaultBaseUrl = providerId === "openrouter" ? "https://openrouter.ai/api/v1" : "https://integrate.api.nvidia.com/v1";
    const baseUrl = String(body.baseUrl ?? body.endpoint ?? env[`${providerId.toUpperCase()}_BASE_URL`] ?? defaultBaseUrl).trim().replace(/\/+$/, "");
    if (!apiKey && !env[`${providerId.toUpperCase()}_API_KEY`] && !runtimeCredentialStore?.has?.(providerId)) {
      return {
        success: false,
        code: "api_key_required",
        message: `${providerId.toUpperCase()}_API_KEY is not configured. Paste a key or set it in the environment.`,
      };
    }

    let credential = runtimeCredentialStore?.describe?.(providerId);
    if (apiKey) {
      credential = runtimeCredentialStore.set({
        providerId,
        apiKey,
        endpoint: baseUrl,
        source: "provider-key-config-center",
        models: [],
      });
    }
    const provider = providerRegistry?.get?.(providerId);
    const decision = getProviderExecutionDecision({
      providerId,
      providerType: provider?.descriptor?.metadata?.providerType ?? providerId,
      runtimeConfig: readProviderExecutionRuntimeConfig(env),
    });
    const credentialConfigured = Boolean(
      apiKey || env[`${providerId.toUpperCase()}_API_KEY`] || runtimeCredentialStore?.has?.(providerId),
    );
    const runtimeProviderEnabled = credentialConfigured && decision.allowed;
    if (runtimeProviderEnabled) {
      providerRegistry?.enableProvider?.(providerId);
    }

    return {
      success: true,
      code: "provider_config_saved",
      message: apiKey ? `${providerId} provider configuration saved without echoing the key.` : `${providerId} provider status refreshed from existing configuration.`,
      providerId,
      apiKeyConfigured: credentialConfigured,
      endpointConfigured: Boolean(baseUrl),
      secretValueVisible: false,
      credential,
      runtimeProviderEnabled,
      runtimeProviderBlockers: decision.blockers,
    };
  }

  async function test(body = {}) {
    const modelId = String(body.modelId ?? env.NVIDIA_MODEL ?? "meta/llama-3.1-8b-instruct").trim();
    const client = createNvidiaUnifiedClient({ env, runtimeCredentialStore, modelLibraryStore });
    const result = await client.chatCompletion({
      modelId,
      messages: [{ role: "user", content: "Reply with exactly: phase312a-provider-key-ok" }],
      maxTokens: 24,
    });
    modelLibraryStore?.recordProviderTest?.({
      providerId: "nvidia",
      success: result.success,
      code: result.code,
      message: result.message,
      realExternalCall: result.meta?.realExternalCall === true,
    });
    return {
      success: result.success,
      code: result.code,
      message: result.message,
      providerId: "nvidia",
      modelId,
      realExternalCall: result.meta?.realExternalCall === true,
      secretValueVisible: false,
      meta: result.meta,
    };
  }

  return {
    getStatus,
    save,
    test,
  };
}

// Env-gated allowlist extension: AI_GATEWAY_PROVIDER_CONFIG_ALLOWED_PROVIDERS
// is a comma-separated provider id list appended to the built-in pair. Without
// the env only ["nvidia", "openrouter"] are accepted, matching prior behavior.
function readAllowedProviders(env) {
  const raw = String(env.AI_GATEWAY_PROVIDER_CONFIG_ALLOWED_PROVIDERS ?? "").trim();
  if (!raw) {
    return ["nvidia", "openrouter"];
  }
  const extra = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(["nvidia", "openrouter", ...extra]));
}
