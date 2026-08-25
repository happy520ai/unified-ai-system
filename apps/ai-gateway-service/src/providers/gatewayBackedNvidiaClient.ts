type GatewayServiceLike = {
  execute(input: Record<string, unknown>): Promise<any>;
};

type NvidiaChatInput = {
  modelId?: string;
  messages?: Array<Record<string, unknown>>;
  prompt?: string;
  maxTokens?: number;
};

type NvidiaCapabilityInput = {
  modelId?: string;
  [key: string]: unknown;
};

type MetaInput = {
  modelId?: string;
  requestId?: string | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  providerCalled: boolean;
  realExternalCall: boolean;
  outcomeUnknown: boolean;
};

const DEFINITELY_PRE_PROVIDER_CODES = new Set([
  "REAL_PROVIDER_EXECUTION_BLOCKED",
  "USAGE_LEDGER_UNAVAILABLE",
  "PROVIDER_AUDIT_UNAVAILABLE",
  "PROVIDER_AUDIT_WRITE_FAILED",
  "COST_GUARD_BLOCKED",
  "CONTENT_GUARDRAIL_BLOCKED",
  "MODEL_ACCESS_DENIED",
  "VALIDATION_ERROR",
]);

/**
 * Compatibility facade for legacy NVIDIA capability-planning code. Chat calls
 * re-enter the governed GatewayService; non-chat direct sinks fail closed
 * until the core gateway owns their billing, audit, and dispatch contracts.
 */
export function createGatewayBackedNvidiaClient(gatewayService: GatewayServiceLike) {
  if (!gatewayService || typeof gatewayService.execute !== "function") {
    throw Object.assign(new Error("A request-bound gateway service is required."), {
      code: "GATEWAY_BACKED_NVIDIA_CLIENT_UNAVAILABLE",
      category: "configuration",
    });
  }

  return Object.freeze({
    async chatCompletion({ modelId, messages, prompt, maxTokens }: NvidiaChatInput = {}) {
      const startedAt = Date.now();
      const startedAtIso = new Date(startedAt).toISOString();
      const result = await gatewayService.execute({
        taskType: "chat",
        messages: Array.isArray(messages) && messages.length
          ? messages
          : [{ role: "user", content: String(prompt ?? "") }],
        providerId: "nvidia",
        modelId,
        options: {
          ...(Number.isFinite(Number(maxTokens)) ? { maxOutputTokens: Number(maxTokens) } : {}),
        },
        metadata: {
          source: "phase312a-governed-gateway",
          internalProviderExecution: { governedByGateway: true, directAdapterCall: false },
        },
      });
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startedAt;
      if (!result?.success) {
        const code = result?.error?.code ?? result?.code ?? "GATEWAY_BACKED_NVIDIA_CHAT_FAILED";
        const definitelyPreProvider = String(code).startsWith("PROVIDER_DISPATCH_")
          || DEFINITELY_PRE_PROVIDER_CODES.has(String(code));
        return {
          success: false,
          code,
          message: result?.error?.message ?? result?.message ?? "Governed NVIDIA chat failed.",
          data: null,
          error: result?.error ?? null,
          meta: createMeta({
            modelId,
            requestId: result?.meta?.requestId,
            startedAt: startedAtIso,
            completedAt,
            durationMs,
            providerCalled: false,
            realExternalCall: false,
            outcomeUnknown: !definitelyPreProvider,
          }),
        };
      }
      const text = result.data?.message?.content ?? result.data?.text ?? result.data?.outputText ?? "";
      return {
        success: true,
        code: "gateway_execution_ok",
        message: "Governed NVIDIA chat completed through GatewayService.",
        data: {
          text,
          outputText: text,
          usage: result.data?.usage ?? {},
          httpStatus: 200,
        },
        error: null,
        meta: createMeta({
          modelId,
          requestId: result?.meta?.requestId,
          startedAt: startedAtIso,
          completedAt,
          durationMs,
          providerCalled: true,
          realExternalCall: result.data?.executionMode === "real",
          outcomeUnknown: false,
        }),
      };
    },
    embeddings: (input: NvidiaCapabilityInput) => unsupportedCapability("embeddings", input?.modelId),
    rerank: (input: NvidiaCapabilityInput) => unsupportedCapability("rerank", input?.modelId),
    safety: (input: NvidiaCapabilityInput) => unsupportedCapability("safety", input?.modelId),
    piiDetection: (input: NvidiaCapabilityInput) => unsupportedCapability("pii", input?.modelId),
    translation: (input: NvidiaCapabilityInput) => unsupportedCapability("translation", input?.modelId),
  });
}

function unsupportedCapability(endpointType: string, modelId?: string) {
  const timestamp = new Date().toISOString();
  return Promise.resolve({
    success: false,
    code: "GOVERNED_NON_CHAT_PROVIDER_LANE_UNAVAILABLE",
    message: `The ${endpointType} provider sink is blocked until GatewayService owns its billing, audit, and dispatch lifecycle.`,
    data: null,
    error: { code: "GOVERNED_NON_CHAT_PROVIDER_LANE_UNAVAILABLE" },
    meta: createMeta({
      modelId,
      requestId: null,
      startedAt: timestamp,
      completedAt: timestamp,
      durationMs: 0,
      providerCalled: false,
      realExternalCall: false,
      outcomeUnknown: false,
    }),
  });
}

function createMeta({
  modelId,
  requestId,
  startedAt,
  completedAt,
  durationMs,
  providerCalled,
  realExternalCall,
  outcomeUnknown,
}: MetaInput) {
  return {
    providerId: "nvidia",
    modelId: modelId ?? null,
    modelCalled: providerCalled ? modelId ?? null : null,
    providerCalled,
    realExternalCall,
    providerCallOutcomeUnknown: outcomeUnknown,
    requestId: requestId ?? null,
    startedAt,
    completedAt,
    durationMs,
    providerTimeoutMs: 0,
    timeoutHit: false,
    timeoutType: "none",
    lateResponseReceived: false,
    httpStatus: providerCalled ? 200 : null,
    retryable: false,
    fallbackUsed: false,
  };
}
