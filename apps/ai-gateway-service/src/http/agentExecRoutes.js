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
 * Binds a caller-selected agent id to the server-authenticated enterprise
 * identity. The governance service verifies tenant, owner, lifecycle and
 * policy integrity before the run starts.
 */
export function buildAgentGovernanceIdentity(request, agentId, requestId) {
  const identity = request?.enterpriseIdentity;
  if (!identity || typeof identity !== "object") return null;
  const tenantId = typeof identity.tenantId === "string" && identity.tenantId.trim() !== ""
    ? identity.tenantId.trim()
    : null;
  const userId = typeof identity.userId === "string" && identity.userId.trim() !== ""
    ? identity.userId.trim()
    : null;
  const normalizedAgentId = typeof agentId === "string" && /^agt_[A-Za-z0-9_-]{1,128}$/u.test(agentId)
    ? agentId
    : null;
  if (!tenantId || !userId || !normalizedAgentId) return null;
  return {
    agentId: normalizedAgentId,
    tenantId,
    userId,
    role: identity.role,
    permissions: Array.isArray(identity.permissions) ? [...identity.permissions] : [],
    ...(typeof requestId === "string" && requestId ? { requestId } : {}),
  };
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
const GOVERNED_HIGH_RISK_TOOLS = new Set(["git_push", "git_create_pr"]);

export async function dispatchAgentExecRoutes(context) {
  const {
    request,
    response,
    startedAt,
    url,
    writeServiceLog,
    application,
    gatewayService: requestGatewayService,
    requestExecution,
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
    const normalized = normalizeAgentExecRequest(body);
    const governedExecution = await authorizeGovernedAgentExecution({
      application,
      request,
      requestId: context.requestId,
      normalized,
    });
    let result;
    try {
      result = await runBoundedAgentExec(body, application, requestGatewayService, {
        normalized,
        agentGovernanceIdentity: governedExecution?.context ?? null,
        agentGovernancePolicy: governedExecution?.policy ?? null,
        agentGovernanceExecutionLease: governedExecution?.executionLease ?? null,
        requestExecutionSignal: requestExecution?.signal ?? null,
        requestExecutionDeadlineAt: requestExecution?.deadlineAt ?? null,
      });
    } finally {
      governedExecution?.executionLease?.release();
    }
    writeServiceLog?.("agent_exec_completed", {
      method: request.method,
      path: AGENT_EXEC_PATH,
      status: result.status,
      providerId: result.provider.id,
      iterationsUsed: result.iterations.used,
      timedOut: result.timing.timedOut,
      durationMs: Date.now() - startedAt,
    });
    // The outer HTTP lifecycle owns an already-written 499/504 response after
    // disconnect/deadline. The combined signal still drains the run and leases,
    // but the route must never attempt a second terminal response.
    if (!response.writableEnded && !response.destroyed) {
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    }
  } catch (error) {
    writeServiceLog?.("agent_exec_failed", {
      method: request.method,
      path: AGENT_EXEC_PATH,
      code: error?.code,
      durationMs: Date.now() - startedAt,
    });
    if (!response.writableEnded && !response.destroyed) {
      writeJson(response, error?.statusCode ?? 400, createErrorEnvelope(
        error?.code ?? "AGENT_EXEC_FAILED",
        error instanceof Error ? error.message : "Bounded agent execution failed.",
        { startedAt, category: error?.category ?? "validation", details: error?.details },
      ));
    }
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
  const agentId = body.agentId === undefined || body.agentId === null || body.agentId === ""
    ? null
    : String(body.agentId).trim();
  if (agentId && !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(agentId)) {
    throw createExecError(
      "AGENT_EXEC_AGENT_ID_INVALID",
      "agentId must be a server-issued governed Agent identifier.",
    );
  }

  return {
    agentId,
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
  const normalized = options.normalized ?? normalizeAgentExecRequest(body);
  const governanceRequired = Boolean(application?.agentGovernance?.service);
  if (governanceRequired && (!options.agentGovernanceIdentity
    || !options.agentGovernancePolicy
    || !options.agentGovernanceExecutionLease)) {
    throw createExecError(
      "AGENT_GOVERNANCE_CONTEXT_REQUIRED",
      "This runtime requires a verified governed Agent identity before execution.",
      {},
      403,
    );
  }
  const governed = applyAgentGovernanceBounds(normalized, options.agentGovernancePolicy);
  const effectiveTimeoutMs = clampToHttpExecutionDeadline(
    governed.timeoutMs,
    options.requestExecutionDeadlineAt,
  );
  const configuredHighRiskTools = governanceRequired
    ? new Set(Array.isArray(application.agentGovernance.highRiskTools)
      ? application.agentGovernance.highRiskTools
      : [])
    : new Set();
  const requestedHighRiskTools = governed.toolAllowlist.filter((toolName) => GOVERNED_HIGH_RISK_TOOLS.has(toolName));
  const disabledHighRiskTools = requestedHighRiskTools.filter((toolName) => !configuredHighRiskTools.has(toolName));
  if (disabledHighRiskTools.length > 0) {
    throw createExecError(
      "AGENT_EXEC_HIGH_RISK_TOOL_DISABLED",
      "The requested high-risk tool is not explicitly enabled for Agent Governance.",
      { deniedTools: disabledHighRiskTools },
      403,
    );
  }
  if (requestedHighRiskTools.length > 0) {
    await assertHighRiskExecutionInfrastructure(application, options.agentGovernanceExecutionLease);
  }
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
    workingDirectory: application?.agentExecWorkingDirectory ?? process.cwd(),
    // Bounded semantics: no dynamic budget, no planning/reflection loops —
    // the iteration cap and wall-clock timeout are the only budgets.
    dynamicBudgetEnabled: false,
    planningEnabled: false,
    selfReflectionEnabled: false,
    errorRecoveryEnabled: true,
    partialPreviewEnabled: false,
    maxIterations: governed.maxIterations,
    maxTokensPerTurn: normalized.maxTokensPerTurn,
    maxContextTokens: AGENT_EXEC_LIMITS.defaultMaxContextTokens,
    recentTurnsToKeep: AGENT_EXEC_LIMITS.defaultRecentTurnsToKeep,
    enableHighRiskTools: configuredHighRiskTools.size > 0,
    highRiskToolAllowlist: [...configuredHighRiskTools],
    // The registry requires a checker before admitting any high-risk tool.
    // Governed calls satisfy registered permissions from the signed policy;
    // every non-governed fallback remains closed.
    permissionGate: configuredHighRiskTools.size > 0 ? {
      check: async () => ({ allowed: false, reason: "Governed high-risk tools require signed Agent policy context." }),
    } : null,
    externalEffectGate: application?.externalEffectGate,
    externalEffectFence: options.agentGovernanceExecutionLease?.assertActive
      ? {
          fingerprint: options.agentGovernanceExecutionLease.fingerprint,
          assertActive: options.agentGovernanceExecutionLease.assertActive,
        }
      : null,
    tenantId: options.agentGovernanceIdentity?.tenantId,
    // Governed agent identity + Tool Proxy: per-call enforcement flows
    // from the HTTP enterprise identity into every tool call.
    agentGovernance: options.agentGovernanceIdentity ?? null,
    governanceToolProxy: application?.agentGovernance?.toolProxy ?? null,
    agentGovernanceRequired: governanceRequired,
    governanceProtectedPaths: governanceRequired ? [application.agentGovernance.dataDir] : [],
    beforeIteration: governanceRequired
      ? async () => application.agentGovernance.service.reserveUsage(
        options.agentGovernanceIdentity.agentId,
        options.agentGovernancePolicy.limits,
        { steps: 1 },
      )
      : null,
  });

  const governanceSignal = options.agentGovernanceExecutionLease?.signal;
  const requestExecutionSignal = options.requestExecutionSignal;
  const combined = combineAgentExecAbortSignals(governanceSignal, requestExecutionSignal);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    combined.abort(Object.assign(new Error("Agent execution wall-clock deadline exceeded."), {
      name: "TimeoutError",
      code: "AGENT_EXEC_TIMEOUT",
    }));
  }, effectiveTimeoutMs);

  let result;
  try {
    result = await loop.execute({
      goal: normalized.goal,
      providerId: normalized.providerId,
      modelId: selectedModelId,
      toolAllowlist: governed.toolAllowlist,
      signal: combined.signal,
    });
  } finally {
    clearTimeout(timer);
    combined.dispose();
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
      max: governed.maxIterations,
    },
    timing: {
      durationMs: result?.durationMs ?? 0,
      timeoutMs: effectiveTimeoutMs,
      timedOut,
    },
    tools: {
      mode: Array.isArray(body?.toolAllowlist) ? "custom" : normalized.toolMode,
      allowlist: governed.toolAllowlist,
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
    governance: governanceRequired ? {
      enforced: true,
      agentId: options.agentGovernanceIdentity.agentId,
      policyHash: options.agentGovernancePolicy.policyHash,
    } : { enforced: false },
  };
}

async function authorizeGovernedAgentExecution({ application, request, requestId, normalized }) {
  const service = application?.agentGovernance?.service;
  if (!service) return null;
  const context = buildAgentGovernanceIdentity(request, normalized.agentId, requestId);
  if (!context) {
    throw createExecError(
      "AGENT_GOVERNANCE_IDENTITY_REQUIRED",
      "Governed execution requires an authenticated enterprise identity and a server-issued agentId.",
      {},
      403,
    );
  }
  if (typeof service.authorizeAgentExecution !== "function") {
    throw createExecError(
      "AGENT_GOVERNANCE_RUNTIME_UNAVAILABLE",
      "The governance runtime cannot authorize Agent execution.",
      {},
      503,
    );
  }
  const authorized = await service.authorizeAgentExecution(context.agentId, context);
  if (!authorized?.policy) {
    throw createExecError(
      "AGENT_GOVERNANCE_EXECUTION_DENIED",
      "The governed Agent is not authorized to execute.",
      {},
      403,
    );
  }
  return { context, policy: authorized.policy, executionLease: authorized.executionLease };
}

function applyAgentGovernanceBounds(normalized, policy) {
  if (!policy) {
    return {
      maxIterations: normalized.maxIterations,
      timeoutMs: normalized.timeoutMs,
      toolAllowlist: normalized.toolAllowlist,
    };
  }
  const maxSteps = policy.limits?.maxSteps;
  const maxRuntimeSeconds = policy.limits?.maxRuntimeSeconds;
  if ((typeof maxSteps === "number" && maxSteps < 1)
    || (typeof maxRuntimeSeconds === "number" && maxRuntimeSeconds <= 0)) {
    throw createExecError(
      "AGENT_GOVERNANCE_RUNTIME_LIMIT_REACHED",
      "The Agent policy does not permit another execution step.",
      {},
      403,
    );
  }
  const granted = new Set(Array.isArray(policy.grantedTools) ? policy.grantedTools : []);
  const denied = normalized.toolAllowlist.filter((toolName) => (
    !granted.has(toolName)
    || !Object.hasOwn(policy.toolDecisions ?? {}, toolName)
    || !["allow", "require_approval"].includes(policy.toolDecisions[toolName])
  ));
  if (denied.length > 0) {
    throw createExecError(
      "AGENT_GOVERNANCE_TOOL_NOT_GRANTED",
      "The requested tool allowlist exceeds the Agent's effective policy.",
      { deniedTools: denied },
      403,
    );
  }
  return {
    maxIterations: typeof maxSteps === "number"
      ? Math.min(normalized.maxIterations, Math.max(1, Math.floor(maxSteps)))
      : normalized.maxIterations,
    timeoutMs: typeof maxRuntimeSeconds === "number"
      ? Math.min(normalized.timeoutMs, Math.max(1, Math.floor(maxRuntimeSeconds * 1000)))
      : normalized.timeoutMs,
    toolAllowlist: [...normalized.toolAllowlist],
  };
}

async function assertHighRiskExecutionInfrastructure(application, executionLease) {
  const gate = application?.externalEffectGate;
  if (gate?.status?.enabled !== true || gate.status.durable !== true
    || typeof gate.reserve !== "function" || typeof gate.checkHealth !== "function") {
    throw createExecError(
      "AGENT_EXEC_EXTERNAL_EFFECT_GATE_REQUIRED",
      "High-risk Agent execution requires an enabled durable external-effect gate.",
      {},
      503,
    );
  }
  let health;
  try {
    health = await gate.checkHealth();
  } catch {
    health = null;
  }
  if (health?.available !== true) {
    throw createExecError(
      "AGENT_EXEC_EXTERNAL_EFFECT_GATE_UNAVAILABLE",
      "The durable external-effect gate is not currently available.",
      {},
      503,
    );
  }
  if (!executionLease || typeof executionLease.assertActive !== "function"
    || !/^[a-f0-9]{64}$/u.test(String(executionLease.fingerprint ?? ""))) {
    throw createExecError(
      "AGENT_EXEC_EXTERNAL_EFFECT_FENCE_REQUIRED",
      "High-risk Agent execution requires an active trusted run fence.",
      {},
      503,
    );
  }
  try {
    await executionLease.assertActive("reserve");
  } catch {
    throw createExecError(
      "AGENT_EXEC_EXTERNAL_EFFECT_FENCE_INACTIVE",
      "The Agent run fence is no longer active.",
      {},
      409,
    );
  }
}

function createExecError(code, message, details = {}, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.category = "validation";
  error.retryable = false;
  error.details = details;
  error.statusCode = statusCode;
  return error;
}

function combineAgentExecAbortSignals(...candidates) {
  const sources = candidates.filter((signal) => signal && typeof signal.addEventListener === "function");
  const controller = new AbortController();
  const listeners = [];
  const abort = (reason) => {
    if (!controller.signal.aborted) controller.abort(reason);
  };
  for (const source of sources) {
    if (source.aborted) {
      abort(source.reason);
      break;
    }
    const listener = () => abort(source.reason);
    source.addEventListener("abort", listener, { once: true });
    listeners.push([source, listener]);
  }
  return {
    signal: controller.signal,
    abort,
    dispose() {
      for (const [source, listener] of listeners) source.removeEventListener("abort", listener);
      listeners.length = 0;
    },
  };
}

function clampToHttpExecutionDeadline(requestedTimeoutMs, deadlineAt) {
  if (typeof deadlineAt !== "number" || !Number.isFinite(deadlineAt)) return requestedTimeoutMs;
  // Leave enough time for the cancelled provider/tool promise to settle and
  // for the route to serialize its terminal result before the outer HTTP scope
  // writes a 504. This is recalculated after authorization/startup recovery,
  // so slow control-plane preparation cannot invert the two deadlines.
  const remainingMs = Math.floor(Number(deadlineAt) - Date.now() - 250);
  if (remainingMs <= 0) return 1;
  return Math.max(1, Math.min(requestedTimeoutMs, remainingMs));
}
