import { AGENT_GOVERNANCE_EXECUTION_CONTEXT } from "../core/gatewayService.js";

type GatewayServiceLike = {
  execute(input: Record<string, unknown>, execution?: Record<string, unknown>): Promise<any>;
};

type GatewayBackedProviderAdapterOptions = {
  gatewayService: GatewayServiceLike;
  providerId: string;
  modelId?: string | null;
  descriptor?: Record<string, any> | null;
  source?: string;
  agentExecutionContext?: {
    agentId: string;
    runId: string;
    policyHash: string;
    tenantId: string;
    userId: string;
  } | null;
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

export function createGatewayBackedProviderAdapter({
  gatewayService,
  providerId,
  modelId,
  descriptor = null,
  source = "internal-gateway-adapter",
  agentExecutionContext = null,
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
  const trustedAgentContext = agentExecutionContext
    ? normalizeAgentExecutionContext(agentExecutionContext)
    : null;

  return Object.freeze({
    governedProviderOperation: true as const,
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
        model: selectedModelId,
        ...(trustedAgentContext ? {
          enterpriseIdentity: {
            tenantId: trustedAgentContext.tenantId,
            userId: trustedAgentContext.userId,
          },
          [AGENT_GOVERNANCE_EXECUTION_CONTEXT]: trustedAgentContext,
        } : {}),
        metadata: {
          source,
          internalProviderExecution: {
            governedByGateway: true,
            directAdapterCall: false,
          },
        },
      }, providerRequest?.execution ?? {});

      if (!result?.success) throw createGatewayExecutionError(result);
      const finishReason = result.data?.finishReason === "tool_call"
        ? "tool_calls"
        : result.data?.finishReason;
      return {
        text: result.data?.message?.content ?? result.data?.text ?? result.data?.outputText ?? "",
        message: result.data?.message ?? {
          role: "assistant",
          content: result.data?.text ?? result.data?.outputText ?? "",
        },
        usage: result.data?.usage ?? {},
        toolCalls: Array.isArray(result.data?.toolCalls) ? result.data.toolCalls : [],
        latencyMs: result.data?.metadata?.latencyMs,
        raw: result.data?.metadata?.rawProviderMeta ?? {
          finishReason,
        },
      };
    },
  });
}

function normalizeAgentExecutionContext(input: NonNullable<GatewayBackedProviderAdapterOptions["agentExecutionContext"]>) {
  const agentId = String(input.agentId ?? "").trim();
  const runId = String(input.runId ?? "").trim();
  const policyHash = String(input.policyHash ?? "").trim();
  const tenantId = boundedIdentity(input.tenantId, "agentExecutionContext.tenantId");
  const userId = boundedIdentity(input.userId, "agentExecutionContext.userId");
  if (!/^agt_[A-Za-z0-9_-]{1,128}$/u.test(agentId)
    || !/^agr_[A-Za-z0-9_-]{1,128}$/u.test(runId)
    || !/^sha256:[a-f0-9]{64}$/u.test(policyHash)) {
    throw configurationError(
      "GATEWAY_BACKED_PROVIDER_AGENT_CONTEXT_INVALID",
      "The server-owned Agent execution context is invalid.",
    );
  }
  return Object.freeze({ agentId, runId, policyHash, tenantId, userId });
}

function createGatewayExecutionError(result: any) {
  const routeError = result?.error ?? {};
  const code = routeError.code ?? result?.code ?? "GATEWAY_BACKED_PROVIDER_FAILED";
  const definitelyPreProvider = String(code).startsWith("PROVIDER_DISPATCH_")
    || DEFINITELY_PRE_PROVIDER_CODES.has(String(code));
  return Object.assign(
    new Error(routeError.message ?? result?.message ?? "Governed gateway provider execution failed."),
    {
      code,
      category: routeError.type ?? routeError.category ?? "provider",
      retryable: routeError.retryable === true,
      details: routeError.details ?? {},
      providerCallAttempted: definitelyPreProvider ? false : null,
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

function boundedIdentity(value: unknown, name: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 256 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw configurationError(
      "GATEWAY_BACKED_PROVIDER_AGENT_CONTEXT_INVALID",
      `${name} must be a bounded authenticated identifier.`,
    );
  }
  return normalized;
}

function configurationError(code: string, message: string) {
  return Object.assign(new Error(message), { code, category: "configuration", retryable: false });
}
