type GatewayServiceLike = {
  execute(input: Record<string, unknown>, execution?: Record<string, unknown>): Promise<any>;
};

type GatewayBackedProviderAdapterOptions = {
  gatewayService: GatewayServiceLike;
  providerId: string;
  modelId?: string | null;
  descriptor?: Record<string, any> | null;
  source?: string;
};

type LowLevelProviderRequest = {
  request?: {
    messages?: unknown;
    options?: Record<string, unknown>;
    tools?: unknown;
    toolChoice?: unknown;
  };
  target?: {
    providerId?: unknown;
    modelId?: unknown;
  };
  execution?: Record<string, unknown>;
};

export function createGatewayBackedProviderAdapter({
  gatewayService,
  providerId,
  modelId,
  descriptor = null,
  source = "internal-gateway-adapter",
}: GatewayBackedProviderAdapterOptions) {
  if (!gatewayService || typeof gatewayService.execute !== "function") {
    throw configurationError(
      "GATEWAY_BACKED_PROVIDER_UNAVAILABLE",
      "A gateway service is required for governed internal provider execution.",
    );
  }
  const pinnedProviderId = boundedIdentifier(providerId, "providerId");
  const pinnedModelId = modelId === undefined || modelId === null || String(modelId).trim() === ""
    ? null
    : boundedIdentifier(modelId, "modelId");

  return Object.freeze({
    descriptor: descriptor ?? Object.freeze({
      id: pinnedProviderId,
      models: pinnedModelId ? [{ id: pinnedModelId }] : [],
      metadata: { providerType: "gateway-governed" },
    }),

    async generate(providerRequest: LowLevelProviderRequest = {}) {
      const request = providerRequest?.request ?? {};
      const target = providerRequest?.target ?? {};
      const selectedProviderId = boundedIdentifier(
        target.providerId ?? pinnedProviderId,
        "target.providerId",
      );
      if (selectedProviderId !== pinnedProviderId) {
        throw configurationError(
          "GATEWAY_BACKED_PROVIDER_TARGET_MISMATCH",
          "The internal provider request cannot change its pinned provider.",
        );
      }
      const selectedModelId = boundedIdentifier(
        target.modelId ?? pinnedModelId,
        "target.modelId",
      );
      if (pinnedModelId && selectedModelId !== pinnedModelId) {
        throw configurationError(
          "GATEWAY_BACKED_PROVIDER_MODEL_MISMATCH",
          "The internal provider request cannot change its pinned model.",
        );
      }

      const result = await gatewayService.execute({
        taskType: "chat",
        messages: request.messages,
        options: request.options ?? {},
        tools: request.tools,
        toolChoice: request.toolChoice,
        providerId: selectedProviderId,
        modelId: selectedModelId,
        metadata: {
          source,
          internalProviderExecution: {
            governedByGateway: true,
            directAdapterCall: false,
          },
        },
      }, providerRequest?.execution ?? {});

      if (!result?.success) throw createGatewayExecutionError(result);
      return {
        text: result.data?.message?.content ?? result.data?.text ?? result.data?.outputText ?? "",
        message: result.data?.message ?? {
          role: "assistant",
          content: result.data?.text ?? result.data?.outputText ?? "",
        },
        usage: result.data?.usage ?? {},
        latencyMs: result.data?.metadata?.latencyMs,
        raw: result.data?.metadata?.rawProviderMeta ?? {
          finishReason: result.data?.finishReason,
        },
      };
    },
  });
}

function createGatewayExecutionError(result: any) {
  const routeError = result?.error ?? {};
  return Object.assign(
    new Error(routeError.message ?? result?.message ?? "Governed gateway provider execution failed."),
    {
      code: routeError.code ?? result?.code ?? "GATEWAY_BACKED_PROVIDER_FAILED",
      category: routeError.type ?? routeError.category ?? "provider",
      retryable: routeError.retryable === true,
      details: routeError.details ?? {},
    },
  );
}

function boundedIdentifier(value: unknown, name: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 256 || !/^[A-Za-z0-9._:/-]+$/u.test(normalized)) {
    throw configurationError(
      "GATEWAY_BACKED_PROVIDER_TARGET_INVALID",
      `${name} must be a portable provider or model identifier.`,
    );
  }
  return normalized;
}

function configurationError(code: string, message: string) {
  return Object.assign(new Error(message), { code, category: "configuration", retryable: false });
}
