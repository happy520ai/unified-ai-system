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

import {
  ANTHROPIC_MESSAGES_PATH,
  CHAT_COMPLETIONS_PATH,
  CHAT_COMPLETIONS_PATH_ALIAS,
  COMPLETIONS_PATH,
  COMPLETIONS_PATH_ALIAS,
  ENGINES_PATH,
  ENGINES_PATH_ALIAS,
  MODELS_PATH,
  MODELS_PATH_ALIAS,
  OPENAI_AZURE_CHAT_COMPLETIONS,
  OPENAI_AZURE_COMPLETIONS,
  OPENAI_AZURE_RESPONSES,
  OPENAI_ENGINES_ID,
  OPENAI_ENGINES_ID_ALIAS,
  OPENAI_ENGINE_CHAT_COMPLETIONS,
  OPENAI_ENGINE_COMPLETIONS,
  OPENAI_MODELS_ID,
  OPENAI_MODELS_ID_ALIAS,
  RESPONSES_PATH,
  RESPONSES_PATH_ALIAS,
  applyManagedLocalClientProviderRoute,
  applyNormalizedGuardrailsInputLimit,
  applyVirtualKeyRequestGate,
  authenticateManagedLocalClientProtocolRequest,
  buildModelRows,
  createManagedLocalClientRouteError,
  createOpenAiError,
  createUnifiedAiMetadata,
  createUnsupportedError,
  createValidationError,
  estimateCompatibilityTokens,
  isRecord,
  listAvailableModels,
  modelListMemo,
  normalizeChoiceCount,
  normalizeFinishReason,
  readNumberInRange,
  readRequiredString,
  resolveManagedLocalClientProviderRoute,
  resolveOpenAiCompletionModel,
  resolveOpenAiErrorStatus,
  resolveOpenAiModelTarget,
  validateOptionalBoolean,
  writeOpenAiSseData,
  normalizeUnifiedAiExtension,
  normalizeUnifiedAiRag,
  recordCachedVirtualKeyUsage,
} from "./openAiCompatibilityShared.js";
import {
  handleAnthropicMessages,
} from "./anthropicMessagesRoutes.js";

const UNSUPPORTED_FIELDS = Object.freeze([
  ["functions", (value) => value === null || (Array.isArray(value) && value.length === 0)],
  ["function_call", (value) => value === null || value === "none"],
  ["modalities", (value) => value === null || (Array.isArray(value) && value.length === 1 && value[0] === "text")],
  ["audio", (value) => value === null],
  ["prediction", (value) => value === null],
  ["reasoning_effort", (value) => value === null],
  ["seed", (value) => value === null],
  ["logit_bias", (value) => value === null],
  ["service_tier", (value) => value === null],
  ["store", (value) => value === null || value === false],
  ["metadata", (value) => value === null],
  ["web_search_options", (value) => value === null],
  ["verbosity", (value) => value === null],
  ["presence_penalty", (value) => value === null || value === 0],
  ["frequency_penalty", (value) => value === null || value === 0],
  ["logprobs", (value) => value === null || value === false],
  ["top_logprobs", (value) => value === null],
]);

const COMPLETIONS_UNSUPPORTED_FIELDS = Object.freeze([
  ["best_of", (value) => value === 1],
  ["echo", (value) => value === false],
  ["logprobs", (value) => value === null || value === 0],
  ["suffix", () => false],
  ["user", () => false],
  ["seed", () => false],
]);

function normalizeOpenAiPath(pathname) {
  const path = typeof pathname === "string" ? pathname : "";
  const noTrailingSlash = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const safeDecode = decodePathComponent;

  const azureChatMatch = noTrailingSlash.match(OPENAI_AZURE_CHAT_COMPLETIONS);
  if (azureChatMatch) {
    return { path: CHAT_COMPLETIONS_PATH, modelFromPath: azureChatMatch[1], isOpenAi: true };
  }

  const azureCompletionsMatch = noTrailingSlash.match(OPENAI_AZURE_COMPLETIONS);
  if (azureCompletionsMatch) {
    return { path: COMPLETIONS_PATH, modelFromPath: azureCompletionsMatch[1], isOpenAi: true };
  }

  const azureResponsesMatch = noTrailingSlash.match(OPENAI_AZURE_RESPONSES);
  if (azureResponsesMatch) {
    return { path: RESPONSES_PATH, modelFromPath: azureResponsesMatch[1], isOpenAi: true };
  }

  const modelsIdMatch = noTrailingSlash.match(OPENAI_MODELS_ID);
  if (modelsIdMatch) {
    return {
      path: `${MODELS_PATH}/${safeDecode(modelsIdMatch[1])}`,
      modelFromPath: safeDecode(modelsIdMatch[1]),
      resourceType: "model",
      isOpenAi: true,
    };
  }

  const enginesIdMatch = noTrailingSlash.match(OPENAI_ENGINES_ID);
  if (enginesIdMatch) {
    return {
      path: `${ENGINES_PATH}/${safeDecode(enginesIdMatch[1])}`,
      modelFromPath: safeDecode(enginesIdMatch[1]),
      resourceType: "engine",
      isOpenAi: true,
    };
  }

  const engineChatMatch = noTrailingSlash.match(OPENAI_ENGINE_CHAT_COMPLETIONS);
  if (engineChatMatch) {
    return { path: CHAT_COMPLETIONS_PATH, modelFromPath: engineChatMatch[1], isOpenAi: true };
  }

  const engineCompletionsMatch = noTrailingSlash.match(OPENAI_ENGINE_COMPLETIONS);
  if (engineCompletionsMatch) {
    return { path: COMPLETIONS_PATH, modelFromPath: engineCompletionsMatch[1], isOpenAi: true };
  }

  const modelsAliasMatch = noTrailingSlash.match(OPENAI_MODELS_ID_ALIAS);
  if (modelsAliasMatch) {
    return {
      path: `${MODELS_PATH}/${safeDecode(modelsAliasMatch[1])}`,
      modelFromPath: safeDecode(modelsAliasMatch[1]),
      resourceType: "model",
      isOpenAi: true,
    };
  }

  const enginesAliasMatch = noTrailingSlash.match(OPENAI_ENGINES_ID_ALIAS);
  if (enginesAliasMatch) {
    return {
      path: `${ENGINES_PATH}/${safeDecode(enginesAliasMatch[1])}`,
      modelFromPath: safeDecode(enginesAliasMatch[1]),
      resourceType: "engine",
      isOpenAi: true,
    };
  }

  if (noTrailingSlash === "/v1" || noTrailingSlash.startsWith("/v1/")) {
    return { path: noTrailingSlash, isOpenAi: true };
  }
  if (noTrailingSlash === CHAT_COMPLETIONS_PATH_ALIAS) {
    return { path: CHAT_COMPLETIONS_PATH, isOpenAi: true };
  }
  if (noTrailingSlash === COMPLETIONS_PATH_ALIAS) {
    return { path: COMPLETIONS_PATH, isOpenAi: true };
  }
  if (noTrailingSlash === RESPONSES_PATH_ALIAS) {
    return { path: RESPONSES_PATH, isOpenAi: true };
  }
  if (noTrailingSlash === MODELS_PATH_ALIAS) {
    return { path: MODELS_PATH, isOpenAi: true };
  }
  if (noTrailingSlash === ENGINES_PATH_ALIAS) {
    return { path: ENGINES_PATH, isOpenAi: true };
  }

  return { path: noTrailingSlash, isOpenAi: false };
}

function decodePathComponent(value) {
  if (typeof value !== "string") return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isOpenAiCompatibilityRoute(pathname) {
  return normalizeOpenAiPath(pathname).isOpenAi;
}

export function isAnthropicMessagesRoute(pathname) {
  if (typeof pathname !== "string") return false;
  return pathname.replace(/\/+$/, "") === ANTHROPIC_MESSAGES_PATH;
}

export async function dispatchOpenAiCompatibilityRoutes(context) {
  const {
    gatewayService,
    request,
    response,
    startedAt,
    url,
    writeServiceLog,
    enterpriseGovernanceService,
    knowledgeService,
    application,
  } = context;
  const normalized = normalizeOpenAiPath(url.pathname);
  const normalizedPath = normalized.path;

  if (request.method === "GET" && normalizedPath === MODELS_PATH) {
    const models = createOpenAiModelList(gatewayService.getProviderDescriptors(), startedAt);
    writeServiceLog?.("openai_models_listed", {
      method: request.method,
      path: normalizedPath,
      modelCount: models.data.length,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 200, models);
    return;
  }

  if (request.method === "GET" && normalizedPath === ENGINES_PATH) {
    const engines = createOpenAiEngineList(gatewayService.getProviderDescriptors(), startedAt);
    writeServiceLog?.("openai_engines_listed", {
      method: request.method,
      path: normalizedPath,
      modelCount: engines.data.length,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 200, engines);
    return;
  }

  if (request.method === "GET" && normalizedPath.startsWith(`${MODELS_PATH}/`)) {
    const descriptors = gatewayService.getProviderDescriptors();
    const model = resolveOpenAiModelResource(normalized.modelFromPath ?? "", descriptors);
    if (!model) {
      writeJson(response, 404, createOpenAiResourceNotFoundError("model", normalized.modelFromPath));
      return;
    }
    const modelDetail = createOpenAiModelDetail(model, startedAt, normalized.modelFromPath);
    writeServiceLog?.("openai_model_retrieved", {
      method: request.method,
      path: normalizedPath,
      model: model.model.id,
      provider: model.descriptor.id,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 200, modelDetail);
    return;
  }

  if (request.method === "GET" && normalizedPath.startsWith(`${ENGINES_PATH}/`)) {
    const descriptors = gatewayService.getProviderDescriptors();
    const model = resolveOpenAiModelResource(normalized.modelFromPath ?? "", descriptors);
    if (!model) {
      writeJson(response, 404, createOpenAiResourceNotFoundError("engine", normalized.modelFromPath));
      return;
    }
    const engineDetail = createOpenAiEngineDetail(model, startedAt, normalized.modelFromPath);
    writeServiceLog?.("openai_engine_retrieved", {
      method: request.method,
      path: normalizedPath,
      model: model.model.id,
      provider: model.descriptor.id,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 200, engineDetail);
    return;
  }

  if (request.method === "POST" && normalizedPath === ANTHROPIC_MESSAGES_PATH) {
    await handleAnthropicMessages({
      gatewayService,
      enterpriseGovernanceService,
      application,
      request,
      response,
      startedAt,
      writeServiceLog,
      url,
    });
    return;
  }

  if (normalizedPath === ANTHROPIC_MESSAGES_PATH) {
    writeJson(response, 405, createAnthropicError({
      code: "method_not_allowed",
      category: "validation",
      message: "Only POST is supported for /v1/messages.",
    }));
    return;
  }

  if (request.method === "POST" && normalizedPath === CHAT_COMPLETIONS_PATH) {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(response, 400, createOpenAiError({
        code: "invalid_json",
        category: "validation",
        message: "Request body must be valid JSON.",
      }));
      return;
    }

    const requestBody = {
      ...(typeof body === "object" && body !== null ? body : null),
      ...(normalized.modelFromPath && !body?.model ? { model: normalized.modelFromPath } : {}),
    };
    let managedLocalClientPrincipal = null;
    try {
      managedLocalClientPrincipal = await authenticateManagedLocalClientProtocolRequest({
        application,
        request,
        url,
        requestBody,
      });
    } catch (error) {
      writeServiceLog?.("managed_local_client_protocol_auth_failed", {
        method: request.method,
        path: normalizedPath,
        code: error?.code ?? "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED",
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, resolveOpenAiErrorStatus(error), createOpenAiError(error));
      return;
    }

    // Guardrails（确定性本地扫描）：在 normalize 之前作用于原始请求——
    // 拦截/脱敏同时覆盖 JSON、SSE 与缓存路径（脱敏后的文本进入缓存键）。
    const guardrailsEngine = getGuardrailsEngine(request.enterpriseIdentity?.tenantId);
    const outputPolicy = captureGuardrailsOutputPolicy(guardrailsEngine);
    const guardrailInputVerdict = guardrailsEngine.inspectInput(requestBody);
    if (guardrailInputVerdict.decision === "block") {
      recordGuardrailEvaluation("input", "block");
      for (const finding of guardrailInputVerdict.findings) {
        if (finding.action === "block") recordGuardrailFinding(finding.rule, finding.action);
      }
      writeServiceLog?.("openai_chat_guardrail_blocked", {
        method: request.method,
        path: normalizedPath,
        findings: guardrailInputVerdict.findings,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 400, createOpenAiError({
        code: "guardrail_blocked",
        category: "governance",
        message: "Request blocked by chat guardrails.",
        param: "messages",
      }));
      return;
    }
    if (guardrailInputVerdict.findings.length) {
      recordGuardrailEvaluation("input", "allow");
      for (const finding of guardrailInputVerdict.findings) {
        recordGuardrailFinding(finding.rule, finding.action);
      }
      writeServiceLog?.("openai_chat_guardrail_findings", {
        method: request.method,
        path: normalizedPath,
        findings: guardrailInputVerdict.findings,
        durationMs: Date.now() - startedAt,
      });
    }
    for (const replacement of guardrailInputVerdict.replacements) {
      if (requestBody.messages?.[replacement.index]) {
        requestBody.messages[replacement.index].content = replacement.content;
      }
    }

    let gatewayInput;
    try {
      gatewayInput = normalizeOpenAiChatCompletionRequest(
        requestBody,
        gatewayService.getProviderDescriptors(),
      );
    } catch (error) {
      writeServiceLog?.("openai_chat_validation_failed", {
        method: request.method,
        path: normalizedPath,
        code: error?.code,
        param: error?.param,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 400, createOpenAiError(error));
      return;
    }

    let managedLocalClientRoute = null;
    if (managedLocalClientPrincipal) {
      try {
        managedLocalClientRoute = await resolveManagedLocalClientProviderRoute({
          application,
          principal: managedLocalClientPrincipal,
          gatewayInput,
        });
        gatewayInput = applyManagedLocalClientProviderRoute(gatewayInput, managedLocalClientRoute);
        response.setHeader("X-AI-Gateway-Local-Client-Routing", "policy-pinned");
        response.setHeader("X-AI-Gateway-Local-Client-Policy-Revision", managedLocalClientRoute.policyRevision);
        response.setHeader("X-AI-Gateway-Local-Client-Revision", String(managedLocalClientPrincipal.identity.clientRevision));
        response.setHeader("X-AI-Gateway-Local-Client-Decision-Digest", managedLocalClientRoute.decisionDigest);
      } catch (error) {
        writeServiceLog?.("managed_local_client_provider_route_failed", {
          method: request.method,
          path: normalizedPath,
          code: error?.code ?? "LOCAL_CLIENT_PROVIDER_ROUTE_DENIED",
          durationMs: Date.now() - startedAt,
        });
        writeJson(response, resolveOpenAiErrorStatus(error), createOpenAiError(error));
        return;
      }
    }

    // RAG（显式 opt-in）：注入租户可见的知识库上下文；失败 fail-open。
    const ragConfig = gatewayInput.metadata?.openAiCompatibility?.rag;
    if (ragConfig?.enabled === true) {
      const ragOutcome = await injectRagContextIntoGatewayInput({
        gatewayInput,
        knowledgeService,
        tenantScopeIdentity: request.enterpriseIdentity,
        ragConfig,
      });
      writeServiceLog?.(ragOutcome.applied ? "openai_chat_rag_injected" : "openai_chat_rag_skipped", {
        method: request.method,
        path: normalizedPath,
        reason: ragOutcome.reason ?? null,
        chunkCount: ragOutcome.chunkCount ?? 0,
        durationMs: Date.now() - startedAt,
      });
    }

    if (!applyNormalizedGuardrailsInputLimit(gatewayInput, guardrailsEngine, guardrailInputVerdict.findings)) {
      writeJson(response, 400, createOpenAiError({ code: "guardrail_blocked", category: "governance", param: "messages",
        message: "Normalized request exceeds the configured input character limit." }));
      return;
    }
    const choiceCount = Number(gatewayInput.metadata?.openAiCompatibility?.choiceCount ?? 1);
    if (managedLocalClientRoute && choiceCount > 1) {
      writeJson(response, 409, createOpenAiError(createManagedLocalClientRouteError(
        "LOCAL_CLIENT_PROVIDER_MULTI_CHOICE_DENIED",
        "Managed local-client routing currently permits one provider generation per request.",
      )));
      return;
    }

    if (requestBody.stream === true) {
      await streamOpenAiChatCompletion({
        body: requestBody,
        gatewayInput,
        gatewayService,
        request,
        response,
        startedAt,
        writeServiceLog,
        enterpriseGovernanceService,
      });
      return;
    }

    // n>1：并发执行 n 次同输入生成，choices 按序返回；不走响应缓存（v1 不缓存多候选）。
    if (choiceCount > 1) {
      await handleMultiChoiceChatCompletion({
        choiceCount,
        requestBody,
        gatewayInput,
        gatewayService,
        request,
        response,
        startedAt,
        normalizedPath,
        guardrailsEngine: outputPolicy,
        writeServiceLog,
        enterpriseGovernanceService,
      });
      return;
    }

    // 虚拟 key（uai-）预算/限流门：请求前按保守估算预检，命中缓存也消耗预算。
    if (applyVirtualKeyRequestGate({
      enterpriseGovernanceService,
      request,
      gatewayInput,
      response,
      writeServiceLog,
      startedAt,
    })) {
      return;
    }

    const chatResponseCache = getChatResponseCacheIntegration();
    // RAG 注入后缓存键不稳定（检索库随时间变化），跳过响应缓存。
    const cacheCandidate = managedLocalClientRoute
      ? null
      : gatewayInput.metadata?.ragInjection?.applied
      ? null
      : chatResponseCache.describeCacheCandidate(requestBody, gatewayInput, outputPolicy.fingerprint);
    const cacheLookup = cacheCandidate
      ? chatResponseCache.lookup({ candidate: cacheCandidate, tenantIdentity: request.enterpriseIdentity })
      : null;
    const cachedBilling = readChatCacheBillingSnapshot(cacheLookup?.payload);
    if (cacheLookup?.payload.kind === "json" && (!request.enterpriseIdentity?.apiKeyFingerprint || cachedBilling)) {
      await recordCachedVirtualKeyUsage({ enterpriseGovernanceService, request, writeServiceLog,
        path: normalizedPath, billingSnapshot: cachedBilling });
      const hitLayer = cacheLookup.hitType === "semantic" ? "semantic" : "exact";
      recordChatRequest(normalizedPath, false);
      recordChatCacheEvent(hitLayer, "hit");
      getLangfuseCallback().recordChatGeneration({
        route: normalizedPath,
        model: String(cacheLookup.payload.response?.model ?? gatewayInput.model ?? ""),
        stream: false,
        cacheHit: true,
        usage: {
          inputTokens: cacheLookup.payload.response?.usage?.prompt_tokens,
          outputTokens: cacheLookup.payload.response?.usage?.completion_tokens,
          totalTokens: cacheLookup.payload.response?.usage?.total_tokens,
        },
        latencyMs: Date.now() - startedAt,
        inputText: gatewayInput.messages?.at(-1)?.content ?? undefined,
        outputText: cacheLookup.payload.response?.choices?.[0]?.message?.content,
        virtualKeyFingerprint: request.enterpriseIdentity?.apiKeyFingerprint,
      });
      writeServiceLog?.("openai_chat_cache_hit", {
        method: request.method,
        path: normalizedPath,
        cacheKey: cacheLookup.cacheKey,
        hitType: cacheLookup.hitType,
        ...(cacheLookup.semanticScore !== undefined ? { semanticScore: cacheLookup.semanticScore } : {}),
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, cacheLookup.payload.response);
      return;
    }

    const result = await gatewayService.execute(gatewayInput);
    if (!result.success) {
      const error = result.error ?? {
        code: result.code,
        message: result.message,
        category: "provider",
      };
      writeServiceLog?.("openai_chat_failed", {
        method: request.method,
        path: normalizedPath,
        code: error.code,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, resolveOpenAiErrorStatus(error), createOpenAiError(error));
      return;
    }

    const chatCompletion = createOpenAiChatCompletion(result, {
      created: Math.floor(startedAt / 1000),
      requestedModel: requestBody.model,
      promptEnhancement: gatewayInput.metadata?.promptEnhancement,
    });

    // Guardrails 输出侧：对最终文本脱敏/拦截；fail-open 保证不影响正常响应。
    const outputContent = chatCompletion?.choices?.[0]?.message?.content;
    if (typeof outputContent === "string") {
      const outputVerdict = outputPolicy.inspectOutputText(outputContent);
      if (outputVerdict.decision === "block") {
        recordGuardrailEvaluation("output", "block");
        for (const finding of outputVerdict.findings) {
          if (finding.action === "block") recordGuardrailFinding(finding.rule, finding.action);
        }
        writeServiceLog?.("openai_chat_guardrail_output_blocked", {
          method: request.method,
          path: normalizedPath,
          findings: outputVerdict.findings,
          durationMs: Date.now() - startedAt,
        });
        writeJson(response, 400, createOpenAiError({
          code: "guardrail_blocked",
          category: "governance",
          message: "Response blocked by chat guardrails.",
          param: "messages",
        }));
        return;
      }
      if (outputVerdict.findings.length) {
        recordGuardrailEvaluation("output", "allow");
        for (const finding of outputVerdict.findings) {
          recordGuardrailFinding(finding.rule, finding.action);
        }
      }
      if (outputVerdict.text !== outputContent) {
        chatCompletion.choices[0].message.content = outputVerdict.text;
      }
    }

    recordChatRequest(normalizedPath, false);
    if (cacheCandidate) {
      recordChatCacheEvent("exact", cacheLookup ? "miss" : "bypassed");
    }
    const usage = result.data?.usage ?? {};
    recordChatTokens(result.data?.selectedModel ?? gatewayInput.model, "input", usage.inputTokens);
    recordChatTokens(result.data?.selectedModel ?? gatewayInput.model, "output", usage.outputTokens);
    getLangfuseCallback().recordChatGeneration({
      requestId: result.meta?.requestId,
      route: normalizedPath,
      model: result.data?.selectedModel ?? gatewayInput.model,
      provider: result.data?.selectedProvider,
      stream: false,
      cacheHit: false,
      usage,
      latencyMs: Date.now() - startedAt,
      inputText: gatewayInput.messages?.at(-1)?.content ?? undefined,
      outputText: result.data?.message?.content ?? result.data?.outputText,
      virtualKeyFingerprint: request.enterpriseIdentity?.apiKeyFingerprint,
    });
    if (cacheCandidate) {
      chatResponseCache.persist({
        candidate: cacheCandidate,
        tenantIdentity: request.enterpriseIdentity,
        payload: { kind: "json", response: chatCompletion, billing: getVirtualKeyBillingSnapshot(result) },
      });
      recordChatCacheEvent("exact", "write");
    }

    writeServiceLog?.("openai_chat_completed", {
      method: request.method,
      path: normalizedPath,
      provider: result.data?.selectedProvider,
      model: result.data?.selectedModel,
      executionMode: result.data?.executionMode,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 200, chatCompletion);
    return;
  }

  if (request.method === "POST" && normalizedPath === COMPLETIONS_PATH) {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(response, 400, createOpenAiError({
        code: "invalid_json",
        category: "validation",
        message: "Request body must be valid JSON.",
      }));
      return;
    }

    const requestBody = {
      ...body,
      ...(normalized.modelFromPath && !body?.model ? { model: normalized.modelFromPath } : {}),
    };

    let gatewayInput;
    try {
      gatewayInput = normalizeOpenAiCompletionRequest(
        requestBody,
        gatewayService.getProviderDescriptors(),
      );
    } catch (error) {
      writeServiceLog?.("openai_completion_validation_failed", {
        method: request.method,
        path: normalizedPath,
        code: error?.code,
        param: error?.param,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 400, createOpenAiError(error));
      return;
    }

    if (requestBody.stream === true) {
      await streamOpenAiCompletion({
        body: requestBody,
        gatewayInput,
        gatewayService,
        request,
        response,
        startedAt,
        writeServiceLog,
      });
      return;
    }

    // n>1（legacy completions）：并发执行，choices 按序返回。
    const completionChoiceCount = Number(
      gatewayInput.metadata?.openAiCompatibility?.choiceCount ?? 1,
    );
    if (completionChoiceCount > 1) {
      const settled = await Promise.all(
        Array.from({ length: completionChoiceCount }, () => gatewayService.execute(gatewayInput)),
      );
      const firstSettledFailure = settled.find((result) => !result?.success);
      if (firstSettledFailure) {
        const error = firstSettledFailure.error ?? {
          code: firstSettledFailure.code,
          message: firstSettledFailure.message,
          category: "provider",
        };
        writeJson(response, resolveOpenAiErrorStatus(error), createOpenAiError(error));
        return;
      }
      const completionOptions = {
        created: Math.floor(startedAt / 1000),
        requestedModel: requestBody.model,
        promptEnhancement: gatewayInput.metadata?.promptEnhancement,
      };
      const completion = createOpenAiCompletion(settled[0], completionOptions);
      completion.choices = settled.map((result, index) => {
        const built = index === 0
          ? completion
          : createOpenAiCompletion(result, completionOptions);
        const choice = built.choices[0];
        choice.index = index;
        return choice;
      });
      const legacyPromptTokens = Number(settled[0].data?.usage?.inputTokens ?? 0);
      const legacyCompletionTokens = settled.reduce(
        (sum, result) => sum + Number(result.data?.usage?.outputTokens ?? 0),
        0,
      );
      completion.usage = {
        prompt_tokens: legacyPromptTokens,
        completion_tokens: legacyCompletionTokens,
        total_tokens: legacyPromptTokens + legacyCompletionTokens,
      };
      writeJson(response, 200, completion);
      return;
    }

    const result = await gatewayService.execute(gatewayInput);
    if (!result.success) {
      const error = result.error ?? {
        code: result.code,
        message: result.message,
        category: "provider",
      };
      writeServiceLog?.("openai_completion_failed", {
        method: request.method,
        path: url.pathname,
        code: error.code,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, resolveOpenAiErrorStatus(error), createOpenAiError(error));
      return;
    }

    writeServiceLog?.("openai_completion_completed", {
      method: request.method,
      path: normalizedPath,
      provider: result.data?.selectedProvider,
      model: result.data?.selectedModel,
      executionMode: result.data?.executionMode,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 200, createOpenAiCompletion(result, {
      created: Math.floor(startedAt / 1000),
      requestedModel: requestBody.model,
      promptEnhancement: gatewayInput.metadata?.promptEnhancement,
    }));
    return;
  }

  if ((request.method === "POST" && normalizedPath === RESPONSES_PATH)
    || (["GET", "DELETE"].includes(request.method)
      && /^\/v1\/responses\/resp_[A-Za-z0-9_-]{1,64}$/u.test(normalizedPath))) {
    return ROUTE_NOT_HANDLED;
  }

  if (
    !normalized.isOpenAi
  ) {
    return ROUTE_NOT_HANDLED;
  }

  writeJson(response, 404, createOpenAiError({
    code: "unsupported_endpoint",
    category: "routing",
    message: "This OpenAI-compatible endpoint is not implemented in this profile.",
    param: normalized.path,
  }));
}

export function normalizeOpenAiChatCompletionRequest(body, descriptors = []) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createValidationError("Request body must be a JSON object.", null);
  }

  const requestedModel = readRequiredString(body.model, "model");
  requestAudioPartCount = 0; // 每请求重置 input_audio 计数
  const messages = normalizeOpenAiMessages(body.messages);
  const audioPartCount = requestAudioPartCount;
  const imageStats = getMessageImageStats(messages);
  validateOptionalBoolean(body.stream, "stream");
  validateUnsupportedFields(body);

  const choiceCount = normalizeChoiceCount(body.n);
  const streamOptions = normalizeOpenAiStreamOptions(body.stream_options, body.stream === true);

  const responseFormat = normalizeOpenAiResponseFormat(body.response_format);
  const tools = normalizeOpenAiTools(body.tools);
  const toolChoice = normalizeOpenAiToolChoice(body.tool_choice, tools);
  const parallelToolCalls = normalizeOptionalParallelToolCalls(body.parallel_tool_calls);

  const target = resolveOpenAiModelTarget(requestedModel, descriptors);
  const extension = normalizeUnifiedAiExtension(body);
  const gatewayInput = {
    taskType: "chat",
    messages,
    model: target.modelId,
    providerId: extension.providerId ?? target.providerId,
    options: normalizeGenerationOptions(body, responseFormat),
    ...(tools ? { tools } : {}),
    ...(toolChoice ? { toolChoice } : {}),
    ...(parallelToolCalls !== undefined ? { parallelToolCalls } : {}),
    ...(imageStats.imageCount > 0 ? { requiredCapabilities: ["vision"] } : {}),
    metadata: {
      source: "openai-compatible-api",
      openAiCompatibility: {
        requestedModel,
        stream: body.stream === true,
        ...(choiceCount > 1 ? { choiceCount } : {}),
        ...(extension.rag?.enabled ? { rag: extension.rag } : {}),
        ...(streamOptions ? { streamOptions } : {}),
        ...(responseFormat ? { responseFormat } : {}),
        ...(tools ? { toolCount: tools.length } : {}),
        ...(imageStats.imageCount > 0 ? {
          multimodal: {
            imageCount: imageStats.imageCount,
            totalInlineImageBytes: imageStats.totalBytes,
            remoteImageUrlsAllowed: false,
          },
        } : {}),
        ...(audioPartCount > 0 ? {
          multimodalAudio: {
            audioCount: audioPartCount,
            formats: ["wav", "mp3"],
            passthrough: true,
          },
        } : {}),
      },
    },
  };

  return extension.promptEnhancement?.enabled === true
    ? applyPromptEnhancement(gatewayInput, extension.promptEnhancement)
    : gatewayInput;
}

export function createOpenAiModelList(descriptors = [], startedAt = Date.now()) {
  let cached = modelListMemo.get(descriptors);
  if (!cached) {
    cached = buildModelRows(descriptors);
    modelListMemo.set(descriptors, cached);
  }
  const counts = cached.counts;
  const available = cached.available;

  return {
    object: "list",
    data: available.map(({ descriptor, model }) => ({
      id: counts.get(model.id) > 1 ? `${descriptor.id}/${model.id}` : model.id,
      object: "model",
      created: Math.floor(startedAt / 1000),
      owned_by: descriptor.id,
      unified_ai: {
        provider_id: descriptor.id,
        provider_type: descriptor.metadata?.providerType ?? "unknown",
        execution_mode: descriptor.metadata?.providerType === "fake" ? "fake" : "real",
      },
    })),
  };
}

export function createOpenAiModelDetail(modelRecord, startedAt = Date.now(), modelId) {
  const { descriptor, model } = modelRecord;
  return {
    id: typeof modelId === "string" && modelId.length > 0 ? modelId : model.id,
    object: "model",
    created: Math.floor(startedAt / 1000),
    owned_by: descriptor.id,
    unified_ai: {
      provider_id: descriptor.id,
      provider_type: descriptor.metadata?.providerType ?? "unknown",
      execution_mode: descriptor.metadata?.providerType === "fake" ? "fake" : "real",
    },
  };
}

export function createOpenAiEngineList(descriptors = [], startedAt = Date.now()) {
  const available = listAvailableModels(descriptors);

  return {
    object: "list",
    data: available.map(({ descriptor, model }) => ({
      id: model.id,
      object: "engine",
      created: Math.floor(startedAt / 1000),
      owned_by: descriptor.id,
      owner: descriptor.id,
      unified_ai: {
        provider_id: descriptor.id,
        provider_type: descriptor.metadata?.providerType ?? "unknown",
        execution_mode: descriptor.metadata?.providerType === "fake" ? "fake" : "real",
      },
    })),
  };
}

export function createOpenAiEngineDetail(modelRecord, startedAt = Date.now(), modelId) {
  const { descriptor, model } = modelRecord;
  return {
    id: typeof modelId === "string" && modelId.length > 0 ? modelId : model.id,
    object: "engine",
    created: Math.floor(startedAt / 1000),
    owned_by: descriptor.id,
    owner: descriptor.id,
    unified_ai: {
      provider_id: descriptor.id,
      provider_type: descriptor.metadata?.providerType ?? "unknown",
      execution_mode: descriptor.metadata?.providerType === "fake" ? "fake" : "real",
    },
  };
}

export function createOpenAiChatCompletion(result, options = {}) {
  const data = result.data ?? {};
  const usage = data.usage ?? {};
  const content = data.message?.content ?? data.outputText ?? data.text ?? "";
  const toolCalls = Array.isArray(data.message?.tool_calls)
    ? data.message.tool_calls
    : Array.isArray(data.message?.toolCalls)
      ? data.message.toolCalls
      : null;

  return {
    id: toOpenAiCompletionId(data.id ?? result.meta?.requestId),
    object: "chat.completion",
    created: options.created ?? Math.floor(Date.now() / 1000),
    model: data.selectedModel ?? data.model ?? options.requestedModel,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: toolCalls?.length ? (data.message?.content ?? null) : content,
          ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
        },
        logprobs: null,
        finish_reason: normalizeFinishReason(data.finishReason),
      },
    ],
    usage: {
      prompt_tokens: usage.inputTokens ?? 0,
      completion_tokens: usage.outputTokens ?? 0,
      total_tokens: usage.totalTokens ?? 0,
    },
    system_fingerprint: null,
    unified_ai: createUnifiedAiMetadata(data, result.meta, options.promptEnhancement),
  };
}

export function normalizeOpenAiCompletionRequest(body, descriptors = []) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createValidationError("Request body must be a JSON object.", null);
  }

  const requestedModel = resolveOpenAiCompletionModel(body.model);
  const prompt = normalizeCompletionPrompt(body.prompt);
  validateOptionalBoolean(body.stream, "stream");
  validateUnsupportedCompletionFields(body);

  const choiceCount = normalizeChoiceCount(body.n);
  const streamOptions = normalizeOpenAiStreamOptions(body.stream_options, body.stream === true);

  const target = resolveOpenAiModelTarget(requestedModel, descriptors);
  const extension = normalizeUnifiedAiExtension(body);
  const gatewayInput = {
    taskType: "chat",
    messages: [{ role: "user", content: prompt }],
    model: target.modelId,
    providerId: extension.providerId ?? target.providerId,
    options: normalizeGenerationOptions(body),
    metadata: {
      source: "openai-compatible-api",
      openAiCompatibility: {
        requestedModel,
        stream: body.stream === true,
        api: "completions",
        ...(choiceCount > 1 ? { choiceCount } : {}),
        ...(streamOptions ? { streamOptions } : {}),
      },
    },
  };

  return extension.promptEnhancement?.enabled === true
    ? applyPromptEnhancement(gatewayInput, extension.promptEnhancement)
    : gatewayInput;
}

export function createOpenAiCompletion(result, options = {}) {
  const data = result.data ?? {};
  const usage = data.usage ?? {};
  const text = data.message?.content ?? data.outputText ?? data.text ?? "";

  return {
    id: toOpenAiCompletionId(data.id ?? result.meta?.requestId),
    object: "text_completion",
    created: options.created ?? Math.floor(Date.now() / 1000),
    model: data.selectedModel ?? data.model ?? options.requestedModel,
    choices: [
      {
        text,
        index: 0,
        logprobs: null,
        finish_reason: normalizeFinishReason(data.finishReason),
      },
    ],
    usage: {
      prompt_tokens: usage.inputTokens ?? 0,
      completion_tokens: usage.outputTokens ?? 0,
      total_tokens: usage.totalTokens ?? 0,
    },
    unified_ai: createUnifiedAiMetadata(data, result.meta, options.promptEnhancement),
  };
}

function createOpenAiResourceNotFoundError(resourceType, resourceId) {
  return {
    error: {
      message: `No such ${resourceType}: ${resourceId || "unknown"}`,
      type: "invalid_request_error",
      param: `${resourceType}_id`,
      code: `${resourceType}_not_found`,
    },
  };
}

function resolveOpenAiModelResource(modelId, descriptors = []) {
  const available = listAvailableModels(descriptors);
  const counts = new Map();
  for (const item of available) {
    counts.set(item.model.id, (counts.get(item.model.id) ?? 0) + 1);
  }

  const exposedMatch = available.find(({ descriptor, model }) => {
    const exposedId = counts.get(model.id) > 1 ? `${descriptor.id}/${model.id}` : model.id;
    return exposedId === modelId;
  });
  if (exposedMatch) return exposedMatch;

  const exactMatches = available.filter(({ model }) => model.id === modelId);
  if (exactMatches.length === 1) return exactMatches[0];
  return null;
}

async function handleMultiChoiceChatCompletion({
  choiceCount,
  requestBody,
  gatewayInput,
  gatewayService,
  request,
  response,
  startedAt,
  normalizedPath,
  guardrailsEngine,
  writeServiceLog,
  enterpriseGovernanceService,
}) {
  if (applyVirtualKeyRequestGate({
    enterpriseGovernanceService,
    request,
    gatewayInput,
    response,
    writeServiceLog,
    startedAt,
  })) {
    return;
  }

  const settled = await Promise.all(
    Array.from({ length: choiceCount }, () => gatewayService.execute(gatewayInput)),
  );

  const firstFailure = settled.find((result) => !result?.success);
  if (firstFailure) {
    const error = firstFailure.error ?? {
      code: firstFailure.code,
      message: firstFailure.message,
      category: "provider",
    };
    writeServiceLog?.("openai_chat_failed", {
      method: "POST",
      path: normalizedPath,
      code: error.code,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, resolveOpenAiErrorStatus(error), createOpenAiError(error));
    return;
  }

  const created = Math.floor(startedAt / 1000);
  const completionOptions = {
    created,
    requestedModel: requestBody.model,
    promptEnhancement: gatewayInput.metadata?.promptEnhancement,
  };
  const chatCompletion = createOpenAiChatCompletion(settled[0], completionOptions);
  chatCompletion.choices = settled.map((result, index) => {
    const completion = index === 0
      ? chatCompletion
      : createOpenAiChatCompletion(result, completionOptions);
    const choice = completion.choices[0];
    choice.index = index;
    return choice;
  });

  // Guardrails 输出侧：逐 choice 脱敏/拦截；fail-open 保证不影响正常响应。
  for (const choice of chatCompletion.choices) {
    if (typeof choice?.message?.content !== "string" || !choice.message.content) continue;
    const outputVerdict = guardrailsEngine.inspectOutputText(choice.message.content);
    if (outputVerdict.decision === "block") {
      recordGuardrailEvaluation("output", "block");
      for (const finding of outputVerdict.findings) {
        if (finding.action === "block") recordGuardrailFinding(finding.rule, finding.action);
      }
      writeServiceLog?.("openai_chat_guardrail_output_blocked", {
        method: "POST",
        path: normalizedPath,
        findings: outputVerdict.findings,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 400, createOpenAiError({
        code: "guardrail_blocked",
        category: "governance",
        message: "Response blocked by chat guardrails.",
        param: "messages",
      }));
      return;
    }
    if (outputVerdict.findings.length) {
      recordGuardrailEvaluation("output", "allow");
      for (const finding of outputVerdict.findings) {
        recordGuardrailFinding(finding.rule, finding.action);
      }
    }
    if (outputVerdict.text !== choice.message.content) {
      choice.message.content = outputVerdict.text;
    }
  }

  // usage：prompt 只计一次，completion 跨 choice 求和（与 OpenAI n>1 语义一致）。
  const promptTokens = Number(settled[0].data?.usage?.inputTokens ?? 0)
    || estimateTokens(gatewayInput).estimatedInputTokens;
  const completionTokens = settled.reduce(
    (sum, result) => sum + Number(result.data?.usage?.outputTokens ?? 0),
    0,
  );
  chatCompletion.usage = {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
  };

  recordChatRequest(normalizedPath, false);
  const selectedModel = settled[0].data?.selectedModel ?? gatewayInput.model;
  recordChatTokens(selectedModel, "input", promptTokens);
  recordChatTokens(selectedModel, "output", completionTokens);
  writeServiceLog?.("openai_chat_completed", {
    method: "POST",
    path: normalizedPath,
    provider: settled[0].data?.selectedProvider,
    model: selectedModel,
    executionMode: settled[0].data?.executionMode,
    choices: choiceCount,
    durationMs: Date.now() - startedAt,
  });
  writeJson(response, 200, chatCompletion);
}

export async function streamOpenAiChatCompletion({
  body,
  gatewayInput,
  gatewayService,
  request,
  response,
  startedAt,
  writeServiceLog,
  enterpriseGovernanceService,
}) {
  let clientClosed = false;
  let failed = false;
  let completionId = null;
  let selectedModel = body.model;
  let finalEvent = null;
  let streamOutputText = "";
  const created = Math.floor(startedAt / 1000);
  const outputPolicy = captureGuardrailsOutputPolicy(getGuardrailsEngine(request.enterpriseIdentity?.tenantId));

  response.on("close", () => {
    clientClosed = true;
  });

  // 虚拟 key 门对流式请求同样生效；必须在写出 SSE 头之前拒绝。
  if (applyVirtualKeyRequestGate({
    enterpriseGovernanceService,
    request,
    gatewayInput,
    response,
    writeServiceLog,
    startedAt,
  })) {
    return;
  }

  const choiceCount = Number(gatewayInput.metadata?.openAiCompatibility?.choiceCount ?? 1);
  // 多候选（n>1）与 RAG 注入均不支持缓存读写：候选集合/检索结果不可稳定复放。
  const chatResponseCache = getChatResponseCacheIntegration();
  const managedLocalClientPinned =
    gatewayInput.metadata?.managedLocalClientProviderRouting?.providerPinned === true
    && gatewayInput.metadata?.managedLocalClientProviderRouting?.modelPinned === true;
  const cacheCandidate = managedLocalClientPinned
    || choiceCount > 1
    || gatewayInput.metadata?.ragInjection?.applied
    ? null
    : chatResponseCache.describeCacheCandidate(body, gatewayInput, outputPolicy.fingerprint);
  const cacheLookup = cacheCandidate
    ? chatResponseCache.lookup({ candidate: cacheCandidate, tenantIdentity: request.enterpriseIdentity })
    : null;
  const cachedBilling = readChatCacheBillingSnapshot(cacheLookup?.payload);
  if (cacheLookup?.payload.kind === "sse" && (!request.enterpriseIdentity?.apiKeyFingerprint || cachedBilling)) {
    await recordCachedVirtualKeyUsage({ enterpriseGovernanceService, request, writeServiceLog,
      path: CHAT_COMPLETIONS_PATH, billingSnapshot: cachedBilling });
    writeSseHeaders(response);
    const hitLayer = cacheLookup.hitType === "semantic" ? "semantic" : "exact";
    recordChatRequest(CHAT_COMPLETIONS_PATH, true);
    recordChatCacheEvent(hitLayer, "hit");
    getLangfuseCallback().recordChatGeneration({
      route: CHAT_COMPLETIONS_PATH,
      model: selectedModel,
      stream: true,
      cacheHit: true,
      usage: {
        totalTokens: cachedBilling?.totalTokens ?? (Number(cacheLookup.payload.usageChunk?.usage?.total_tokens ?? 0) || undefined),
      },
      latencyMs: Date.now() - startedAt,
      inputText: gatewayInput.messages?.at(-1)?.content ?? undefined,
      virtualKeyFingerprint: request.enterpriseIdentity?.apiKeyFingerprint,
    });
    for (const chunk of cacheLookup.payload.chunks) {
      writeOpenAiSseData(response, chunk);
    }
    if (body.stream_options?.include_usage === true && cacheLookup.payload.usageChunk !== undefined) {
      writeOpenAiSseData(response, cacheLookup.payload.usageChunk);
    }
    writeServiceLog?.("openai_chat_stream_cache_hit", {
      method: request.method,
      path: CHAT_COMPLETIONS_PATH,
      cacheKey: cacheLookup.cacheKey,
      durationMs: Date.now() - startedAt,
    });
    if (!clientClosed) {
      response.write("data: [DONE]\n\n");
      response.end();
    }
    return;
  }

  const firstPrimedStream = await primeGatewayStream(gatewayService.executeStream(gatewayInput));
  const preflightError = readPrimedGatewayStreamError(firstPrimedStream);
  const preflightStatus = resolveGatewayStreamPreflightStatus(preflightError?.code);
  if (preflightError && preflightStatus !== null) {
    await closePrimedGatewayStream(firstPrimedStream);
    writeServiceLog?.("openai_chat_stream_failed", {
      method: request.method,
      path: CHAT_COMPLETIONS_PATH,
      code: preflightError.code,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, preflightStatus, createOpenAiError(preflightError));
    return;
  }
  writeSseHeaders(response);

  const capturedChunks = [];
  let capturedUsageChunk;
  let capturedBilling;
  let firstTokenAt = 0;

  const consumeProviderStream = async (choiceIndex, primedStream) => {
    const stream = primedStream ?? await primeGatewayStream(gatewayService.executeStream(gatewayInput));
    for await (const event of inspectGuardrailsOutputStream(iteratePrimedGatewayStream(stream), outputPolicy, () => clientClosed)) {
      if (clientClosed) break;
      if (event.type === "error") {
        failed = true;
        writeOpenAiSseData(response, createOpenAiError(event.envelope?.error ?? event.envelope));
        break;
      }

      completionId ??= toOpenAiCompletionId(event.requestId);
      selectedModel = event.selectedModel ?? selectedModel;
      finalEvent = event;
      if (typeof event.textDelta === "string" && event.textDelta) {
        if (!firstTokenAt) {
          firstTokenAt = Date.now();
          recordChatTtft(CHAT_COMPLETIONS_PATH, firstTokenAt, startedAt);
        }
        streamOutputText += event.textDelta;
      }
      const chunk = createOpenAiChatCompletionChunk(event, {
        completionId,
        created,
        model: selectedModel,
        promptEnhancement: gatewayInput.metadata?.promptEnhancement,
        index: choiceIndex,
      });
      capturedChunks.push(chunk);
      writeOpenAiSseData(response, chunk);
    }
  };

  // n=1 保持既有单流路径；n>1 顺序消费 n 条流并按 choice index 标记。
  for (let choiceIndex = 0; choiceIndex < choiceCount && !failed && !clientClosed; choiceIndex += 1) {
    await consumeProviderStream(choiceIndex, choiceIndex === 0 ? firstPrimedStream : undefined);
  }

  if (!failed) {
    capturedBilling = getVirtualKeyBillingSnapshot(finalEvent);
    recordChatRequest(CHAT_COMPLETIONS_PATH, true);
    if (cacheCandidate) {
      recordChatCacheEvent("exact", cacheLookup ? "miss" : "bypassed");
    }
    const finalUsage = finalEvent?.rawProviderMeta?.usage ?? {};
    recordChatTokens(selectedModel, "input", finalUsage.inputTokens ?? estimateTokens(gatewayInput).estimatedInputTokens);
    recordChatTokens(selectedModel, "output", finalUsage.outputTokens ?? estimateTextTokens(streamOutputText));
    getLangfuseCallback().recordChatGeneration({
      requestId: finalEvent?.requestId,
      route: CHAT_COMPLETIONS_PATH,
      model: selectedModel,
      provider: finalEvent?.selectedProvider,
      stream: true,
      cacheHit: false,
      usage: {
        inputTokens: finalUsage.inputTokens ?? estimateTokens(gatewayInput).estimatedInputTokens,
        outputTokens: finalUsage.outputTokens ?? estimateTextTokens(streamOutputText),
        totalTokens: finalUsage.totalTokens,
      },
      latencyMs: Date.now() - startedAt,
      inputText: gatewayInput.messages?.at(-1)?.content ?? undefined,
      outputText: streamOutputText,
      virtualKeyFingerprint: request.enterpriseIdentity?.apiKeyFingerprint,
    });
  }

  writeServiceLog?.(failed ? "openai_chat_stream_failed" : "openai_chat_stream_completed", {
    method: request.method,
    path: CHAT_COMPLETIONS_PATH,
    model: selectedModel,
    durationMs: Date.now() - startedAt,
  });
  if (!clientClosed) {
    if (!failed && body.stream_options?.include_usage === true && finalEvent) {
      capturedUsageChunk = createOpenAiChatCompletionUsageChunk(finalEvent, {
        completionId,
        created,
        model: selectedModel,
        messages: gatewayInput.messages,
        promptEnhancement: gatewayInput.metadata?.promptEnhancement,
      });
      writeOpenAiSseData(response, capturedUsageChunk);
    }
    response.write("data: [DONE]\n\n");
    response.end();
  }
  if (
    cacheCandidate
    && !failed
    && !clientClosed
    && capturedChunks.length > 0
  ) {
    chatResponseCache.persist({
      candidate: cacheCandidate,
      tenantIdentity: request.enterpriseIdentity,
      payload: {
        kind: "sse",
        chunks: capturedChunks,
        billing: capturedBilling,
        ...(capturedUsageChunk !== undefined ? { usageChunk: capturedUsageChunk } : {}),
      },
    });
    recordChatCacheEvent("exact", "write");
  }
}

async function streamOpenAiCompletion({
  body,
  gatewayInput,
  gatewayService,
  request,
  response,
  startedAt,
  writeServiceLog,
}) {
  let clientClosed = false;
  let failed = false;
  let completionId = null;
  let selectedModel = body.model;
  let finalEvent = null;
  let firstTokenAt = 0;
  const created = Math.floor(startedAt / 1000);
  const choiceCount = Number(gatewayInput.metadata?.openAiCompatibility?.choiceCount ?? 1);
  const outputPolicy = captureGuardrailsOutputPolicy(getGuardrailsEngine(request.enterpriseIdentity?.tenantId));

  response.on("close", () => {
    clientClosed = true;
  });
  const firstPrimedStream = await primeGatewayStream(gatewayService.executeStream(gatewayInput));
  const preflightError = readPrimedGatewayStreamError(firstPrimedStream);
  const preflightStatus = resolveGatewayStreamPreflightStatus(preflightError?.code);
  if (preflightError && preflightStatus !== null) {
    await closePrimedGatewayStream(firstPrimedStream);
    writeServiceLog?.("openai_completion_stream_failed", {
      method: request.method,
      path: COMPLETIONS_PATH,
      code: preflightError.code,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, preflightStatus, createOpenAiError(preflightError));
    return;
  }
  writeSseHeaders(response);

  const consumeLegacyStream = async (choiceIndex, primedStream) => {
    const stream = primedStream ?? await primeGatewayStream(gatewayService.executeStream(gatewayInput));
    for await (const event of inspectGuardrailsOutputStream(iteratePrimedGatewayStream(stream), outputPolicy, () => clientClosed)) {
      if (clientClosed) break;
      if (event.type === "error") {
        failed = true;
        writeOpenAiSseData(response, createOpenAiError(event.envelope?.error ?? event.envelope));
        break;
      }

      completionId ??= toOpenAiCompletionId(event.requestId);
      selectedModel = event.selectedModel ?? selectedModel;
      finalEvent = event;
      if (event.type === "chunk" && event.textDelta && !firstTokenAt) {
        firstTokenAt = Date.now();
        recordChatTtft(COMPLETIONS_PATH, firstTokenAt, startedAt);
      }
      writeOpenAiSseData(
        response,
        createOpenAiCompletionChunk(event, {
          completionId,
          created,
          model: selectedModel,
          promptEnhancement: gatewayInput.metadata?.promptEnhancement,
          index: choiceIndex,
        }),
      );
    }
  };

  for (let choiceIndex = 0; choiceIndex < choiceCount && !failed && !clientClosed; choiceIndex += 1) {
    await consumeLegacyStream(choiceIndex, choiceIndex === 0 ? firstPrimedStream : undefined);
  }

  writeServiceLog?.(failed ? "openai_completion_stream_failed" : "openai_completion_stream_completed", {
    method: request.method,
    path: COMPLETIONS_PATH,
    model: selectedModel,
    durationMs: Date.now() - startedAt,
  });
  if (!clientClosed) {
    if (!failed && body.stream_options?.include_usage === true && finalEvent) {
      writeOpenAiSseData(response, createOpenAiCompletionUsageChunk(finalEvent, {
        completionId,
        created,
        model: selectedModel,
        prompt: typeof body.prompt === "string" ? body.prompt : "",
      }));
    }
    response.write("data: [DONE]\n\n");
    response.end();
  }
}

export function createOpenAiCompletionChunk(event, options = {}) {
  const delta = event.type === "start"
    ? ""
    : event.type === "chunk"
      ? event.textDelta ?? ""
      : "";

  return {
    id: options.completionId ?? toOpenAiCompletionId(event.requestId),
    object: "text_completion",
    created: options.created ?? Math.floor(Date.now() / 1000),
    model: event.selectedModel ?? options.model,
    choices: [
      {
        index: options.index ?? 0,
        text: delta,
        logprobs: null,
        finish_reason: event.type === "done" ? "stop" : null,
      },
    ],
    unified_ai: createUnifiedAiMetadata(event, { requestId: event.requestId }, options.promptEnhancement),
  };
}

function createOpenAiCompletionUsageChunk(event, options = {}) {
  const reportedUsage = event.rawProviderMeta?.usage;
  const promptTokens = Number(reportedUsage?.inputTokens ?? 0)
    || estimateCompatibilityTokens(String(options.prompt ?? ""));
  const completionTokens = Number(reportedUsage?.outputTokens ?? 0)
    || estimateCompatibilityTokens(event.outputText ?? "");

  return {
    id: options.completionId ?? toOpenAiCompletionId(event.requestId),
    object: "text_completion",
    created: options.created ?? Math.floor(Date.now() / 1000),
    model: event.selectedModel ?? options.model,
    choices: [],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
    unified_ai: {
      ...createUnifiedAiMetadata(event, { requestId: event.requestId }),
      usage_estimated: !reportedUsage,
    },
  };
}

export function createOpenAiChatCompletionChunk(event, options = {}) {
  const toolCallsDelta = event.type === "chunk"
    && Array.isArray(event.rawProviderMeta?.toolCallsDelta)
    ? event.rawProviderMeta.toolCallsDelta
    : null;
  const delta = event.type === "start"
    ? { role: "assistant", content: "" }
    : toolCallsDelta
      ? { tool_calls: toolCallsDelta }
      : event.type === "chunk"
        ? { content: event.textDelta ?? "" }
        : {};

  return {
    id: options.completionId ?? toOpenAiCompletionId(event.requestId),
    object: "chat.completion.chunk",
    created: options.created ?? Math.floor(Date.now() / 1000),
    model: event.selectedModel ?? options.model,
    choices: [
      {
        index: options.index ?? 0,
        delta,
        logprobs: null,
        finish_reason: event.type === "done"
          ? normalizeFinishReason(event.rawProviderMeta?.finishReason)
          : null,
      },
    ],
    system_fingerprint: null,
    unified_ai: createUnifiedAiMetadata(event, { requestId: event.requestId }, options.promptEnhancement),
  };
}

export function createOpenAiChatCompletionUsageChunk(event, options = {}) {
  const promptTokens = estimateCompatibilityTokens(
    (options.messages ?? []).map((message) => message.content ?? "").join("\n"),
  );
  const completionTokens = estimateCompatibilityTokens(event.outputText ?? "");

  return {
    id: options.completionId ?? toOpenAiCompletionId(event.requestId),
    object: "chat.completion.chunk",
    created: options.created ?? Math.floor(Date.now() / 1000),
    model: event.selectedModel ?? options.model,
    choices: [],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
    system_fingerprint: null,
    unified_ai: {
      ...createUnifiedAiMetadata(event, { requestId: event.requestId }, options.promptEnhancement),
      usage_estimated: true,
    },
  };
}

function normalizeOpenAiMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw createValidationError("messages must contain at least one message.", "messages");
  }

  return messages.map((message, index) => {
    const param = `messages[${index}]`;
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw createValidationError(`${param} must be an object.`, param);
    }
    if (message.role === "tool") {
      const toolCallId = readRequiredString(message.tool_call_id, `${param}.tool_call_id`);
      return {
        role: "tool",
        content: normalizeTextContent(message.content, `${param}.content`),
        toolCallId,
        ...(typeof message.name === "string" && message.name ? { name: message.name } : {}),
      };
    }

    const role = message.role === "developer" ? "system" : message.role;
    if (!new Set(["system", "user", "assistant"]).has(role)) {
      throw createValidationError(`${param}.role is not supported.`, `${param}.role`);
    }

    const toolCalls = normalizeOpenAiAssistantToolCalls(message.tool_calls, param);
    if (toolCalls && role !== "assistant") {
      throw createValidationError(`${param}.tool_calls requires role='assistant'.`, `${param}.tool_calls`);
    }
    if (message.tool_call_id !== undefined) {
      throw createValidationError(`${param}.tool_call_id requires role='tool'.`, `${param}.tool_call_id`);
    }

    return {
      role,
      content: message.content === null && toolCalls
        ? ""
        : normalizeOpenAiMessageContent(message.content, `${param}.content`, role),
      ...(typeof message.name === "string" && message.name ? { name: message.name } : {}),
      ...(toolCalls ? { toolCalls } : {}),
    };
  });
}

function normalizeOpenAiTools(value) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw createValidationError("tools must be an array.", "tools");
  }
  if (value.length === 0) return undefined;
  if (value.length > 128) {
    throw createValidationError("tools cannot contain more than 128 entries.", "tools");
  }

  const seenNames = new Set();
  return value.map((tool, index) => {
    const param = `tools[${index}]`;
    if (!isRecord(tool)) {
      throw createValidationError(`${param} must be an object.`, param);
    }
    assertSupportedObjectFields(tool, new Set(["type", "function"]), param);
    if (tool.type !== "function") {
      throw createUnsupportedError(`${param}.type must be 'function'.`, `${param}.type`);
    }
    if (!isRecord(tool.function)) {
      throw createValidationError(`${param}.function must be an object.`, `${param}.function`);
    }
    assertSupportedObjectFields(
      tool.function,
      new Set(["name", "description", "parameters", "strict"]),
      `${param}.function`,
    );
    const name = readRequiredString(tool.function.name, `${param}.function.name`);
    if (name.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw createValidationError(
        `${param}.function.name must use 1-64 letters, numbers, underscores, or hyphens.`,
        `${param}.function.name`,
      );
    }
    if (seenNames.has(name)) {
      throw createValidationError(`Duplicate tool name: ${name}.`, `${param}.function.name`);
    }
    seenNames.add(name);
    if (tool.function.description !== undefined && typeof tool.function.description !== "string") {
      throw createValidationError(
        `${param}.function.description must be a string.`,
        `${param}.function.description`,
      );
    }
    if (tool.function.parameters !== undefined && !isRecord(tool.function.parameters)) {
      throw createValidationError(
        `${param}.function.parameters must be a JSON Schema object.`,
        `${param}.function.parameters`,
      );
    }
    validateOptionalBoolean(tool.function.strict, `${param}.function.strict`);
    return {
      type: "function",
      function: {
        name,
        ...(tool.function.description !== undefined
          ? { description: tool.function.description }
          : {}),
        ...(tool.function.parameters !== undefined
          ? { parameters: tool.function.parameters }
          : {}),
        ...(tool.function.strict !== undefined ? { strict: tool.function.strict } : {}),
      },
    };
  });
}

function normalizeOpenAiToolChoice(value, tools) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    if (!new Set(["none", "auto", "required"]).has(value)) {
      throw createValidationError(
        "tool_choice must be 'none', 'auto', 'required', or a named function.",
        "tool_choice",
      );
    }
    if (value !== "none" && !tools) {
      throw createValidationError("tool_choice requires at least one tool.", "tool_choice");
    }
    return value;
  }
  if (!isRecord(value)) {
    throw createValidationError("tool_choice must be a string or object.", "tool_choice");
  }
  assertSupportedObjectFields(value, new Set(["type", "function"]), "tool_choice");
  if (value.type !== "function" || !isRecord(value.function)) {
    throw createValidationError(
      "tool_choice must select a function by name.",
      "tool_choice",
    );
  }
  assertSupportedObjectFields(value.function, new Set(["name"]), "tool_choice.function");
  const name = readRequiredString(value.function.name, "tool_choice.function.name");
  if (!tools?.some((tool) => tool.function.name === name)) {
    throw createValidationError(`tool_choice references unknown tool '${name}'.`, "tool_choice");
  }
  return { type: "function", function: { name } };
}

function normalizeOptionalParallelToolCalls(value) {
  if (value === undefined || value === null) return undefined;
  validateOptionalBoolean(value, "parallel_tool_calls");
  return value;
}

function normalizeOpenAiAssistantToolCalls(value, messageParam) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    throw createValidationError(
      `${messageParam}.tool_calls must be a non-empty array.`,
      `${messageParam}.tool_calls`,
    );
  }
  return value.map((toolCall, index) => {
    const param = `${messageParam}.tool_calls[${index}]`;
    if (!isRecord(toolCall)) {
      throw createValidationError(`${param} must be an object.`, param);
    }
    assertSupportedObjectFields(toolCall, new Set(["id", "type", "function"]), param);
    const id = readRequiredString(toolCall.id, `${param}.id`);
    if (toolCall.type !== "function" || !isRecord(toolCall.function)) {
      throw createValidationError(`${param} must contain a function call.`, param);
    }
    assertSupportedObjectFields(toolCall.function, new Set(["name", "arguments"]), `${param}.function`);
    const name = readRequiredString(toolCall.function.name, `${param}.function.name`);
    const argumentsValue = toolCall.function.arguments;
    if (typeof argumentsValue !== "string") {
      throw createValidationError(
        `${param}.function.arguments must be a JSON string.`,
        `${param}.function.arguments`,
      );
    }
    return {
      id,
      type: "function",
      function: { name, arguments: argumentsValue },
    };
  });
}

// input_audio 部件的本地策略：限制数量与体积，拒绝服务向量不至于借
// 多模态载荷放大（OpenAI 上限 ~25MB，这里按 base64 字符数更保守）。
const MAX_AUDIO_PARTS_PER_REQUEST = 4;
const MAX_AUDIO_BASE64_CHARS_PER_PART = 20 * 1024 * 1024; // ~15MB 原始音频
const SUPPORTED_AUDIO_FORMATS = new Set(["wav", "mp3"]);
let requestAudioPartCount = 0;

function normalizeOpenAiMessageContent(content, param, role) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content) || content.length === 0) {
    throw createValidationError(`${param} must be text or a non-empty content array.`, param);
  }

  let hasImage = false;
  let hasAudio = false;
  let hasNonEmptyText = false;
  const normalized = content.map((part, index) => {
    const partParam = `${param}[${index}]`;
    if (isRecord(part) && part.type === "input_audio") {
      if (role !== "user") {
        throw createUnsupportedError("input_audio content is allowed only in user messages.", partParam);
      }
      assertSupportedObjectFields(part, new Set(["type", "input_audio"]), partParam);
      if (!isRecord(part.input_audio)) {
        throw createValidationError(`${partParam}.input_audio must be an object.`, `${partParam}.input_audio`);
      }
      assertSupportedObjectFields(
        part.input_audio,
        new Set(["data", "format"]),
        `${partParam}.input_audio`,
      );
      const data = readRequiredString(part.input_audio.data, `${partParam}.input_audio.data`);
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
        throw createValidationError(
          `${partParam}.input_audio.data must be a base64 string.`,
          `${partParam}.input_audio.data`,
        );
      }
      if (data.length > MAX_AUDIO_BASE64_CHARS_PER_PART) {
        throw createValidationError(
          `input_audio exceeds the ${MAX_AUDIO_BASE64_CHARS_PER_PART}-character base64 limit.`,
          `${partParam}.input_audio.data`,
        );
      }
      const format = part.input_audio.format;
      if (typeof format !== "string" || !SUPPORTED_AUDIO_FORMATS.has(format)) {
        throw createValidationError(
          `${partParam}.input_audio.format must be one of: ${[...SUPPORTED_AUDIO_FORMATS].join(", ")}.`,
          `${partParam}.input_audio.format`,
        );
      }
      requestAudioPartCount += 1;
      if (requestAudioPartCount > MAX_AUDIO_PARTS_PER_REQUEST) {
        throw createValidationError(
          `Request cannot contain more than ${MAX_AUDIO_PARTS_PER_REQUEST} input_audio parts.`,
          partParam,
        );
      }
      hasAudio = true;
      return { type: "input_audio", input_audio: { data, format } };
    }
    if (!isRecord(part)) {
      throw createValidationError(`${partParam} must be an object.`, partParam);
    }
    if (part.type === "text") {
      assertSupportedObjectFields(part, new Set(["type", "text"]), partParam);
      if (typeof part.text !== "string") {
        throw createValidationError(`${partParam}.text must be a string.`, `${partParam}.text`);
      }
      hasNonEmptyText ||= part.text.trim().length > 0;
      return { type: "text", text: part.text };
    }
    if (part.type !== "image_url") {
      throw createUnsupportedError(
        "Only text, inline image_url, and input_audio content parts are supported.",
        partParam,
      );
    }
    if (role !== "user") {
      throw createUnsupportedError("image_url content is allowed only in user messages.", partParam);
    }
    assertSupportedObjectFields(part, new Set(["type", "image_url"]), partParam);
    if (!isRecord(part.image_url)) {
      throw createValidationError(`${partParam}.image_url must be an object.`, `${partParam}.image_url`);
    }
    assertSupportedObjectFields(
      part.image_url,
      new Set(["url", "detail"]),
      `${partParam}.image_url`,
    );
    const url = readRequiredString(part.image_url.url, `${partParam}.image_url.url`);
    if (!url.startsWith("data:")) {
      throw createUnsupportedError(
        "Remote image URLs are disabled; use an inline base64 data URL.",
        `${partParam}.image_url.url`,
      );
    }
    try {
      inspectInlineImageDataUrl(url);
    } catch (error) {
      throw createValidationError(error.message, `${partParam}.image_url.url`);
    }
    const detail = part.image_url.detail ?? "auto";
    if (!new Set(["auto", "low", "high"]).has(detail)) {
      throw createValidationError(
        `${partParam}.image_url.detail must be 'auto', 'low', or 'high'.`,
        `${partParam}.image_url.detail`,
      );
    }
    hasImage = true;
    return { type: "image_url", image_url: { url, detail } };
  });

  if (!hasImage && !hasAudio) return normalized.map((part) => part.text).join("\n");
  if (!hasNonEmptyText && normalized.every((part) => part.type !== "image_url" && part.type !== "input_audio")) {
    throw createValidationError(`${param} cannot be empty.`, param);
  }
  return normalized;
}

function normalizeTextContent(content, param) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) {
    throw createValidationError(`${param} must be text or an array of text parts.`, param);
  }

  return content.map((part, index) => {
    if (part?.type !== "text" || typeof part.text !== "string") {
      throw createUnsupportedError(
        "Only text message parts are supported; image and audio inputs are not available yet.",
        `${param}[${index}]`,
      );
    }
    return part.text;
  }).join("\n");
}

function normalizeGenerationOptions(body, responseFormat) {
  const maxOutputTokens = body.max_completion_tokens ?? body.max_tokens;
  const options = {};

  if (body.temperature !== undefined) {
    options.temperature = readNumberInRange(body.temperature, "temperature", 0, 2);
  }
  if (body.top_p !== undefined) {
    options.topP = readNumberInRange(body.top_p, "top_p", 0, 1);
  }
  if (maxOutputTokens !== undefined) {
    if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1) {
      throw createValidationError("max_tokens must be a positive integer.", "max_tokens");
    }
    options.maxOutputTokens = maxOutputTokens;
  }
  if (body.stop !== undefined) {
    const stops = typeof body.stop === "string" ? [body.stop] : body.stop;
    if (!Array.isArray(stops) || stops.length === 0 || stops.some((item) => typeof item !== "string")) {
      throw createValidationError("stop must be a string or a non-empty array of strings.", "stop");
    }
    options.stopSequences = stops;
  }
  if (responseFormat) {
    options.responseFormat = responseFormat.type === "text" ? "text" : "json";
  }

  return options;
}

export function normalizeOpenAiResponseFormat(value) {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw createValidationError("response_format must be an object.", "response_format");
  }

  const type = readRequiredString(value.type, "response_format.type");
  const allowedTopLevelFields = type === "json_schema"
    ? new Set(["type", "json_schema"])
    : new Set(["type"]);
  assertSupportedObjectFields(value, allowedTopLevelFields, "response_format");

  if (type === "text" || type === "json_object") {
    return { type };
  }
  if (type !== "json_schema") {
    throw createUnsupportedError(
      `response_format.type='${type}' is not supported.`,
      "response_format.type",
    );
  }

  const jsonSchema = value.json_schema;
  if (!isRecord(jsonSchema)) {
    throw createValidationError(
      "response_format.json_schema must be an object.",
      "response_format.json_schema",
    );
  }
  assertSupportedObjectFields(
    jsonSchema,
    new Set(["name", "description", "schema", "strict"]),
    "response_format.json_schema",
  );

  const name = readRequiredString(jsonSchema.name, "response_format.json_schema.name");
  if (name.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw createValidationError(
      "response_format.json_schema.name must use 1-64 letters, numbers, underscores, or hyphens.",
      "response_format.json_schema.name",
    );
  }
  if (!isRecord(jsonSchema.schema)) {
    throw createValidationError(
      "response_format.json_schema.schema must be an object.",
      "response_format.json_schema.schema",
    );
  }
  if (jsonSchema.description !== undefined && typeof jsonSchema.description !== "string") {
    throw createValidationError(
      "response_format.json_schema.description must be a string.",
      "response_format.json_schema.description",
    );
  }
  validateOptionalBoolean(jsonSchema.strict, "response_format.json_schema.strict");

  return {
    type,
    json_schema: {
      name,
      ...(jsonSchema.description !== undefined ? { description: jsonSchema.description } : {}),
      schema: jsonSchema.schema,
      ...(jsonSchema.strict !== undefined ? { strict: jsonSchema.strict } : {}),
    },
  };
}

function normalizeOpenAiStreamOptions(value, stream) {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw createValidationError("stream_options must be an object.", "stream_options");
  }
  if (!stream) {
    throw createValidationError(
      "stream_options requires stream=true.",
      "stream_options",
    );
  }
  assertSupportedObjectFields(value, new Set(["include_usage"]), "stream_options");
  validateOptionalBoolean(value.include_usage, "stream_options.include_usage");
  return {
    include_usage: value.include_usage === true,
  };
}

function assertSupportedObjectFields(value, allowedFields, param) {
  const unsupportedField = Object.keys(value).find((field) => !allowedFields.has(field));
  if (unsupportedField) {
    throw createUnsupportedError(
      `${param}.${unsupportedField} is not supported.`,
      `${param}.${unsupportedField}`,
    );
  }
}



function validateUnsupportedFields(body) {
  for (const [field, isNoop] of UNSUPPORTED_FIELDS) {
    if (body[field] !== undefined && !isNoop(body[field])) {
      throw createUnsupportedError(`${field} is not supported by this compatibility layer yet.`, field);
    }
  }
}

function validateUnsupportedCompletionFields(body) {
  for (const [field, isNoop] of COMPLETIONS_UNSUPPORTED_FIELDS) {
    if (body[field] !== undefined && !isNoop(body[field])) {
      throw createUnsupportedError(`${field} is not supported by this compatibility layer yet.`, field);
    }
  }
}

function normalizeCompletionPrompt(prompt) {
  if (typeof prompt === "string") {
    if (!prompt.trim()) {
      throw createValidationError("prompt must be a non-empty string or an array of strings.", "prompt");
    }
    return prompt;
  }
  if (Array.isArray(prompt)) {
    if (prompt.length === 0) {
      throw createValidationError("prompt must be a non-empty string or an array of strings.", "prompt");
    }
    return prompt.map((part, index) => {
      if (typeof part !== "string") {
        throw createValidationError(`prompt[${index}] must be a string.`, `prompt[${index}]`);
      }
      return part;
    }).join("");
  }
  throw createValidationError("prompt must be a non-empty string or an array of strings.", "prompt");
}

function toOpenAiCompletionId(value) {
  const suffix = String(value ?? Date.now()).replace(/[^a-zA-Z0-9_-]/g, "").slice(-48);
  return suffix.startsWith("chatcmpl-") ? suffix : `chatcmpl-${suffix}`;
}

// Re-exports: these moved to openAiCompatibilityShared.js / anthropicMessagesRoutes.js;
// external importers of this file keep working unchanged.
export {
  applyManagedLocalClientProviderRoute,
  applyNormalizedGuardrailsInputLimit,
  applyVirtualKeyRequestGate,
  authenticateManagedLocalClientProtocolRequest,
  authorizeVirtualKeyRequest,
  createOpenAiError,
  createUnifiedAiMetadata,
  resolveManagedLocalClientProviderRoute,
  resolveOpenAiErrorStatus,
  resolveVirtualKeyRequestAccounting,
} from "./openAiCompatibilityShared.js";
export {
  normalizeAnthropicMessageRequest,
  normalizeAnthropicConversation,
  createAnthropicMessage,
  createAnthropicError,
} from "./anthropicMessagesRoutes.js";

// Re-exports of bindings this module imports for its own routes: external
// importers of this file (openAiResponsesRoutes, geminiCompatibilityRoutes,
// httpServerRoutes06) keep resolving them unchanged.
export {
  createUnsupportedError,
  createValidationError,
};
export {
  closePrimedGatewayStream,
  iteratePrimedGatewayStream,
  primeGatewayStream,
  readPrimedGatewayStreamError,
  resolveGatewayStreamPreflightStatus,
};
export {
  recordChatRequest,
  recordChatTokens,
  recordChatTtft,
  recordGuardrailEvaluation,
  recordGuardrailFinding,
};
