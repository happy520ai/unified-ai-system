// forgeRoutes.js — forge 设想族群的受治理入口(A/B/C/D/F/G)。
//
//   POST /forge/polish      迭代精修(B,chat:use)
//   POST /forge/quality     质量门(B,workflow:run)
//   POST /forge/memory      记忆写入/检索(C,memory:write/read 按 action)
//   GET  /forge/memory/stats 记忆统计(C,memory:read)
//   POST /forge/orchestrate 目标编排(A+G,workflow:run,LLM 需真实凭证)
//   GET  /forge/runs        编排运行列表(workflow:run)
//   GET  /forge/status      引擎状态(F,dashboard:read)
//   GET  /forge/consensus   共识引擎状态(A,dashboard:read)

import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { readJson, writeJson } from "./utils/responseUtils.js";
import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import {
  createForgeGatewayService,
  createForgeGovernedExecution,
} from "../forge/forgeGatewayService.js";
import { classifyImmuneRisk, generateManifestDraft } from "@unified-ai-system/taiji-beidou-engine";
import { runRealTaskWorkforceDryRun } from "../workforce-preview/workforcePreviewService.js";
import { redactSecretsInText } from "../security/secretSafety.js";

export function isForgeRoute(pathname) {
  const path = String(pathname ?? "");
  return path.startsWith("/forge/") || path === "/taiji/compile" || path === "/workforce/preview";
}

function buildForgeGovernanceIdentity(request, agentId, requestId) {
  const identity = request?.enterpriseIdentity;
  const tenantId = typeof identity?.tenantId === "string" && identity.tenantId.trim()
    ? identity.tenantId.trim()
    : null;
  const userId = typeof identity?.userId === "string" && identity.userId.trim()
    ? identity.userId.trim()
    : null;
  const normalizedAgentId = typeof agentId === "string" && /^agt_[A-Za-z0-9_-]{1,128}$/u.test(agentId)
    ? agentId
    : null;
  if (!tenantId || !userId || !normalizedAgentId) return null;
  return Object.freeze({
    agentId: normalizedAgentId,
    tenantId,
    userId,
    role: identity.role,
    permissions: Array.isArray(identity.permissions) ? [...identity.permissions] : [],
    ...(typeof requestId === "string" && requestId ? { requestId } : {}),
  });
}

function boundedNumber(value, { min, max, integer = false }) {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) return undefined;
  const bounded = Math.min(Math.max(candidate, min), max);
  return integer ? Math.floor(bounded) : bounded;
}

function combineForgeRouteSignals(...candidates) {
  const signals = candidates.filter((signal) => signal
    && typeof signal.addEventListener === "function"
    && typeof signal.aborted === "boolean");
  if (signals.length === 0) return null;
  if (signals.length === 1) return signals[0];
  return AbortSignal.any(signals);
}

function sanitizeGovernedForgeOptions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return Object.freeze({});
  const safe = {};
  if (typeof value.useRefiner === "boolean") safe.useRefiner = value.useRefiner;
  const maxConcurrent = boundedNumber(value.maxConcurrent, { min: 1, max: 8, integer: true });
  if (maxConcurrent !== undefined) safe.maxConcurrent = maxConcurrent;
  if (value.budget && typeof value.budget === "object" && !Array.isArray(value.budget)) {
    const budget = {};
    const maxTokens = boundedNumber(value.budget.maxTokens, { min: 1, max: 1_000_000, integer: true });
    const maxCost = boundedNumber(value.budget.maxCost, { min: 0, max: 100 });
    const maxMinutes = boundedNumber(value.budget.maxMinutes, { min: 1, max: 120, integer: true });
    if (maxTokens !== undefined) budget.maxTokens = maxTokens;
    if (maxCost !== undefined) budget.maxCost = maxCost;
    if (maxMinutes !== undefined) budget.maxMinutes = maxMinutes;
    if (Object.keys(budget).length > 0) safe.budget = Object.freeze(budget);
  }
  if (Array.isArray(value.checkpointAfter)) {
    safe.checkpointAfter = Object.freeze(value.checkpointAfter
      .filter((item) => typeof item === "string" && /^[A-Za-z0-9._-]{1,128}$/u.test(item))
      .slice(0, 64));
  }
  // Code Intelligence performs implicit repository reads and is always off in
  // governed mode; do not allow the request to opt it back in.
  safe.enableCodeIntel = false;
  return Object.freeze(safe);
}

function buildForgeOrchestrateParams(goal, options) {
  const goalDigest = createHash("sha256").update(goal, "utf8").digest("hex");
  return Object.freeze({
    goalDigest,
    goalBytes: Buffer.byteLength(goal, "utf8"),
    options: sanitizeGovernedForgeOptions(options),
  });
}

function buildForgeApprovalReview(goal, requestedParams) {
  const redacted = redactSecretsInText(goal)
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/-]{8,}/giu, "$1 ***REDACTED***")
    .replace(/\b(password|token|secret|authorization|api[_-]?key)\s*[:=]\s*([^\s,;]+)/giu, "$1=***REDACTED***");
  const reviewable = redacted === goal
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(goal);
  if (!reviewable) {
    return Object.freeze({
      schemaVersion: 1,
      reviewable: false,
      effectType: "forge:orchestrate",
      unavailableReason: "Forge goal contains secret-like or unsafe control text and cannot be shown for approval.",
    });
  }
  const options = structuredClone(requestedParams.options);
  return Object.freeze({
    schemaVersion: 1,
    reviewable: true,
    effectType: "forge:orchestrate",
    forge: Object.freeze({
      goal,
      goalDigest: `sha256:${requestedParams.goalDigest}`,
      goalBytes: requestedParams.goalBytes,
      optionsHash: `sha256:${createHash("sha256").update(stableStringify(options), "utf8").digest("hex")}`,
      options: Object.freeze(options),
    }),
  });
}

function readApprovedForgeOptions(verdict, requestedParams) {
  if (verdict?.approvedParams === undefined) return requestedParams.options;
  const approved = verdict.approvedParams;
  if (!approved || typeof approved !== "object" || Array.isArray(approved)
    || approved.goalDigest !== requestedParams.goalDigest
    || approved.goalBytes !== requestedParams.goalBytes) {
    const error = new Error("Approved Forge orchestration parameters do not match the requested goal.");
    error.code = "FORGE_APPROVED_PARAMS_INVALID";
    throw error;
  }
  return sanitizeGovernedForgeOptions(approved.options);
}

async function executeForgeOrchestration({
  application,
  request,
  requestId,
  forge,
  goal,
  options,
  tenantIdentity,
  gatewayService,
  agentId,
  requestExecutionSignal = null,
}) {
  const governance = application?.agentGovernance;
  if (!governance) {
    return {
      result: await forge.orchestrate({
        goal,
        options,
        tenantIdentity,
        gatewayService,
        signal: requestExecutionSignal,
      }),
    };
  }
  if (typeof goal !== "string" || !goal.trim() || goal.length > 16_000) {
    return {
      error: {
        status: 400,
        code: "FORGE_INPUT_INVALID",
        message: "goal must be a non-empty string of at most 16000 characters.",
      },
    };
  }

  const identity = buildForgeGovernanceIdentity(request, agentId, requestId);
  if (!identity) {
    return {
      error: {
        status: 403,
        code: "FORGE_AGENT_GOVERNANCE_IDENTITY_REQUIRED",
        message: "Governed Forge orchestration requires body.agentId and an authenticated enterprise identity.",
      },
    };
  }
  const service = governance.service;
  const toolProxy = governance.toolProxy;
  if (typeof service?.authorizeAgentExecution !== "function"
    || typeof toolProxy?.enforce !== "function"
    || typeof toolProxy?.enforceResult !== "function") {
    return {
      error: {
        status: 503,
        code: "FORGE_AGENT_GOVERNANCE_UNAVAILABLE",
        message: "Agent Governance cannot authorize Forge orchestration.",
      },
    };
  }

  let runLease = null;
  let topActionLease = null;
  try {
    if (requestExecutionSignal?.aborted) throw requestExecutionSignal.reason;
    const authorization = await service.authorizeAgentExecution(identity.agentId, identity);
    runLease = authorization?.executionLease ?? null;
    const routeSignal = combineForgeRouteSignals(requestExecutionSignal, runLease?.signal);
    if (routeSignal?.aborted) throw routeSignal.reason;
    const rootRecord = authorization?.record;
    if (!rootRecord || rootRecord.parentAgentId !== null || rootRecord.generationDepth !== 0) {
      return {
        error: {
          status: 403,
          code: "FORGE_ROOT_AGENT_REQUIRED",
          message: "Governed Forge orchestration requires an authorized root Agent.",
        },
      };
    }
    if (!authorization?.policy || !runLease?.signal) {
      return {
        error: {
          status: 403,
          code: "FORGE_AGENT_EXECUTION_DENIED",
          message: "The governed Agent is not authorized to orchestrate Forge.",
        },
      };
    }

    const requestedParams = buildForgeOrchestrateParams(goal, options);
    const topVerdict = await toolProxy.enforce({
      context: identity,
      toolName: "forge_orchestrate",
      params: requestedParams,
      resourceContext: {
        resourceKeys: {
          goalDigest: requestedParams.goalDigest,
          forgeOperation: "orchestrate",
        },
        resources: [`forge:goal:${requestedParams.goalDigest}`],
        approvalReview: buildForgeApprovalReview(goal, requestedParams),
      },
    });
    if (routeSignal?.aborted) {
      topVerdict?.executionLease?.release?.();
      throw routeSignal.reason;
    }
    if ((topVerdict?.outcome ?? topVerdict?.verdict) !== "allow") {
      topVerdict?.executionLease?.release?.();
      if (topVerdict?.outcome === "approval_required" && topVerdict.approvalId) {
        return {
          approval: {
            outcome: "approval_required",
            code: topVerdict.code ?? "TOOL_APPROVAL_REQUIRED",
            approvalId: topVerdict.approvalId,
            agentId: identity.agentId,
            toolName: "forge_orchestrate",
          },
        };
      }
      return {
        error: {
          status: topVerdict?.outcome === "approval_required" ? 503 : 403,
          code: topVerdict?.code ?? "FORGE_ORCHESTRATE_DENIED",
          message: topVerdict?.reason ?? "Forge orchestration was denied by Agent Governance.",
        },
      };
    }
    if (!topVerdict?.policy || typeof topVerdict?.executionLease?.release !== "function") {
      topVerdict?.executionLease?.release?.();
      return {
        error: {
          status: 503,
          code: "FORGE_ACTION_LEASE_REQUIRED",
          message: "Agent Governance allowed Forge orchestration without a verified policy and releasable tool lease.",
        },
      };
    }
    topActionLease = topVerdict.executionLease ?? null;
    const approvedOptions = readApprovedForgeOptions(topVerdict, requestedParams);
    const governedExecution = createForgeGovernedExecution({
      context: identity,
      toolProxy,
      executionLease: runLease,
      signal: routeSignal,
    });
    let result = await forge.orchestrate({
      goal,
      options: approvedOptions,
      tenantIdentity,
      gatewayService,
      governedExecution,
      governanceRequired: true,
      signal: routeSignal,
    });
    if (routeSignal?.aborted) throw routeSignal.reason;
    if (typeof toolProxy.enforceResult === "function" && topVerdict.policy) {
      const resultVerdict = await toolProxy.enforceResult({
        context: identity,
        toolName: "forge_orchestrate",
        policy: topVerdict.policy,
        result,
        descriptor: { kind: "zero-records" },
      });
      if (resultVerdict && Object.hasOwn(resultVerdict, "result")) result = resultVerdict.result;
    }
    if (routeSignal?.aborted) throw routeSignal.reason;
    return { result };
  } catch (error) {
    return {
      error: {
        status: Number.isInteger(error?.statusCode) ? error.statusCode : 403,
        code: error?.code ?? "FORGE_AGENT_GOVERNANCE_FAILED",
        message: error?.message ?? "Agent Governance failed closed for Forge orchestration.",
      },
    };
  } finally {
    topActionLease?.release?.();
    runLease?.release?.();
  }
}

export async function dispatchForgeRoutes(context) {
  const {
    application,
    request,
    requestExecution,
    response,
    startedAt,
    url,
    writeServiceLog,
    requestId,
  } = context;
  if (!isForgeRoute(url.pathname)) return ROUTE_NOT_HANDLED;

  // 服务实例挂在 application 上(与 knowledgeService 等同生命周期),惰性构造。
  const gatewayService = context.gatewayService ?? application?.gatewayService;
  if (!application.__forgeGatewayService) {
    application.__forgeGatewayService = createForgeGatewayService({
      // Never retain a request-bound proxy here. Each LLM-bearing operation
      // receives the current request's gateway below, preserving cancellation,
      // tenant identity, and provider-dispatch invocation lanes.
      gatewayService: application?.gatewayService,
      env: application.runtimeEnv ?? process.env,
    });
  }
  const forge = application.__forgeGatewayService;
  const tenantIdentity = request.enterpriseIdentity ?? null;

  const fail = (status, code, message) => {
    writeJson(response, status, createErrorEnvelope(code, message, { startedAt, category: "forge" }));
  };

  // ── H 族网关设想面:taiji 能力编译与 workforce 干跑预览 ──
  if (request.method === "POST" && url.pathname === "/taiji/compile") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      return fail(400, "invalid_json", "Request body must be valid JSON.");
    }
    const spec = {
      capabilityId: String(body.capabilityId ?? "cap_custom"),
      displayName: String(body.displayName ?? body.capabilityId ?? "Custom Capability"),
      description: String(body.description ?? body.request ?? ""),
      intakeText: String(body.request ?? body.description ?? ""),
    };
    const risk = classifyImmuneRisk(spec);
    const manifest = generateManifestDraft(spec, risk);
    writeServiceLog?.("taiji_compile_completed", { method: "POST", path: url.pathname, capabilityId: spec.capabilityId, startedAt });
    writeJson(response, 200, createOkEnvelope({ spec, risk, manifest }, { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/workforce/preview") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      return fail(400, "invalid_json", "Request body must be valid JSON.");
    }
    const task = typeof body.task === "string" && body.task.trim() ? body.task : undefined;
    const preview = runRealTaskWorkforceDryRun(task);
    writeJson(response, 200, createOkEnvelope({ route: "/workforce/preview", preview }, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/forge/status") {
    writeJson(response, 200, createOkEnvelope(forge.getStatus({ tenantIdentity, gatewayService }), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/forge/consensus") {
    writeJson(response, 200, createOkEnvelope(forge.consensusStatus(), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/forge/runs") {
    writeJson(response, 200, createOkEnvelope(forge.listRuns({ tenantIdentity }), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/forge/memory/stats") {
    writeJson(response, 200, createOkEnvelope(forge.memoryStats({ tenantIdentity }), { startedAt }));
    return;
  }

  const postHandlers = {
    "/forge/polish": async (body) => {
      const result = await forge.polish({
        content: body.content,
        task: body.task ?? {},
        passes: body.passes,
        tenantIdentity,
        gatewayService,
      });
      if (!result.ok) return fail(400, result.code, result.reason ?? "polish failed.");
      writeServiceLog?.("forge_polish_completed", {
        method: "POST", path: url.pathname,
        durationMs: result.durationMs, startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    },
    "/forge/quality": async (body) => {
      const result = await forge.quality({ code: body.code, task: body.task ?? {} });
      if (!result.ok) return fail(400, result.code, result.reason ?? "quality check failed.");
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    },
    "/forge/orchestrate": async (body) => {
      const execution = await executeForgeOrchestration({
        application,
        request,
        requestId,
        forge,
        goal: body.goal,
        options: body.options ?? {},
        tenantIdentity,
        gatewayService,
        agentId: body.agentId,
        requestExecutionSignal: requestExecution?.signal ?? null,
      });
      if (execution.approval) {
        writeJson(response, 202, createOkEnvelope(execution.approval, { startedAt }));
        return;
      }
      if (execution.error) {
        return fail(execution.error.status, execution.error.code, execution.error.message);
      }
      const result = execution.result;
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        return fail(502, "FORGE_GOVERNED_RESULT_INVALID", "Forge returned an invalid governed result envelope.");
      }
      if (!result.ok && result.code === "FORGE_INPUT_INVALID") {
        return fail(400, result.code, result.reason ?? "goal is required.");
      }
      writeJson(response, result.ok ? 200 : 422, createOkEnvelope(result, { startedAt }));
    },
    "/forge/memory": async (body) => {
      if (body.action === "remember") {
        const result = forge.memoryRemember({
          content: body.content,
          metadata: body.metadata ?? {},
          tenantIdentity,
        });
        if (!result.ok) return fail(400, result.code, result.reason ?? "remember failed.");
        writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        return;
      }
      if (body.action === "recall" || body.action === "search") {
        const result = forge.memoryRecall({
          query: body.query,
          limit: body.limit,
          tenantIdentity,
        });
        if (!result.ok) return fail(400, result.code, result.reason ?? "recall failed.");
        writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        return;
      }
      fail(400, "FORGE_MEMORY_ACTION_INVALID", "action must be 'remember' or 'recall'.");
    },
  };

  const handler = postHandlers[url.pathname.replace(/\/+$/, "")];
  if (!handler) {
    if (isForgeRoute(url.pathname)) {
      writeJson(response, 404, createErrorEnvelope("forge_route_not_found", `No forge route for ${request.method} ${url.pathname}`, { startedAt, category: "routing" }));
      return;
    }
    return ROUTE_NOT_HANDLED;
  }
  if (request.method !== "POST") {
    writeJson(response, 405, createErrorEnvelope("method_not_allowed", `Only POST is supported for ${url.pathname}.`, { startedAt, category: "routing" }));
    return;
  }

  return (async () => {
    let body;
    try {
      body = await readJson(request);
    } catch {
      return fail(400, "invalid_json", "Request body must be valid JSON.");
    }
    await handler(body ?? {});
  })();
}
