// Bounded non-interactive agent execution — the "codex exec" tier.
//
// One POST runs the agentic coding loop with hard bounds (fixed iteration
// cap, wall-clock timeout, abort/cancel semantics) and returns a structured
// JSON result. Context compaction inside the loop uses the unified context
// compaction engine (packages/codex-context-gateway).
//
// Default execution stays credential-free: the fake provider serves requests
// unless a real provider is explicitly selected.

import { createAgenticLoop } from "../agentic/agenticCodingLoop.js";
import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { readJson, writeJson } from "./utils/responseUtils.js";
import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import { assertProviderExecutionAllowed } from "../providers/providerExecutionGate.ts";
import { createGatewayBackedProviderAdapter } from "../providers/gatewayBackedProviderAdapter.ts";

export const AGENT_EXEC_PATH = "/agent-exec/run";

/**
 * Derives the governed agent identity from the request's enterprise
 * identity. Requests without an enterprise identity run ungoverned
 * (legacy behavior); governed runs carry tenant/user on every tool call.
 */
export function buildAgentGovernanceIdentity(request) {
  const identity = request?.enterpriseIdentity;
  if (!identity || typeof identity !== "object") return null;
  const tenantId = typeof identity.tenantId === "string" && identity.tenantId.trim() !== ""
    ? identity.tenantId.trim()
    : null;
  const userId = typeof identity.userId === "string" && identity.userId.trim() !== ""
    ? identity.userId.trim()
    : null;
  if (!tenantId || !userId) return null;
  return { tenantId, userId, role: identity.role };
}

export const AGENT_EXEC_LIMITS = Object.freeze({
  maxGoalLength: 4_000,
  defaultMaxIterations: 8,
  minMaxIterations: 1,
  maxIterationsCap: 25,
  defaultTimeoutMs: 60_000,
  minTimeoutMs: 1_000,
  maxTimeoutMs: 120_000,
  defaultMaxTokensPerTurn: 2_048,
  minMaxTokensPerTurn: 256,
  maxMaxTokensPerTurn: 8_192,
  defaultMaxContextTokens: 16_000,
  defaultRecentTurnsToKeep: 5,
  defaultToolMode: "readonly",
  readonlyToolAllowlist: Object.freeze(["file_read"]),
});

const TOOL_MODES = new Set(["readonly", "none"]);

export async function dispatchAgentExecRoutes(context) {
  const {
    request,
    response,
    startedAt,
    url,
    writeServiceLog,
    application,
    gatewayService: requestGatewayService,
  } = context;

  if (request.method !== "POST" || url.pathname !== AGENT_EXEC_PATH) {
    return ROUTE_NOT_HANDLED;
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    writeJson(response, 400, createErrorEnvelope(
      "AGENT_EXEC_INVALID_JSON",
      "Bounded agent execution request body must be valid JSON.",
      { startedAt, category: "validation" },
    ));
    return;
  }

  try {
    const result = await runBoundedAgentExec(body, application, requestGatewayService, {
      agentGovernanceIdentity: buildAgentGovernanceIdentity(request),
    });
    writeServiceLog?.("agent_exec_completed", {
      method: request.method,
      path: AGENT_EXEC_PATH,
      status: result.status,
      providerId: result.provider.id,
      iterationsUsed: result.iterations.used,
      timedOut: result.timing.timedOut,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 200, createOkEnvelope(result, { startedAt }));
  } catch (error) {
    writeServiceLog?.("agent_exec_failed", {
      method: request.method,
      path: AGENT_EXEC_PATH,
      code: error?.code,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 400, createErrorEnvelope(
      error?.code ?? "AGENT_EXEC_FAILED",
      error instanceof Error ? error.message : "Bounded agent execution failed.",
      { startedAt, category: error?.category ?? "validation", details: error?.details },
    ));
  }
}

export function normalizeAgentExecRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createExecError("AGENT_EXEC_INVALID_REQUEST", "Request body must be a JSON object.");
  }
  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  if (!goal) {
    throw createExecError("AGENT_EXEC_GOAL_REQUIRED", "goal is a required non-empty string.");
  }
  if (goal.length > AGENT_EXEC_LIMITS.maxGoalLength) {
    throw createExecError(
      "AGENT_EXEC_GOAL_TOO_LONG",
      `goal must not exceed ${AGENT_EXEC_LIMITS.maxGoalLength} characters.`,
      { maximumLength: AGENT_EXEC_LIMITS.maxGoalLength, actualLength: goal.length },
    );
  }

  const rawIterations = body.maxIterations ?? AGENT_EXEC_LIMITS.defaultMaxIterations;
  if (!Number.isInteger(rawIterations)
    || rawIterations < AGENT_EXEC_LIMITS.minMaxIterations
    || rawIterations > AGENT_EXEC_LIMITS.maxIterationsCap) {
    throw createExecError(
      "AGENT_EXEC_ITERATIONS_INVALID",
      `maxIterations must be an integer between ${AGENT_EXEC_LIMITS.minMaxIterations} and ${AGENT_EXEC_LIMITS.maxIterationsCap}.`,
      { allowedRange: [AGENT_EXEC_LIMITS.minMaxIterations, AGENT_EXEC_LIMITS.maxIterationsCap] },
    );
  }

  const rawTimeout = body.timeoutMs ?? AGENT_EXEC_LIMITS.defaultTimeoutMs;
  if (!Number.isInteger(rawTimeout)
    || rawTimeout < AGENT_EXEC_LIMITS.minTimeoutMs
    || rawTimeout > AGENT_EXEC_LIMITS.maxTimeoutMs) {
    throw createExecError(
      "AGENT_EXEC_TIMEOUT_INVALID",
      `timeoutMs must be an integer between ${AGENT_EXEC_LIMITS.minTimeoutMs} and ${AGENT_EXEC_LIMITS.maxTimeoutMs}.`,
      { allowedRange: [AGENT_EXEC_LIMITS.minTimeoutMs, AGENT_EXEC_LIMITS.maxTimeoutMs] },
    );
  }

  const rawMaxTokens = body.maxTokensPerTurn ?? AGENT_EXEC_LIMITS.defaultMaxTokensPerTurn;
  if (!Number.isInteger(rawMaxTokens)
    || rawMaxTokens < AGENT_EXEC_LIMITS.minMaxTokensPerTurn
    || rawMaxTokens > AGENT_EXEC_LIMITS.maxMaxTokensPerTurn) {
    throw createExecError(
      "AGENT_EXEC_MAX_TOKENS_INVALID",
      `maxTokensPerTurn must be an integer between ${AGENT_EXEC_LIMITS.minMaxTokensPerTurn} and ${AGENT_EXEC_LIMITS.maxMaxTokensPerTurn}.`,
      { allowedRange: [AGENT_EXEC_LIMITS.minMaxTokensPerTurn, AGENT_EXEC_LIMITS.maxMaxTokensPerTurn] },
    );
  }

  const toolMode = body.toolMode ?? AGENT_EXEC_LIMITS.defaultToolMode;
  if (!TOOL_MODES.has(toolMode)) {
    throw createExecError(
      "AGENT_EXEC_TOOL_MODE_INVALID",
      `toolMode must be one of: ${[...TOOL_MODES].join(", ")}.`,
      { supportedToolModes: [...TOOL_MODES] },
    );
  }
  if (body.toolAllowlist !== undefined
    && (!Array.isArray(body.toolAllowlist)
      || body.toolAllowlist.some((name) => typeof name !== "string" || !name.trim()))) {
    throw createExecError(
      "AGENT_EXEC_TOOL_ALLOWLIST_INVALID",
      "toolAllowlist must be an array of non-empty tool name strings.",
    );
  }

  const providerId = typeof body.providerId === "string" && body.providerId.trim()
    ? body.providerId.trim().toLowerCase()
    : "local-fake-provider";
  const modelId = typeof body.modelId === "string" && body.modelId.trim() ? body.modelId.trim() : undefined;

  return {
    goal,
    maxIterations: rawIterations,
    timeoutMs: rawTimeout,
    maxTokensPerTurn: rawMaxTokens,
    toolMode,
    toolAllowlist: resolveToolAllowlist(body, toolMode),
    providerId,
    modelId,
  };
}

function resolveToolAllowlist(body, toolMode) {
  if (Array.isArray(body.toolAllowlist)) return body.toolAllowlist;
  if (toolMode === "none") return [];
  return [...AGENT_EXEC_LIMITS.readonlyToolAllowlist];
}

export async function runBoundedAgentExec(body, application, executionGatewayService = null, options = {}) {
  const normalized = normalizeAgentExecRequest(body);
  const providerRegistry = application?.gatewayService?.providerRegistry;
  if (!providerRegistry) {
    throw createExecError(
      "AGENT_EXEC_PROVIDER_REGISTRY_UNAVAILABLE",
      "The gateway provider registry is not available in this runtime.",
    );
  }

  let selectedProviderAdapter;
  try {
    selectedProviderAdapter = providerRegistry.get(normalized.providerId);
  } catch {
    throw createExecError(
      "AGENT_EXEC_PROVIDER_UNAVAILABLE",
      `Provider is not available in the current runtime: ${normalized.providerId}`,
      { providerId: normalized.providerId },
    );
  }

  try {
    assertProviderExecutionAllowed({
      providerId: normalized.providerId,
      providerType: selectedProviderAdapter.descriptor?.metadata?.providerType,
      runtimeConfig: application?.gatewayService?.runtimeConfig,
    });
  } catch (error) {
    throw createExecError(
      "AGENT_EXEC_PROVIDER_EXECUTION_BLOCKED",
      error instanceof Error ? error.message : "Provider execution is blocked by runtime policy.",
      {
        providerId: normalized.providerId,
        gateCode: error?.code ?? "REAL_PROVIDER_EXECUTION_BLOCKED",
        gate: error?.details,
      },
    );
  }

  const selectedModelId = normalized.modelId
    ?? selectedProviderAdapter?.descriptor?.models?.[0]?.id;
  const providerAdapter = createGatewayBackedProviderAdapter({
    gatewayService: executionGatewayService ?? application?.gatewayService,
    providerId: normalized.providerId,
    modelId: selectedModelId,
    descriptor: selectedProviderAdapter.descriptor,
    source: "bounded-agent-exec",
  });

  const loop = createAgenticLoop({
    providerAdapter,
    // Bounded semantics: no dynamic budget, no planning/reflection loops —
    // the iteration cap and wall-clock timeout are the only budgets.
    dynamicBudgetEnabled: false,
    planningEnabled: false,
    selfReflectionEnabled: false,
    errorRecoveryEnabled: true,
    partialPreviewEnabled: false,
    maxIterations: normalized.maxIterations,
    maxTokensPerTurn: normalized.maxTokensPerTurn,
    maxContextTokens: AGENT_EXEC_LIMITS.defaultMaxContextTokens,
    recentTurnsToKeep: AGENT_EXEC_LIMITS.defaultRecentTurnsToKeep,
    enableHighRiskTools: false,
    // Governed agent identity + Tool Proxy: per-call enforcement flows
    // from the HTTP enterprise identity into every tool call.
    agentGovernance: options.agentGovernanceIdentity ?? null,
    governanceToolProxy: application?.agentGovernance?.toolProxy ?? null,
  });

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, normalized.timeoutMs);

  let result;
  try {
    result = await loop.execute({
      goal: normalized.goal,
      providerId: normalized.providerId,
      modelId: selectedModelId,
      toolAllowlist: normalized.toolAllowlist,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const rawStatus = result?.status ?? "error";
  const status = timedOut && (rawStatus === "cancelled" || rawStatus === "error")
    ? "timeout"
    : rawStatus === "max_iterations_reached" ? "max_iterations" : rawStatus;

  return {
    status,
    goal: normalized.goal,
    finalAnswer: result?.finalAnswer ?? "",
    iterations: {
      used: result?.iterations ?? 0,
      max: normalized.maxIterations,
    },
    timing: {
      durationMs: result?.durationMs ?? 0,
      timeoutMs: normalized.timeoutMs,
      timedOut,
    },
    tools: {
      mode: Array.isArray(body?.toolAllowlist) ? "custom" : normalized.toolMode,
      allowlist: normalized.toolAllowlist,
      usage: result?.toolUsage ?? {},
    },
    usage: result?.usage ?? null,
    compaction: {
      engine: "unified-context-compactor",
      policy: {
        maxContextTokens: AGENT_EXEC_LIMITS.defaultMaxContextTokens,
        recentTurnsToKeep: AGENT_EXEC_LIMITS.defaultRecentTurnsToKeep,
      },
    },
    provider: {
      id: normalized.providerId,
      modelId: selectedModelId ?? null,
    },
    sessionId: result?.sessionId ?? null,
  };
}

function createExecError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.category = "validation";
  error.retryable = false;
  error.details = details;
  return error;
}
