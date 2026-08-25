import { extractRuntimeCredentialEndpoint, extractRuntimeCredentialSecret } from "../../providers/providerCredentialDetector.js";
import { createGatewayBackedNvidiaClient } from "../../providers/gatewayBackedNvidiaClient.ts";
import { ENDPOINT_TYPES } from "../../model-library/modelCapabilityRules.js";
import { findModel } from "../../model-library/unifiedModelRegistry.js";
import { getProviderExecutionDecision } from "../../providers/providerExecutionGate.ts";

export async function testPhase312AModel({ application, body, gatewayService }) {
  const env = application.runtimeEnv ?? process.env;
  const realSmokeEnabled = env.PHASE312A_NVIDIA_REAL_SMOKE === "1";
  const providerId = String(body?.providerId ?? "nvidia").trim().toLowerCase();
  const modelId = String(body?.modelId ?? body?.model ?? "").trim();
  const registry = application.modelLibraryStore.getRegistry();
  const model = findModel(registry, providerId, modelId);

  if (providerId !== "nvidia") {
    return {
      success: false,
      code: "provider_not_allowed_phase312a",
      message: "Phase312A model tests only allow NVIDIA.",
      status: "blocked",
      realExternalCall: false,
    };
  }

  if (!model) {
    return {
      success: false,
      code: "model_not_in_library",
      message: "Blocked before provider call: model is not present in the unified model library.",
      status: "blocked",
      realExternalCall: false,
      meta: { providerCalled: false, invalidProviderCalled: false },
    };
  }

  const executionDecision = getProviderExecutionDecision({
    providerId,
    providerType: "nvidia",
    runtimeConfig: application.gatewayService?.runtimeConfig,
  });
  if (!executionDecision.allowed) {
    return {
      success: false,
      code: "real_provider_execution_blocked",
      message: `Blocked before provider call: ${executionDecision.blockers.join(", ")}.`,
      status: "blocked",
      providerId,
      modelId,
      endpointType: model.endpointType,
      realExternalCall: false,
      meta: {
        providerCalled: false,
        invalidProviderCalled: false,
        gates: executionDecision.gates,
        blockers: executionDecision.blockers,
      },
    };
  }

  if (!realSmokeEnabled) {
    return {
      success: false,
      code: "real_smoke_not_enabled",
      message: "Model test route is wired, but real NVIDIA calls require PHASE312A_NVIDIA_REAL_SMOKE=1.",
      status: "blocked",
      providerId,
      modelId,
      endpointType: model.endpointType,
      realExternalCall: false,
      meta: { providerCalled: false, invalidProviderCalled: false },
    };
  }

  const nvidiaClient = createGatewayBackedNvidiaClient(gatewayService ?? application.gatewayService);
  const result = await callModelSmoke({ client: nvidiaClient, model });
  application.modelLibraryStore.recordSmokeResult({
    providerId,
    modelId,
    result,
  });
  return {
    ...result,
    status: classifySmokeStatus(result),
    model: {
      providerId,
      modelId,
      endpointType: model.endpointType,
      primaryCapability: model.primaryCapability,
    },
  };
}

export async function callModelSmoke({ client, model }) {
  if (model.endpointType === ENDPOINT_TYPES.chat) {
    return client.chatCompletion({
      modelId: model.modelId,
      messages: [{ role: "user", content: "Reply with exactly: phase312a-model-smoke-ok" }],
      maxTokens: 24,
      capability: model.primaryCapability,
    });
  }
  if (model.endpointType === ENDPOINT_TYPES.embeddings) {
    return client.embeddings({ modelId: model.modelId, input: "phase312a embedding smoke" });
  }
  if (model.endpointType === ENDPOINT_TYPES.rerank) {
    return client.rerank({
      modelId: model.modelId,
      query: "Phase312A smoke",
      passages: ["Phase312A smoke validates rerank.", "Unrelated text."],
    });
  }
  if (model.endpointType === ENDPOINT_TYPES.safety) {
    return client.safety({ modelId: model.modelId, text: "This is a harmless safety review smoke test." });
  }
  if (model.endpointType === ENDPOINT_TYPES.pii) {
    return client.piiDetection({ modelId: model.modelId, text: "Contact Jane Doe at jane@example.com for a harmless test." });
  }
  if (model.endpointType === ENDPOINT_TYPES.translation) {
    return client.translation({ modelId: model.modelId, text: "Hello world.", targetLanguage: "Chinese" });
  }

  return {
    success: false,
    code: "endpoint_not_smoke_enabled",
    message: `Endpoint ${model.endpointType} is catalog-known but not enabled for Phase312A real smoke.`,
    data: null,
    error: { code: "endpoint_not_smoke_enabled" },
    meta: {
      providerId: model.providerId,
      modelId: model.modelId,
      endpointType: model.endpointType,
      providerCalled: false,
      modelCalled: null,
      requestId: null,
      durationMs: 0,
      realExternalCall: false,
      fallbackUsed: false,
      invalidProviderCalled: false,
    },
  };
}

export function classifySmokeStatus(result) {
  if (result?.success === true) return "usable";
  if (result?.code === "endpoint_type_mismatch" || result?.code === "endpoint_not_smoke_enabled") return "wrong_endpoint";
  if (result?.code === "nvidia_rate_limited") return "rate_limited";
  return "blocked";
}

export function normalizeGatewayMode(mode) {
  const normalized = String(mode ?? "automatic_gateway").trim();
  if (normalized === "automatic" || normalized === "auto") return "automatic_gateway";
  if (normalized === "manual" || normalized === "manual-model") return "manual_model";
  if (["automatic_gateway", "manual_model", "knowledge", "programming", "safety_review", "translation"].includes(normalized)) {
    return normalized;
  }
  return "automatic_gateway";
}

export function normalizeModelSelection(value) {
  if (!value) return {};
  if (typeof value === "string") {
    const [providerId, ...modelParts] = value.includes("::") ? value.split("::") : ["nvidia", value];
    return {
      providerId: String(providerId ?? "nvidia").trim(),
      modelId: modelParts.join("::").trim(),
    };
  }
  const raw = value.selectedModel ?? value.modelSelection ?? value.modelValue;
  if (typeof raw === "string") return normalizeModelSelection(raw);
  return {
    providerId: String(value.providerId ?? value.provider ?? "nvidia").trim(),
    modelId: String(value.modelId ?? value.model ?? "").trim(),
  };
}

export function createProviders(application) {
  return application.gatewayService.getProviderDescriptors().map((provider) => {
    const credential = application.runtimeCredentialStore?.describe?.(provider.id);
    return {
      ...provider,
      metadata: {
        ...(provider.metadata ?? {}),
        runtimeCredentialPresent: Boolean(application.runtimeCredentialStore?.has(provider.id)),
        runtimeCredentialPersisted: credential?.persisted === true,
        runtimeCredentialStorage: credential?.secretStorage ?? "memory-only",
      },
    };
  });
}

export function setRuntimeProviderCredential(application, body) {
  const providerId = String(body?.providerId ?? "").trim();
  if (!providerId) {
    const error = new Error("providerId is required.");
    error.code = "provider_runtime_credential_provider_required";
    error.category = "validation";
    error.details = { providerIdPresent: false };
    throw error;
  }

  let provider;
  try {
    provider = application.providerRegistry.get(providerId);
  } catch {
    const error = new Error(`Provider is not available in the current runtime: ${providerId}`);
    error.code = "provider_runtime_credential_provider_unavailable";
    error.category = "validation";
    error.details = { providerId };
    throw error;
  }

  const runtimeModels = normalizeRuntimeCredentialModels(body, providerId);
  const result = application.runtimeCredentialStore.set({
    providerId,
    apiKey: extractRuntimeCredentialSecret(providerId, body?.apiKey),
    endpoint: body?.endpoint ?? body?.baseUrl ?? extractRuntimeCredentialEndpoint(providerId, body?.apiKey),
    source: body?.source ?? "web-chat-model-wizard",
    models: runtimeModels,
  });

  const registeredRuntimeModels = runtimeModels.length && typeof application.providerRegistry?.addRuntimeModels === "function"
    ? application.providerRegistry.addRuntimeModels(providerId, runtimeModels)
    : [];

  const executionDecision = getProviderExecutionDecision({
    providerId,
    providerType: provider.descriptor?.metadata?.providerType,
    runtimeConfig: application.gatewayService?.runtimeConfig,
  });
  if (executionDecision.allowed && typeof application.providerRegistry?.enableProvider === "function") {
    application.providerRegistry.enableProvider(providerId);
  }

  return {
    ...result,
    runtimeModelCount: registeredRuntimeModels.length,
    runtimeProviderEnabled: executionDecision.allowed,
    runtimeProviderBlockers: executionDecision.blockers,
  };
}

export function normalizeRuntimeCredentialModels(body, providerId) {
  const selectedModelId = String(body?.modelId ?? body?.model ?? "").trim();
  const models = Array.isArray(body?.models) ? body.models : [];
  const normalized = models
    .filter((model) => String(model?.providerId ?? providerId).trim() === providerId)
    .map((model) => ({
      id: model?.id ?? model?.modelId,
      displayName: model?.displayName ?? model?.modelDisplayName,
      capabilities: model?.capabilities,
      source: model?.source ?? "runtime-credential",
      metadata: model?.metadata,
    }))
    .filter((model) => String(model.id ?? "").trim());

  if (selectedModelId && !normalized.some((model) => model.id === selectedModelId)) {
    normalized.push({
      id: selectedModelId,
      displayName: selectedModelId,
      capabilities: ["chat", "summary"],
      source: "runtime-credential-selected",
    });
  }

  return normalized;
}

export function sanitizeCredentialErrorDetails(details) {
  if (!details || typeof details !== "object") {
    return {};
  }

  const sanitized = { ...details };
  delete sanitized.apiKey;
  delete sanitized.authorization;
  delete sanitized.headers;
  return sanitized;
}

export function createRouteModes() {
  return {
    modes: ["fake", "real", "auto"],
    routeModes: ["fixed", "registry-default"],
  };
}
