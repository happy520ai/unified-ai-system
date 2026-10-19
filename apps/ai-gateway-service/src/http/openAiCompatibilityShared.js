// =============================================================================
// openAiCompatibilityShared.js — OpenAI/Anthropic 兼容路由共享的底层助手
//
// 从 openAiCompatibilityRoutes.js 机械拆出（T-073 延续）：两个协议家族共用的
// 常量与纯助手放这里，anthropicMessagesRoutes.js 与 openAiCompatibilityRoutes.js
// 都从这里导入，避免循环导入。行为不变。
// =============================================================================

import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { MANAGED_LOCAL_CLIENT_PROVIDER_PIN } from "../core/gatewayService.js";
import { createLocalClientProviderDispatchBinding } from "../routing/localClientProviderDispatchBinding.ts";
import { getChatResponseCacheIntegration, readChatCacheBillingSnapshot } from "../cache/chatResponseCacheIntegration.ts";
import { captureGuardrailsOutputPolicy, getGuardrailsEngine, inspectGuardrailsOutputStream, inspectGuardrailsInputLimits, consumeGuardrailsGeneratedEmptyText } from "../guardrails/guardrailsEngine.ts";
import { resolveProviderDispatchHttpStatus } from "./providerDispatchHttpStatus.ts";
import {
  closePrimedGatewayStream,
  iteratePrimedGatewayStream,
  primeGatewayStream,
  readPrimedGatewayStreamError,
  resolveGatewayStreamPreflightStatus,
} from "./gatewayStreamPreflight.ts";
import { estimateTextTokens, estimateTokens } from "../cost/tokenEstimator.js";
import { bindVirtualKeyRequestAccounting, createVirtualKeyRequestAccounting, getVirtualKeyRequestAccounting } from "../enterprise/virtualKeyRequestAccounting.ts";
import { getVirtualKeyBillingSnapshot } from "../core/virtualKeyUsageAccounting.ts";
import {
  recordChatCacheEvent,
  recordChatRequest,
  recordChatTokens,
  recordChatTtft,
  recordChatVirtualKeyRejection,
  recordGuardrailEvaluation,
  recordGuardrailFinding,
} from "../observability/aiMetrics.ts";
import { getLangfuseCallback } from "../observability/langfuseCallback.ts";
import { applyPromptEnhancement } from "./utils/chatUtils.js";
import { injectRagContextIntoGatewayInput } from "./utils/ragInjection.js";
import {
  takeRawJsonRequestBody,
  readJson,
  writeJson,
  writeSseHeaders,
} from "./utils/responseUtils.js";
import {
  getMessageImageStats,
  inspectInlineImageDataUrl,
} from "@unified-ai-system/shared-utils";

export const CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
export const COMPLETIONS_PATH = "/v1/completions";
export const RESPONSES_PATH = "/v1/responses";
export const ANTHROPIC_MESSAGES_PATH = "/v1/messages";
export const MODELS_PATH = "/v1/models";
export const ENGINES_PATH = "/v1/engines";
export const CHAT_COMPLETIONS_PATH_ALIAS = "/chat/completions";
export const COMPLETIONS_PATH_ALIAS = "/completions";
export const RESPONSES_PATH_ALIAS = "/responses";
export const MODELS_PATH_ALIAS = "/models";
export const ENGINES_PATH_ALIAS = "/engines";
export const OPENAI_AZURE_CHAT_COMPLETIONS = /^\/openai\/deployments\/([^/]+)\/chat\/completions\/?$/;
export const OPENAI_AZURE_COMPLETIONS = /^\/openai\/deployments\/([^/]+)\/completions\/?$/;
export const OPENAI_AZURE_RESPONSES = /^\/openai\/deployments\/([^/]+)\/responses\/?$/;
export const OPENAI_MODELS_ID = /^\/v1\/models\/([^/]+)\/?$/;
export const OPENAI_ENGINES_ID = /^\/v1\/engines\/([^/]+)\/?$/;
export const OPENAI_ENGINE_CHAT_COMPLETIONS = /^\/v1\/engines\/([^/]+)\/chat\/completions\/?$/;
export const OPENAI_ENGINE_COMPLETIONS = /^\/v1\/engines\/([^/]+)\/completions\/?$/;
export const OPENAI_MODELS_ID_ALIAS = /^\/models\/([^/]+)\/?$/;
export const OPENAI_ENGINES_ID_ALIAS = /^\/engines\/([^/]+)\/?$/;

// n（并行候选数）上限：保护无凭证 fake lane 不被 n 放大成拒绝服务向量。
export const MAX_CHOICE_COUNT = 8;

export function normalizeChoiceCount(value) {
  if (value === undefined || value === null) return 1;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_CHOICE_COUNT) {
    throw createUnsupportedError(`n must be an integer between 1 and ${MAX_CHOICE_COUNT}.`, "n");
  }
  return count;
}

/** Apply only the final text budget, after separators/system/prompt context exist. */
export function applyNormalizedGuardrailsInputLimit(gatewayInput, engine, priorFindings) {
  const verdict = inspectGuardrailsInputLimits({ messages: gatewayInput.messages }, engine.readConfig());
  if (verdict.findings.length && !priorFindings.some(finding => finding.rule === "input.limits")) {
    recordGuardrailEvaluation("input", verdict.decision);
    for (const finding of verdict.findings) recordGuardrailFinding(finding.rule, finding.action);
  }
  for (const replacement of verdict.replacements) gatewayInput.messages[replacement.index].content = replacement.content;
  return verdict.decision !== "block";
}

export function createOpenAiError(error = {}) {
  const category = error.category ?? error.type ?? "internal";
  const type = category === "auth"
    ? "authentication_error"
    : category === "validation" || category === "routing"
      ? "invalid_request_error"
      : category === "rate_limit"
        ? "rate_limit_error"
        : "api_error";

  return {
    error: {
      message: typeof error.message === "string" ? error.message : "Gateway request failed.",
      type,
      param: error.param ?? null,
      code: error.code ?? "gateway_error",
    },
  };
}

export function resolveVirtualKeyRequestAccounting({ enterpriseGovernanceService, request, writeServiceLog, path = "/" }) {
  const fingerprint = request?.enterpriseIdentity?.apiKeyFingerprint;
  if (!fingerprint) return undefined;
  const existing = getVirtualKeyRequestAccounting(request);
  if (existing) return existing;
  const manager = enterpriseGovernanceService?.getApiKeyManager?.();
  if (typeof enterpriseGovernanceService?.recordAudit !== "function" && typeof writeServiceLog !== "function") {
    throw new Error("Virtual key accounting audit is unavailable.");
  }
  const identity = request.enterpriseIdentity;
  const scope = createVirtualKeyRequestAccounting({ manager, keyFingerprint: fingerprint,
    onEvent: async (event) => {
      const usage = event.softBudgetExceeded ? manager.describeUsage({ keyId: fingerprint })?.usage : undefined;
      try {
        await enterpriseGovernanceService.recordAudit?.({ identity, method: "POST", path,
          permission: "chat:use", outcome: event.state, code: "VIRTUAL_KEY_USAGE_SETTLED", details: event });
      } catch {
        writeServiceLog?.("virtual_key_accounting_failed", { path, keyFingerprint: fingerprint, code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" });
        throw new Error("Virtual key accounting audit is unavailable.");
      }
      writeServiceLog?.("virtual_key_usage_settled", { path, ...event });
      if (event.state === "recorded" && (event.source === "reported" || event.source === "estimated")) {
        writeServiceLog?.("virtual_key_usage_recorded", { path, keyFingerprint: fingerprint,
          tokens: event.tokens, calculationSource: event.source });
      }
      if (event.softBudgetExceeded) writeServiceLog?.("virtual_key_soft_budget", { path, keyFingerprint: fingerprint,
        tokensUsed: usage?.tokensUsed ?? null, limitTokens: usage?.limitTokens ?? null });
    } });
  bindVirtualKeyRequestAccounting(request, scope);
  return scope;
}

export function authorizeVirtualKeyRequest({ enterpriseGovernanceService, request, writeServiceLog, path, estimatedTokens }) {
  const scope = resolveVirtualKeyRequestAccounting({ enterpriseGovernanceService, request, writeServiceLog, path });
  if (!scope) return undefined;
  const first = scope.admit(estimatedTokens);
  return first.allowed ? enterpriseGovernanceService.getApiKeyManager().checkContinuation({
    keyId: request.enterpriseIdentity.apiKeyFingerprint, estimatedTokens,
  }) : first;
}

export function applyVirtualKeyRequestGate({
  enterpriseGovernanceService,
  request,
  gatewayInput,
  response,
  writeServiceLog,
  startedAt,
  path = CHAT_COMPLETIONS_PATH,
  errorFactory = /** @type {(error: {code: string, category: string, message: string}) => object} */ (createOpenAiError),
  estimatedInputTokens: aggregateInputEstimate = /** @type {number | undefined} */ (undefined),
}) {
  const fingerprint = request?.enterpriseIdentity?.apiKeyFingerprint;
  if (!fingerprint) return false;
  const estimatedInputTokens = aggregateInputEstimate ?? estimateTokens(gatewayInput).estimatedInputTokens;
  let decision;
  try {
    if (!Number.isSafeInteger(estimatedInputTokens) || estimatedInputTokens < 0) throw new Error("Invalid accounting estimate.");
    decision = authorizeVirtualKeyRequest({ enterpriseGovernanceService, request, writeServiceLog,
      path, estimatedTokens: estimatedInputTokens });
  } catch {
    writeJson(response, 503, errorFactory({ code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE", category: "internal", message: "Virtual key accounting is unavailable." }));
    return true;
  }
  if (decision.allowed) return false;

  writeServiceLog?.("virtual_key_rejected", {
    path,
    code: decision.code,
    keyFingerprint: fingerprint,
    durationMs: Date.now() - startedAt,
  });
  recordChatVirtualKeyRejection(decision.code);
  writeJson(response, 429, errorFactory({
    code: decision.code,
    category: "rate_limit",
    message: decision.code === "VIRTUAL_KEY_RATE_LIMITED"
      ? "Virtual key request rate limit exceeded; retry later."
      : "Virtual key token budget exhausted for the current window.",
  }));
  return true;
}

export async function recordCachedVirtualKeyUsage({
  enterpriseGovernanceService,
  request,
  writeServiceLog,
  billingSnapshot,
  path = CHAT_COMPLETIONS_PATH,
}) {
  const scope = resolveVirtualKeyRequestAccounting({ enterpriseGovernanceService, request, writeServiceLog, path });
  if (!scope) return;
  const snapshot = readChatCacheBillingSnapshot({ billing: billingSnapshot });
  if (!snapshot) throw Object.assign(new Error("Cached virtual key accounting is unavailable."),
    { code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE", category: "internal", retryable: false });
  // The full cached cost is already known before any response bytes are sent.
  const invocation = scope.beginInvocation(snapshot.totalTokens);
  await scope.settle(invocation, { tokens: snapshot.totalTokens, source: snapshot.source, incomplete: false });
}

export function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function estimateCompatibilityTokens(text) {
  return Math.max(1, Math.ceil(String(text).length / 4));
}

export const MANAGED_LOCAL_CLIENT_PROTOCOL_ID_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;

export async function authenticateManagedLocalClientProtocolRequest({
  application,
  request,
  url,
  requestBody,
}) {
  const extension = isRecord(requestBody?.unified_ai) ? requestBody.unified_ai : null;
  const rawClientId = extension?.local_client_id;
  const proofHeader = request.headers?.["x-ai-gateway-local-client-proof"];
  const clientRequested = rawClientId !== undefined;
  const proofSupplied = proofHeader !== undefined;
  const rawBody = proofSupplied ? takeRawJsonRequestBody(request) : null;
  const disconnected = () => request.aborted === true || request.socket?.destroyed === true;
  try {
    const serverBinding = application?.localClientProtocolPrincipalResolver?.resolve?.(
      request.enterpriseIdentity,
    ) ?? null;
    if (!serverBinding) {
      if (!clientRequested && !proofSupplied) return null;
      throw createManagedLocalClientAuthError();
    }
    if (
      !clientRequested
      || !proofSupplied
      || typeof rawClientId !== "string"
      || !MANAGED_LOCAL_CLIENT_PROTOCOL_ID_PATTERN.test(rawClientId)
      || rawClientId !== serverBinding.clientId
      || !application?.localClientPopHttpAuth
      || disconnected()
    ) {
      throw createManagedLocalClientAuthError();
    }
    // The authenticated server binding chooses the client before any native
    // bootstrap/refresh. The existing complete dispatch gate still follows it.
    if (application.localClientPopIdentityAuthority?.prepareReplayProtection) {
      const prepared = await application.localClientPopIdentityAuthority.prepareReplayProtection({
        tenantId: request.enterpriseIdentity?.tenantId, clientId: serverBinding.clientId,
      });
      if (!prepared || disconnected()) throw createManagedLocalClientAuthError();
    }
    if (application?.localClientManagedProtocolDispatchStatus?.ready !== true) throw createManagedLocalClientAuthError();
    const principal = await application.localClientPopHttpAuth.authenticate({
      authenticatedScope: {
        tenantId: request.enterpriseIdentity?.tenantId,
        subjectId: request.enterpriseIdentity?.userId,
      },
      clientId: serverBinding.clientId,
      method: request.method,
      canonicalPathWithQuery: `${url.pathname}${url.search}`,
      rawBody,
      proofHeader,
    });
    if (disconnected()) throw createManagedLocalClientAuthError();
    return principal;
  } finally {
    rawBody?.fill(0);
  }
}

export async function resolveManagedLocalClientProviderRoute({ application, principal, gatewayInput }) {
  const runtimeRouter = application?.localClientProviderRuntimeRouter;
  if (!runtimeRouter || principal?.verified !== true) throw createManagedLocalClientAuthError();
  const decision = await runtimeRouter.route({
    tenantId: principal.identity.tenantId,
    subjectId: principal.identity.subjectId,
    clientId: principal.identity.clientId,
    expectedClientRevision: principal.identity.clientRevision,
    requiredCapabilities: [...new Set(["chat", ...(gatewayInput.requiredCapabilities ?? [])])],
    requestedFanout: 1,
    fusionRequested: false,
  });
  try {
    return createLocalClientProviderDispatchBinding({
      popVerification: principal,
      runtimeDecision: decision,
    });
  } catch {
    throw createManagedLocalClientRouteError(
      "LOCAL_CLIENT_PROVIDER_ROUTE_DENIED",
      "No provider route satisfies the authenticated managed-client policy.",
    );
  }
}

export function applyManagedLocalClientProviderRoute(gatewayInput, route) {
  return {
    ...gatewayInput,
    [MANAGED_LOCAL_CLIENT_PROVIDER_PIN]: route,
    providerId: route.providerId,
    model: route.modelId,
    metadata: {
      ...(gatewayInput.metadata ?? {}),
      managedLocalClientProviderRouting: Object.freeze({
        applied: true,
        providerPinned: true,
        modelPinned: true,
        clientId: route.clientId,
        clientRevision: route.clientRevision,
        policyRevision: route.policyRevision,
        decisionDigest: route.decisionDigest,
      }),
    },
  };
}

export function createManagedLocalClientAuthError() {
  const error = new Error("Managed local-client proof authorization failed.");
  error.code = "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED";
  error.category = "auth";
  error.status = 401;
  error.retryable = false;
  return error;
}

export function createManagedLocalClientRouteError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.category = "routing";
  error.status = 409;
  error.retryable = false;
  return error;
}

export function normalizeUnifiedAiExtension(body) {
  if (
    body.unified_ai !== undefined
    && (!body.unified_ai || typeof body.unified_ai !== "object" || Array.isArray(body.unified_ai))
  ) {
    throw createValidationError("unified_ai must be an options object.", "unified_ai");
  }
  const extension = body.unified_ai ?? {};
  const providerId = extension.provider_id ?? body.provider_id;
  if (providerId !== undefined && (typeof providerId !== "string" || !providerId.trim())) {
    throw createValidationError("provider_id must be a non-empty string.", "unified_ai.provider_id");
  }
  const rag = normalizeUnifiedAiRag(extension.rag);

  const rawEnhancement = extension.prompt_enhancement ?? body.prompt_enhancement;
  if (rawEnhancement === undefined || rawEnhancement === false) {
    return { providerId: providerId?.trim(), ...(rag ? { rag } : {}) };
  }
  if (rawEnhancement === true) {
    return { providerId: providerId?.trim(), promptEnhancement: { enabled: true }, ...(rag ? { rag } : {}) };
  }
  if (!rawEnhancement || typeof rawEnhancement !== "object" || Array.isArray(rawEnhancement)) {
    throw createValidationError(
      "prompt_enhancement must be a boolean or an options object.",
      "unified_ai.prompt_enhancement",
    );
  }

  return {
    providerId: providerId?.trim(),
    promptEnhancement: {
      enabled: rawEnhancement.enabled !== false,
      profile: rawEnhancement.profile,
      language: rawEnhancement.language,
    },
    ...(rag ? { rag } : {}),
  };
}

// unified_ai.rag：显式 opt-in 的知识库检索注入（默认关闭）。
export function normalizeUnifiedAiRag(rawRag) {
  if (rawRag === undefined || rawRag === false || rawRag === null) return null;
  if (rawRag === true) return { enabled: true };
  if (typeof rawRag !== "object" || Array.isArray(rawRag)) {
    throw createValidationError("rag must be a boolean or an options object.", "unified_ai.rag");
  }
  const enabled = rawRag.enabled !== false;
  let topK;
  if (rawRag.topK !== undefined) {
    topK = Number(rawRag.topK);
    if (!Number.isInteger(topK) || topK < 1 || topK > 10) {
      throw createValidationError("rag.topK must be an integer between 1 and 10.", "unified_ai.rag.topK");
    }
  }
  let sourceIds;
  if (rawRag.sourceIds !== undefined) {
    if (!Array.isArray(rawRag.sourceIds)
      || rawRag.sourceIds.some((id) => typeof id !== "string" || !id)) {
      throw createValidationError(
        "rag.sourceIds must be an array of non-empty strings.",
        "unified_ai.rag.sourceIds",
      );
    }
    sourceIds = [...rawRag.sourceIds];
  }
  return {
    enabled,
    ...(topK !== undefined ? { topK } : {}),
    ...(sourceIds ? { sourceIds } : {}),
  };
}

// 按 descriptors 数组引用 memo(注册表返回冻结缓存数组,引用稳定)。
const modelTargetMemo = new WeakMap();
export const modelListMemo = new WeakMap();
export function resolveOpenAiModelTarget(requestedModel, descriptors) {
  let entry = modelTargetMemo.get(descriptors);
  if (!entry) {
    const available = listAvailableModels(descriptors);
    const counts = new Map();
    for (const item of available) {
      counts.set(item.model.id, (counts.get(item.model.id) ?? 0) + 1);
    }
    entry = { available, counts };
    modelTargetMemo.set(descriptors, entry);
  }
  const { available, counts } = entry;

  const exposedMatch = available.find(({ descriptor, model }) => {
    const exposedId = counts.get(model.id) > 1 ? `${descriptor.id}/${model.id}` : model.id;
    return exposedId === requestedModel;
  });
  if (exposedMatch) {
    return {
      providerId: exposedMatch.descriptor.id,
      modelId: exposedMatch.model.id,
    };
  }

  const exactMatches = available.filter(({ model }) => model.id === requestedModel);
  if (exactMatches.length === 1) {
    return {
      providerId: exactMatches[0].descriptor.id,
      modelId: exactMatches[0].model.id,
    };
  }

  return { modelId: requestedModel };
}

export function resolveOpenAiCompletionModel(bodyModel) {
  return readRequiredString(bodyModel, "model");
}

export function buildModelRows(descriptors) {
  const available = listAvailableModels(descriptors);
  const counts = new Map();
  for (const item of available) {
    counts.set(item.model.id, (counts.get(item.model.id) ?? 0) + 1);
  }
  return { available, counts };
}

export function listAvailableModels(descriptors) {
  return descriptors.flatMap((descriptor) => (descriptor.models ?? [])
    .filter((model) => model.enabled !== false)
    .map((model) => ({ descriptor, model })));
}

export function createUnifiedAiMetadata(data, meta, promptEnhancement) {
  return {
    request_id: meta?.requestId ?? data.id ?? data.requestId ?? null,
    selected_provider: data.selectedProvider ?? null,
    selected_model: data.selectedModel ?? data.model ?? null,
    execution_mode: data.executionMode ?? null,
    execution_status: data.executionStatus ?? null,
    ...(promptEnhancement ? { prompt_enhancement: promptEnhancement } : {}),
  };
}

export function normalizeFinishReason(value) {
  if (value === "length") return "length";
  if (value === "filtered") return "content_filter";
  if (value === "tool_call" || value === "tool_calls") return "tool_calls";
  return "stop";
}

export function writeOpenAiSseData(response, data) {
  if (!response.writableEnded && !response.destroyed) {
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

export function resolveOpenAiErrorStatus(error) {
  if (error?.code === "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE") return 503;
  if (typeof error?.status === "number" && error.status >= 400 && error.status < 500) {
    return error.status;
  }
  const providerDispatchStatus = resolveProviderDispatchHttpStatus(error?.code);
  if (providerDispatchStatus !== null) return providerDispatchStatus;
  const category = error?.category ?? error?.type;
  if (category === "validation" || category === "routing") return 400;
  if (category === "auth") return 401;
  if (category === "rate_limit") return 429;
  return 502;
}

export function validateOptionalBoolean(value, param) {
  if (value !== undefined && typeof value !== "boolean") {
    throw createValidationError(`${param} must be a boolean.`, param);
  }
}

export function readRequiredString(value, param) {
  if (typeof value !== "string" || !value.trim()) {
    throw createValidationError(`${param} must be a non-empty string.`, param);
  }
  return value.trim();
}

export function readNumberInRange(value, param, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw createValidationError(`${param} must be between ${min} and ${max}.`, param);
  }
  return value;
}

export function createValidationError(message, param) {
  const error = new Error(message);
  error.code = "invalid_request";
  error.category = "validation";
  error.param = param;
  return error;
}

export function createUnsupportedError(message, param) {
  const error = createValidationError(message, param);
  error.code = "unsupported_parameter";
  return error;
}
