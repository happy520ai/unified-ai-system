export type ProviderExecutionRuntimeConfig = {
  providerMode?: string;
  realProviderEnabled?: boolean;
  enabledProviders?: string[];
};

export type ProviderExecutionGateInput = {
  providerId?: string;
  providerType?: string;
  runtimeConfig?: ProviderExecutionRuntimeConfig | null;
};

const REAL_CAPABLE_MODES = new Set(["real", "auto"]);

export function readProviderExecutionRuntimeConfig(env: Record<string, unknown> = process.env) {
  return {
    providerMode: String(env.AI_GATEWAY_PROVIDER_MODE ?? "fake").trim().toLowerCase(),
    realProviderEnabled: String(env.AI_GATEWAY_REAL_PROVIDER_ENABLED ?? "false").trim().toLowerCase() === "true",
    enabledProviders: String(env.AI_GATEWAY_ENABLED_PROVIDERS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  };
}

export function getProviderExecutionDecision(input: ProviderExecutionGateInput = {}) {
  const providerId = String(input.providerId ?? "").trim().toLowerCase();
  const providerType = String(input.providerType ?? "unknown").trim().toLowerCase();
  const runtimeConfig = input.runtimeConfig ?? {};
  const providerMode = String(runtimeConfig.providerMode ?? "fake").trim().toLowerCase();
  const enabledProviders = new Set(
    (Array.isArray(runtimeConfig.enabledProviders) ? runtimeConfig.enabledProviders : [])
      .map((value) => String(value ?? "").trim().toLowerCase())
      .filter(Boolean),
  );
  const fakeProvider = providerType === "fake";
  const gates = {
    fakeProvider,
    providerModeAllowsReal: REAL_CAPABLE_MODES.has(providerMode),
    realProviderEnabled: runtimeConfig.realProviderEnabled === true,
    providerExplicitlyAllowed: Boolean(providerId) && enabledProviders.has(providerId),
  };
  const blockers: string[] = [];

  if (!fakeProvider) {
    if (!gates.providerModeAllowsReal) blockers.push("provider-mode-not-real-capable");
    if (!gates.realProviderEnabled) blockers.push("real-provider-switch-disabled");
    if (!gates.providerExplicitlyAllowed) blockers.push("provider-not-explicitly-allowed");
  }

  return {
    allowed: fakeProvider || blockers.length === 0,
    providerId,
    providerType,
    providerMode,
    gates,
    blockers,
  };
}

export function assertProviderExecutionAllowed(input: ProviderExecutionGateInput = {}) {
  const decision = getProviderExecutionDecision(input);
  if (decision.allowed) return decision;

  const error = new Error(
    `Real provider execution is blocked for "${decision.providerId || "unknown"}": ${decision.blockers.join(", ")}.`,
  ) as Error & {
    code: string;
    category: string;
    retryable: boolean;
    details: unknown;
  };
  error.code = "REAL_PROVIDER_EXECUTION_BLOCKED";
  error.category = "governance";
  error.retryable = false;
  error.details = {
    providerId: decision.providerId,
    providerType: decision.providerType,
    providerMode: decision.providerMode,
    gates: decision.gates,
    blockers: decision.blockers,
  };
  throw error;
}
