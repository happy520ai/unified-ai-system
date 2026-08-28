import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { MANAGED_LOCAL_CLIENT_PROVIDER_PIN } from "../core/gatewayService.js";
import { createLocalClientProviderDispatchBinding } from "../routing/localClientProviderDispatchBinding.ts";
import { getChatResponseCacheIntegration } from "../cache/chatResponseCacheIntegration.ts";
import { getGuardrailsEngine } from "../guardrails/guardrailsEngine.ts";
import { resolveProviderDispatchHttpStatus } from "./providerDispatchHttpStatus.ts";
import {
  closePrimedGatewayStream,
  iteratePrimedGatewayStream,
  primeGatewayStream,
  readPrimedGatewayStreamError,
} from "./gatewayStreamPreflight.ts";
import { estimateTextTokens, estimateTokens } from "../cost/tokenEstimator.js";
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

const CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
const COMPLETIONS_PATH = "/v1/completions";
const RESPONSES_PATH = "/v1/responses";
const ANTHROPIC_MESSAGES_PATH = "/v1/messages";
const MODELS_PATH = "/v1/models";
const ENGINES_PATH = "/v1/engines";
const CHAT_COMPLETIONS_PATH_ALIAS = "/chat/completions";
const COMPLETIONS_PATH_ALIAS = "/completions";
const RESPONSES_PATH_ALIAS = "/responses";
const MODELS_PATH_ALIAS = "/models";
const ENGINES_PATH_ALIAS = "/engines";
const OPENAI_AZURE_CHAT_COMPLETIONS = /^\/openai\/deployments\/([^/]+)\/chat\/completions\/?$/;
const OPENAI_AZURE_COMPLETIONS = /^\/openai\/deployments\/([^/]+)\/completions\/?$/;
const OPENAI_AZURE_RESPONSES = /^\/openai\/deployments\/([^/]+)\/responses\/?$/;
const OPENAI_MODELS_ID = /^\/v1\/models\/([^/]+)\/?$/;
const OPENAI_ENGINES_ID = /^\/v1\/engines\/([^/]+)\/?$/;
const OPENAI_ENGINE_CHAT_COMPLETIONS = /^\/v1\/engines\/([^/]+)\/chat\/completions\/?$/;
const OPENAI_ENGINE_COMPLETIONS = /^\/v1\/engines\/([^/]+)\/completions\/?$/;
const OPENAI_MODELS_ID_ALIAS = /^\/models\/([^/]+)\/?$/;
const OPENAI_ENGINES_ID_ALIAS = /^\/engines\/([^/]+)\/?$/;
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
      if (typeof requestBody.messages?.[replacement.index]?.content === "string") {
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
        guardrailsEngine,
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
      : chatResponseCache.describeCacheCandidate(requestBody, gatewayInput);
    const cacheLookup = cacheCandidate
      ? chatResponseCache.lookup({ candidate: cacheCandidate, tenantIdentity: request.enterpriseIdentity })
      : null;
    if (cacheLookup?.payload.kind === "json") {
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
      recordVirtualKeyUsage({
        enterpriseGovernanceService,
        request,
        writeServiceLog,
        tokens: Number(cacheLookup.payload.response?.usage?.total_tokens ?? 0)
          || estimateTokens(gatewayInput).estimatedInputTokens,
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
      const outputVerdict = guardrailsEngine.inspectOutputText(outputContent);
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
    recordVirtualKeyUsage({
      enterpriseGovernanceService,
      request,
      writeServiceLog,
      tokens: Number(result.data?.usage?.totalTokens ?? 0)
        || estimateTokens(gatewayInput).estimatedInputTokens,
    });
    if (cacheCandidate) {
      chatResponseCache.persist({
        candidate: cacheCandidate,
        tenantIdentity: request.enterpriseIdentity,
        payload: { kind: "json", response: chatCompletion },
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

  if (request.method === "POST" && normalizedPath === RESPONSES_PATH) {
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

async function handleAnthropicMessages({
  gatewayService,
  enterpriseGovernanceService,
  application,
  request,
  response,
  startedAt,
  writeServiceLog,
  url,
}) {
  let body;
  try {
    body = await readJson(request);
  } catch {
    writeJson(response, 400, createAnthropicError({
      code: "invalid_json",
      category: "validation",
      message: "Request body must be valid JSON.",
    }));
    return;
  }
  let managedLocalClientPrincipal = null;
  try {
    managedLocalClientPrincipal = await authenticateManagedLocalClientProtocolRequest({
      application,
      request,
      url,
      requestBody: body,
    });
  } catch (error) {
    writeJson(response, resolveOpenAiErrorStatus(error), createAnthropicError(error));
    return;
  }

  // Guardrails（确定性本地扫描）：与 /v1/chat/completions 同一引擎，作用于
  // 归一化前的原始请求，拦截/脱敏覆盖 JSON、流式与缓存路径。
  const anthropicGuardrailsEngine = getGuardrailsEngine(request.enterpriseIdentity?.tenantId);
  const anthropicGuardrailVerdict = anthropicGuardrailsEngine.inspectInput(body);
  if (anthropicGuardrailVerdict.decision === "block") {
    recordGuardrailEvaluation("input", "block");
    for (const finding of anthropicGuardrailVerdict.findings) {
      if (finding.action === "block") recordGuardrailFinding(finding.rule, finding.action);
    }
    writeServiceLog?.("anthropic_messages_guardrail_blocked", {
      method: request.method,
      path: ANTHROPIC_MESSAGES_PATH,
      findings: anthropicGuardrailVerdict.findings,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 400, createAnthropicError({
      code: "guardrail_blocked",
      category: "governance",
      message: "Request blocked by chat guardrails.",
      param: "messages",
    }));
    return;
  }
  if (anthropicGuardrailVerdict.findings.length) {
    recordGuardrailEvaluation("input", "allow");
    for (const finding of anthropicGuardrailVerdict.findings) {
      recordGuardrailFinding(finding.rule, finding.action);
    }
    writeServiceLog?.("anthropic_messages_guardrail_findings", {
      method: request.method,
      path: ANTHROPIC_MESSAGES_PATH,
      findings: anthropicGuardrailVerdict.findings,
      durationMs: Date.now() - startedAt,
    });
  }
  for (const replacement of anthropicGuardrailVerdict.replacements) {
    if (typeof body.messages?.[replacement.index]?.content === "string") {
      body.messages[replacement.index].content = replacement.content;
    }
  }

  let gatewayInput;
  try {
    gatewayInput = normalizeAnthropicMessageRequest(
      body,
      gatewayService.getProviderDescriptors(),
    );
  } catch (error) {
    writeServiceLog?.("anthropic_messages_validation_failed", {
      method: request.method,
      path: ANTHROPIC_MESSAGES_PATH,
      code: error?.code,
      param: error?.param,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 400, createAnthropicError(error));
    return;
  }

  if (managedLocalClientPrincipal) {
    try {
      const managedRoute = await resolveManagedLocalClientProviderRoute({
        application,
        principal: managedLocalClientPrincipal,
        gatewayInput,
      });
      gatewayInput = applyManagedLocalClientProviderRoute(gatewayInput, managedRoute);
      response.setHeader("X-AI-Gateway-Local-Client-Routing", "policy-pinned");
      response.setHeader("X-AI-Gateway-Local-Client-Policy-Revision", managedRoute.policyRevision);
      response.setHeader("X-AI-Gateway-Local-Client-Revision", String(managedRoute.clientRevision));
      response.setHeader("X-AI-Gateway-Local-Client-Decision-Digest", managedRoute.decisionDigest);
    } catch (error) {
      writeJson(response, resolveOpenAiErrorStatus(error), createAnthropicError(error));
      return;
    }
  }

  if (body.stream === true) {
    await streamAnthropicMessage({
      body,
      gatewayInput,
      gatewayService,
      enterpriseGovernanceService,
      request,
      response,
      startedAt,
      writeServiceLog,
    });
    return;
  }

  if (applyVirtualKeyRequestGate({
    enterpriseGovernanceService,
    request,
    gatewayInput,
    response,
    writeServiceLog,
    startedAt,
    path: ANTHROPIC_MESSAGES_PATH,
    errorFactory: createAnthropicError,
  })) {
    return;
  }

  const result = await gatewayService.execute(gatewayInput);
  if (!result.success) {
    const error = result.error ?? {
      code: result.code,
      message: result.message,
      category: "provider",
    };
    writeServiceLog?.("anthropic_messages_failed", {
      method: request.method,
      path: ANTHROPIC_MESSAGES_PATH,
      code: error.code,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, resolveOpenAiErrorStatus(error), createAnthropicError(
      error,
      result.meta?.requestId,
    ));
    return;
  }

  writeServiceLog?.("anthropic_messages_completed", {
    method: request.method,
    path: ANTHROPIC_MESSAGES_PATH,
    provider: result.data?.selectedProvider,
    model: result.data?.selectedModel,
    executionMode: result.data?.executionMode,
    durationMs: Date.now() - startedAt,
  });
  recordVirtualKeyUsage({
    enterpriseGovernanceService,
    request,
    writeServiceLog,
    tokens: Number(result.data?.usage?.totalTokens ?? 0)
      || estimateTokens(gatewayInput).estimatedInputTokens,
    path: ANTHROPIC_MESSAGES_PATH,
  });
  const anthropicMessage = createAnthropicMessage(result, {
    requestedModel: body.model,
    messages: gatewayInput.messages,
  });
  // Guardrails 输出侧（JSON）：对最终文本块脱敏/拦截，fail-open 不影响正常响应。
  const anthropicOutputText = anthropicMessage?.content
    ?.filter((block) => block?.type === "text")
    .map((block) => block?.text ?? "")
    .join("");
  if (typeof anthropicOutputText === "string" && anthropicOutputText) {
    const anthropicOutputVerdict = anthropicGuardrailsEngine.inspectOutputText(anthropicOutputText);
    if (anthropicOutputVerdict.decision === "block") {
      recordGuardrailEvaluation("output", "block");
      for (const finding of anthropicOutputVerdict.findings) {
        if (finding.action === "block") recordGuardrailFinding(finding.rule, finding.action);
      }
      writeServiceLog?.("anthropic_messages_guardrail_output_blocked", {
        method: request.method,
        path: ANTHROPIC_MESSAGES_PATH,
        findings: anthropicOutputVerdict.findings,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 400, createAnthropicError({
        code: "guardrail_blocked",
        category: "governance",
        message: "Response blocked by chat guardrails.",
        param: "messages",
      }));
      return;
    }
    if (anthropicOutputVerdict.findings.length) {
      recordGuardrailEvaluation("output", "allow");
      for (const finding of anthropicOutputVerdict.findings) {
        recordGuardrailFinding(finding.rule, finding.action);
      }
    }
    if (anthropicOutputVerdict.text !== anthropicOutputText) {
      for (const block of anthropicMessage.content ?? []) {
        if (block?.type === "text" && block.text) {
          block.text = anthropicGuardrailsEngine.inspectOutputText(block.text).text;
        }
      }
    }
  }
  writeJson(response, 200, anthropicMessage);
}

export function normalizeAnthropicMessageRequest(body, descriptors = []) {
  if (!isRecord(body)) {
    throw createAnthropicValidationError("Request body must be a JSON object.", null);
  }

  const supportedFields = new Set([
    "model",
    "max_tokens",
    "messages",
    "system",
    "stop_sequences",
    "stream",
    "temperature",
    "top_p",
    "metadata",
    "tools",
    "tool_choice",
    "unified_ai",
    "provider_id",
    "prompt_enhancement",
  ]);
  for (const field of Object.keys(body)) {
    if (!supportedFields.has(field)) {
      throw createAnthropicUnsupportedError(
        `${field} is not supported by this Anthropic compatibility profile.`,
        field,
      );
    }
  }

  const requestedModel = readRequiredString(body.model, "model");
  if (!Number.isInteger(body.max_tokens) || body.max_tokens < 1) {
    throw createAnthropicValidationError(
      "max_tokens must be a positive integer.",
      "max_tokens",
    );
  }
  validateOptionalBoolean(body.stream, "stream");

  const conversation = normalizeAnthropicConversation(body.messages);
  const systemText = normalizeAnthropicSystem(body.system);
  // prompt caching:system 块断点同样只接受 ephemeral,且计入 4 个总上限。
  const systemHasBreakpoint = Array.isArray(body.system)
    && body.system.some((block) => isRecord(block) && block.cache_control !== undefined);
  if (systemHasBreakpoint) {
    for (const [blockIndex, block] of body.system.entries()) {
      if (!isRecord(block) || block.cache_control === undefined) continue;
      if (!isRecord(block.cache_control) || block.cache_control.type !== "ephemeral") {
        throw createAnthropicValidationError(
          `system[${blockIndex}].cache_control must be { "type": "ephemeral" }.`,
          `system[${blockIndex}].cache_control`,
        );
      }
    }
    if (systemHasBreakpoint && conversation.cacheBreakpoints.length + 1 > 4) {
      throw createAnthropicValidationError(
        "At most 4 cache_control breakpoints are allowed per request.",
        "system",
      );
    }
  }
  const messages = systemText
    ? [{ role: "system", content: systemText }, ...conversation.messages]
    : conversation.messages;
  const target = resolveOpenAiModelTarget(requestedModel, descriptors);
  const extension = normalizeUnifiedAiExtension(body);
  const tools = normalizeAnthropicTools(body.tools);
  const toolChoice = normalizeAnthropicToolChoice(body.tool_choice, tools);
  const options = {
    maxOutputTokens: body.max_tokens,
  };

  if (body.temperature !== undefined) {
    options.temperature = readNumberInRange(body.temperature, "temperature", 0, 1);
  }
  if (body.top_p !== undefined) {
    options.topP = readNumberInRange(body.top_p, "top_p", 0, 1);
  }
  if (body.stop_sequences !== undefined) {
    if (
      !Array.isArray(body.stop_sequences)
      || body.stop_sequences.length > 4
      || body.stop_sequences.some((item) => typeof item !== "string" || item.length === 0)
    ) {
      throw createAnthropicValidationError(
        "stop_sequences must be an array of at most four non-empty strings.",
        "stop_sequences",
      );
    }
    if (body.stop_sequences.length > 0) {
      options.stopSequences = [...body.stop_sequences];
    }
  }
  // prompt caching:断点信息随 options 传递,出站 adapter 重挂到对应块。
  const anthropicCacheControl = {
    ...(systemHasBreakpoint ? { systemBreakpoint: true } : {}),
    ...(conversation.cacheBreakpoints.length > 0 ? { messageIndexes: conversation.cacheBreakpoints } : {}),
  };
  if (Object.keys(anthropicCacheControl).length > 0) {
    options.anthropicCacheControl = anthropicCacheControl;
  }

  let metadataUserIdPresent = false;
  if (body.metadata !== undefined) {
    if (!isRecord(body.metadata)) {
      throw createAnthropicValidationError("metadata must be an object.", "metadata");
    }
    for (const key of Object.keys(body.metadata)) {
      if (key !== "user_id") {
        throw createAnthropicUnsupportedError(
          `metadata.${key} is not supported by this Anthropic compatibility profile.`,
          `metadata.${key}`,
        );
      }
    }
    if (
      body.metadata.user_id !== undefined
      && (typeof body.metadata.user_id !== "string" || body.metadata.user_id.length > 256)
    ) {
      throw createAnthropicValidationError(
        "metadata.user_id must be a string no longer than 256 characters.",
        "metadata.user_id",
      );
    }
    metadataUserIdPresent = typeof body.metadata.user_id === "string";
  }

  const gatewayInput = {
    taskType: "chat",
    messages,
    model: target.modelId,
    providerId: extension.providerId ?? target.providerId,
    ...(tools ? { tools } : {}),
    ...(toolChoice ? { toolChoice } : {}),
    options,
    metadata: {
      source: "anthropic-compatible-api",
      anthropicCompatibility: {
        requestedModel,
        stream: body.stream === true,
        systemPresent: Boolean(systemText),
        metadataUserIdPresent,
        ...(tools ? { toolCount: tools.length } : {}),
      },
    },
  };

  return extension.promptEnhancement?.enabled === true
    ? applyPromptEnhancement(gatewayInput, extension.promptEnhancement)
    : gatewayInput;
}

function normalizeAnthropicConversation(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw createAnthropicValidationError(
      "messages must contain at least one message.",
      "messages",
    );
  }

  const normalized = [];
  const cacheBreakpoints = [];
  let breakpointCount = 0;
  messages.forEach((message, index) => {
    const param = `messages[${index}]`;
    if (!isRecord(message)) {
      throw createAnthropicValidationError(`${param} must be an object.`, param);
    }
    for (const key of Object.keys(message)) {
      if (key !== "role" && key !== "content") {
        throw createAnthropicUnsupportedError(
          `${param}.${key} is not supported by this Anthropic compatibility profile.`,
          `${param}.${key}`,
        );
      }
    }
    if (message.role !== "user" && message.role !== "assistant") {
      throw createAnthropicValidationError(
        `${param}.role must be 'user' or 'assistant'.`,
        param,
      );
    }
    // prompt caching:cache_control 断点(仅支持 ephemeral)。
    // 断点按消息级记录(Anthropic 上限 4 个),并在出站侧重挂到该消息最后一块。
    if (Array.isArray(message.content)) {
      for (const [blockIndex, block] of message.content.entries()) {
        if (!isRecord(block) || block.cache_control === undefined) continue;
        if (!isRecord(block.cache_control) || block.cache_control.type !== "ephemeral") {
          throw createAnthropicValidationError(
            `${param}.content[${blockIndex}].cache_control must be { "type": "ephemeral" }.`,
            `${param}.content[${blockIndex}].cache_control`,
          );
        }
        breakpointCount += 1;
        if (breakpointCount > 4) {
          throw createAnthropicValidationError(
            "At most 4 cache_control breakpoints are allowed per request.",
            "messages",
          );
        }
      }
    }
    const produced = normalizeAnthropicMessageBlocks(message, param);
    const hadBreakpoint = Array.isArray(message.content)
      && message.content.some((block) => isRecord(block) && block.cache_control !== undefined);
    normalized.push(...produced);
    if (hadBreakpoint) {
      cacheBreakpoints.push(normalized.length - 1);
    }
  });
  return { messages: normalized, cacheBreakpoints };
}

// One Anthropic message can flatten into several gateway messages:
// assistant tool_use blocks become tool_calls on the assistant message, and
// user tool_result blocks become follow-up `tool` messages.
function normalizeAnthropicMessageBlocks(message, param) {
  if (typeof message.content === "string") {
    return [{ role: message.role, content: message.content }];
  }
  if (!Array.isArray(message.content) || message.content.length === 0) {
    throw createAnthropicValidationError(
      `${param}.content must be a string or a non-empty array of content blocks.`,
      `${param}.content`,
    );
  }

  const textParts = [];
  const toolUses = [];
  const toolResults = [];
  message.content.forEach((block, index) => {
    const blockParam = `${param}.content[${index}]`;
    if (!isRecord(block)) {
      throw createAnthropicValidationError(`${blockParam} must be an object.`, blockParam);
    }
    if (block.type === "text") {
      textParts.push(readRequiredString(block.text, `${blockParam}.text`));
      return;
    }
    if (block.type === "tool_use") {
      if (message.role !== "assistant") {
        throw createAnthropicValidationError(
          `${blockParam} tool_use blocks are allowed only in assistant messages.`,
          blockParam,
        );
      }
      toolUses.push({
        id: readRequiredString(block.id, `${blockParam}.id`),
        name: readRequiredString(block.name, `${blockParam}.name`),
        input: isRecord(block.input) || block.input === undefined ? block.input ?? {} : block.input,
      });
      return;
    }
    if (block.type === "tool_result") {
      if (message.role !== "user") {
        throw createAnthropicValidationError(
          `${blockParam} tool_result blocks are allowed only in user messages.`,
          blockParam,
        );
      }
      toolResults.push({
        toolUseId: readRequiredString(block.tool_use_id, `${blockParam}.tool_use_id`),
        content: normalizeAnthropicToolResultContent(block.content, `${blockParam}.content`),
      });
      return;
    }
    throw createAnthropicUnsupportedError(
      `${blockParam}.type '${String(block.type)}' is not supported; only text, tool_use, and tool_result blocks are enabled.`,
      `${blockParam}.type`,
    );
  });

  const text = textParts.join("");
  if (message.role === "assistant") {
    return [{
      role: "assistant",
      content: text,
      ...(toolUses.length > 0 ? {
        tool_calls: toolUses.map((use) => ({
          id: use.id,
          type: "function",
          function: { name: use.name, arguments: JSON.stringify(use.input ?? {}) },
        })),
      } : {}),
    }];
  }

  const out = [];
  // Tool results must directly follow the assistant tool_use turn on the
  // chat wire, so they are emitted before the remaining user text.
  for (const result of toolResults) {
    out.push({
      role: "tool",
      tool_call_id: result.toolUseId,
      content: result.content,
    });
  }
  if (text.trim() || toolResults.length === 0) {
    out.push({ role: "user", content: text });
  }
  return out;
}

function normalizeAnthropicToolResultContent(content, param) {
  if (content === undefined || content === null) return "";
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) {
    throw createAnthropicValidationError(
      `${param} must be a string or an array of text blocks.`,
      param,
    );
  }
  return content.map((block, index) => {
    const blockParam = `${param}[${index}]`;
    if (!isRecord(block) || block.type !== "text") {
      throw createAnthropicUnsupportedError(
        `${blockParam} only text blocks are supported inside tool_result content.`,
        blockParam,
      );
    }
    return readRequiredString(block.text, `${blockParam}.text`);
  }).join("\n");
}

function normalizeAnthropicTools(value) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw createAnthropicValidationError("tools must be an array.", "tools");
  }
  if (value.length === 0) return undefined;
  if (value.length > 128) {
    throw createAnthropicValidationError("tools cannot contain more than 128 entries.", "tools");
  }
  return value.map((tool, index) => {
    const param = `tools[${index}]`;
    if (!isRecord(tool)) {
      throw createAnthropicValidationError(`${param} must be an object.`, param);
    }
    const fn = { name: readRequiredString(tool.name, `${param}.name`) };
    if (tool.description !== undefined && tool.description !== null) {
      if (typeof tool.description !== "string") {
        throw createAnthropicValidationError(`${param}.description must be a string.`, `${param}.description`);
      }
      fn.description = tool.description;
    }
    if (tool.input_schema !== undefined && tool.input_schema !== null) {
      if (!isRecord(tool.input_schema)) {
        throw createAnthropicValidationError(`${param}.input_schema must be an object.`, `${param}.input_schema`);
      }
      fn.parameters = tool.input_schema;
    }
    return { type: "function", function: fn };
  });
}

function normalizeAnthropicToolChoice(value, tools) {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    throw createAnthropicValidationError("tool_choice must be an object.", "tool_choice");
  }
  if (value.type === "auto") return "auto";
  if (value.type === "any") return "required";
  if (value.type === "tool") {
    const name = readRequiredString(value.name, "tool_choice.name");
    return { type: "function", function: { name } };
  }
  throw createAnthropicUnsupportedError(
    "tool_choice.type must be 'auto', 'any', or 'tool'.",
    "tool_choice.type",
  );
}

function normalizeAnthropicSystem(system) {
  if (system === undefined || system === null) return "";
  return normalizeAnthropicTextContent(system, "system");
}

function normalizeAnthropicTextContent(content, param) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content) || content.length === 0) {
    throw createAnthropicValidationError(
      `${param} must be a string or a non-empty array of text blocks.`,
      param,
    );
  }

  return content.map((block, index) => {
    const blockParam = `${param}[${index}]`;
    if (!isRecord(block)) {
      throw createAnthropicValidationError(`${blockParam} must be an object.`, blockParam);
    }
    if (block.type !== "text") {
      throw createAnthropicUnsupportedError(
        `${blockParam}.type '${String(block.type)}' is not supported; only text blocks are enabled.`,
        `${blockParam}.type`,
      );
    }
    for (const key of Object.keys(block)) {
      // cache_control 由装配层的 prompt-caching 校验单独处理并重挂出站。
      if (key !== "type" && key !== "text" && key !== "cache_control") {
        throw createAnthropicUnsupportedError(
          `${blockParam}.${key} is not supported by this Anthropic compatibility profile.`,
          `${blockParam}.${key}`,
        );
      }
    }
    return readRequiredString(block.text, `${blockParam}.text`);
  }).join("");
}

export function createAnthropicMessage(result, options = {}) {
  const data = result.data ?? {};
  const text = data.message?.content ?? data.outputText ?? data.text ?? "";
  const usage = data.usage ?? {};
  const requestId = result.meta?.requestId ?? data.id;
  const toolCalls = readAnthropicToolCalls(data.message);

  const content = [];
  if (String(text).trim() || toolCalls.length === 0) {
    content.push({ type: "text", text: String(text) });
  }
  for (const toolCall of toolCalls) {
    content.push({
      type: "tool_use",
      id: toolCall.id,
      name: toolCall.function.name,
      input: safeParseAnthropicToolInput(toolCall.function.arguments),
    });
  }

  return {
    id: toAnthropicMessageId(data.id ?? requestId),
    type: "message",
    role: "assistant",
    model: data.selectedModel ?? data.model ?? options.requestedModel,
    content,
    stop_reason: toolCalls.length > 0
      ? "tool_use"
      : normalizeAnthropicStopReason(data.finishReason),
    stop_sequence: data.stopSequence ?? null,
    usage: {
      input_tokens: usage.inputTokens ?? estimateAnthropicInputTokens(options.messages),
      output_tokens: usage.outputTokens ?? estimateCompatibilityTokens(text),
    },
    unified_ai: createAnthropicUnifiedAiMetadata(data, requestId),
  };
}

function readAnthropicToolCalls(message) {
  const raw = message?.tool_calls ?? message?.toolCalls;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.filter((toolCall) => toolCall?.function && typeof toolCall.function.name === "string")
    .map((toolCall) => ({
      id: toolCall.id ?? `toolu_${String(toolCall.function.name).slice(0, 12)}_${Date.now()}`,
      function: {
        name: toolCall.function.name,
        arguments: typeof toolCall.function.arguments === "string"
          ? toolCall.function.arguments
          : JSON.stringify(toolCall.function.arguments ?? {}),
      },
    }));
}

function safeParseAnthropicToolInput(argumentsText) {
  if (typeof argumentsText !== "string" || !argumentsText.trim()) return {};
  try {
    const parsed = JSON.parse(argumentsText);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return { _raw: argumentsText };
  }
}

export function createAnthropicError(error, requestId) {
  const category = error?.category ?? error?.type;
  const type = category === "auth"
    ? "authentication_error"
    : category === "rate_limit"
      ? "rate_limit_error"
      : category === "validation" || category === "routing"
        ? "invalid_request_error"
        : "api_error";
  return {
    type: "error",
    error: {
      type,
      message: error?.message ?? "Anthropic-compatible request failed.",
    },
    ...(requestId ? { request_id: requestId } : {}),
  };
}

async function streamAnthropicMessage({
  body,
  gatewayInput,
  gatewayService,
  enterpriseGovernanceService,
  request,
  response,
  startedAt,
  writeServiceLog,
}) {
  if (applyVirtualKeyRequestGate({
    enterpriseGovernanceService,
    request,
    gatewayInput,
    response,
    writeServiceLog,
    startedAt,
    path: ANTHROPIC_MESSAGES_PATH,
    errorFactory: createAnthropicError,
  })) {
    return;
  }

  let clientClosed = false;
  let failed = false;
  let started = false;
  let contentBlockStarted = false;
  let messageId = null;
  let selectedModel = body.model;
  let selectedProvider = null;
  let executionMode = null;
  let outputText = "";
  let finalEvent = null;
  const accumulatedToolCalls = new Map();
  const inputTokens = estimateAnthropicInputTokens(gatewayInput.messages);

  response.on("close", () => {
    clientClosed = true;
  });
  const primedStream = await primeGatewayStream(gatewayService.executeStream(gatewayInput));
  const preflightError = readPrimedGatewayStreamError(primedStream);
  const preflightStatus = resolveProviderDispatchHttpStatus(preflightError?.code);
  if (preflightError && preflightStatus !== null) {
    await closePrimedGatewayStream(primedStream);
    writeServiceLog?.("anthropic_messages_stream_failed", {
      method: request.method,
      path: ANTHROPIC_MESSAGES_PATH,
      code: preflightError.code,
      durationMs: Date.now() - startedAt,
    });
    writeJson(
      response,
      preflightStatus,
      createAnthropicError(preflightError),
    );
    return;
  }
  writeSseHeaders(response);

  const ensureStarted = (event = {}) => {
    if (started || clientClosed) return;
    messageId = toAnthropicMessageId(event.requestId);
    selectedModel = event.selectedModel ?? selectedModel;
    selectedProvider = event.selectedProvider ?? selectedProvider;
    executionMode = event.executionMode ?? executionMode;
    writeAnthropicSseEvent(response, "message_start", {
      type: "message_start",
      message: {
        id: messageId,
        type: "message",
        role: "assistant",
        model: selectedModel,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: inputTokens, output_tokens: 0 },
        unified_ai: createAnthropicUnifiedAiMetadata({
          selectedProvider,
          selectedModel,
          executionMode,
        }, event.requestId),
      },
    });
    writeAnthropicSseEvent(response, "content_block_start", {
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    });
    contentBlockStarted = true;
    started = true;
  };

  for await (const event of iteratePrimedGatewayStream(primedStream)) {
    if (clientClosed) break;
    if (event.type === "error") {
      failed = true;
      writeAnthropicSseEvent(
        response,
        "error",
        createAnthropicError(event.envelope?.error ?? event.envelope, event.requestId),
      );
      break;
    }

    ensureStarted(event);
    selectedModel = event.selectedModel ?? selectedModel;
    selectedProvider = event.selectedProvider ?? selectedProvider;
    executionMode = event.executionMode ?? executionMode;
    if (event.type === "chunk" && typeof event.textDelta === "string" && event.textDelta) {
      // Guardrails 输出侧（流式）：与 /v1/chat/completions 同一引擎，逐 delta
      // 尽力脱敏；fail-open 保证流不中断。
      const redactedAnthropicDelta = getGuardrailsEngine(request.enterpriseIdentity?.tenantId).inspectSseDelta(event.textDelta);
      if (redactedAnthropicDelta !== event.textDelta) {
        event.textDelta = redactedAnthropicDelta;
      }
      outputText += event.textDelta;
      writeAnthropicSseEvent(response, "content_block_delta", {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: event.textDelta },
      });
    }
    if (Array.isArray(event.rawProviderMeta?.toolCallsDelta)) {
      for (const deltaCall of event.rawProviderMeta.toolCallsDelta) {
        if (!deltaCall || typeof deltaCall !== "object") continue;
        const index = Number.isInteger(deltaCall.index) ? deltaCall.index : 0;
        const current = accumulatedToolCalls.get(index) ?? {
          id: null,
          function: { name: "", arguments: "" },
        };
        if (typeof deltaCall.id === "string" && deltaCall.id) current.id = deltaCall.id;
        if (deltaCall.function?.name) current.function.name += deltaCall.function.name;
        if (typeof deltaCall.function?.arguments === "string") {
          current.function.arguments += deltaCall.function.arguments;
        }
        accumulatedToolCalls.set(index, current);
      }
    }
    if (event.type === "done") finalEvent = event;
  }

  writeServiceLog?.(failed ? "anthropic_messages_stream_failed" : "anthropic_messages_stream_completed", {
    method: request.method,
    path: ANTHROPIC_MESSAGES_PATH,
    model: selectedModel,
    provider: selectedProvider,
    executionMode,
    durationMs: Date.now() - startedAt,
  });
  if (!failed) {
    recordVirtualKeyUsage({
      enterpriseGovernanceService,
      request,
      writeServiceLog,
      tokens: inputTokens + estimateCompatibilityTokens(outputText),
      path: ANTHROPIC_MESSAGES_PATH,
    });
  }

  if (!clientClosed) {
    if (!failed) {
      ensureStarted(finalEvent ?? {});
      const streamedToolCalls = [...accumulatedToolCalls.values()]
        .filter((call) => call.function.name);
      if (contentBlockStarted) {
        writeAnthropicSseEvent(response, "content_block_stop", {
          type: "content_block_stop",
          index: 0,
        });
      }
      // Tool calls are emitted as complete tool_use blocks (start + one full
      // input_json_delta + stop) after the text block.
      streamedToolCalls.forEach((call, callIndex) => {
        const blockIndex = callIndex + 1;
        const blockId = call.id ?? `toolu_stream_${blockIndex}`;
        writeAnthropicSseEvent(response, "content_block_start", {
          type: "content_block_start",
          index: blockIndex,
          content_block: {
            type: "tool_use",
            id: blockId,
            name: call.function.name,
            input: {},
          },
        });
        writeAnthropicSseEvent(response, "content_block_delta", {
          type: "content_block_delta",
          index: blockIndex,
          delta: {
            type: "input_json_delta",
            partial_json: call.function.arguments || "{}",
          },
        });
        writeAnthropicSseEvent(response, "content_block_stop", {
          type: "content_block_stop",
          index: blockIndex,
        });
      });
      writeAnthropicSseEvent(response, "message_delta", {
        type: "message_delta",
        delta: {
          stop_reason: streamedToolCalls.length > 0
            ? "tool_use"
            : normalizeAnthropicStopReason(finalEvent?.rawProviderMeta?.finishReason),
          stop_sequence: null,
        },
        usage: { output_tokens: estimateCompatibilityTokens(outputText) },
      });
      writeAnthropicSseEvent(response, "message_stop", { type: "message_stop" });
    }
    response.end();
  }
}

function writeAnthropicSseEvent(response, eventName, data) {
  if (!response.writableEnded && !response.destroyed) {
    response.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

function createAnthropicValidationError(message, param) {
  return Object.assign(new Error(message), {
    code: "invalid_request",
    category: "validation",
    param,
  });
}

function createAnthropicUnsupportedError(message, param) {
  return Object.assign(new Error(message), {
    code: "unsupported_parameter",
    category: "validation",
    param,
  });
}

function toAnthropicMessageId(value) {
  const normalized = String(value ?? Date.now().toString(36))
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 96);
  return normalized.startsWith("msg_") ? normalized : `msg_${normalized || "generated"}`;
}

function normalizeAnthropicStopReason(value) {
  if (value === "max_tokens" || value === "length") return "max_tokens";
  if (value === "tool_use" || value === "tool_calls") return "tool_use";
  if (value === "stop_sequence") return "stop_sequence";
  return "end_turn";
}

function estimateAnthropicInputTokens(messages = []) {
  const text = (messages ?? []).map((message) => message?.content ?? "").join("\n");
  return estimateCompatibilityTokens(text);
}

function createAnthropicUnifiedAiMetadata(data = {}, requestId) {
  return {
    provider_id: data.selectedProvider ?? data.providerId ?? null,
    model: data.selectedModel ?? data.model ?? null,
    execution_mode: data.executionMode ?? null,
    request_id: requestId ?? null,
  };
}

// n（并行候选数）上限：保护无凭证 fake lane 不被 n 放大成拒绝服务向量。
const MAX_CHOICE_COUNT = 8;

function normalizeChoiceCount(value) {
  if (value === undefined || value === null) return 1;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_CHOICE_COUNT) {
    throw createUnsupportedError(`n must be an integer between 1 and ${MAX_CHOICE_COUNT}.`, "n");
  }
  return count;
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

export function applyVirtualKeyRequestGate({
  enterpriseGovernanceService,
  request,
  gatewayInput,
  response,
  writeServiceLog,
  startedAt,
  path = CHAT_COMPLETIONS_PATH,
  errorFactory = createOpenAiError,
}) {
  const fingerprint = request?.enterpriseIdentity?.apiKeyFingerprint;
  if (!fingerprint) return false;
  const manager = enterpriseGovernanceService?.getApiKeyManager?.();
  // 接线缺失时 fail-open：虚拟 key 认证已由治理层完成，缺记账器不应阻断请求。
  if (!manager) return false;

  const estimatedInputTokens = estimateTokens(gatewayInput).estimatedInputTokens;
  const decision = manager.authorizeUsage({ keyId: fingerprint, estimatedTokens: estimatedInputTokens });
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

export function recordVirtualKeyUsage({
  enterpriseGovernanceService,
  request,
  writeServiceLog,
  tokens,
  path = CHAT_COMPLETIONS_PATH,
}) {
  const fingerprint = request?.enterpriseIdentity?.apiKeyFingerprint;
  if (!fingerprint) return;
  const manager = enterpriseGovernanceService?.getApiKeyManager?.();
  if (!manager) return;
  try {
    const result = manager.recordUsage({ keyId: fingerprint, tokens });
    if (result.softBudgetExceeded) {
      writeServiceLog?.("virtual_key_soft_budget", {
        path,
        keyFingerprint: fingerprint,
        tokensUsed: result.budget?.tokensUsed ?? null,
        limitTokens: result.budget?.limitTokens ?? null,
      });
    }
  } catch {
    // 记账失败不影响响应。
  }
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
  recordVirtualKeyUsage({
    enterpriseGovernanceService,
    request,
    writeServiceLog,
    tokens: promptTokens + completionTokens,
  });
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
    : chatResponseCache.describeCacheCandidate(body, gatewayInput);
  const cacheLookup = cacheCandidate
    ? chatResponseCache.lookup({ candidate: cacheCandidate, tenantIdentity: request.enterpriseIdentity })
    : null;
  if (cacheLookup?.payload.kind === "sse") {
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
        totalTokens: Number(cacheLookup.payload.usageChunk?.usage?.total_tokens ?? 0) || undefined,
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
    recordVirtualKeyUsage({
      enterpriseGovernanceService,
      request,
      writeServiceLog,
      tokens: Number(cacheLookup.payload.usageChunk?.usage?.total_tokens ?? 0)
        || estimateTokens(gatewayInput).estimatedInputTokens,
    });
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
  const preflightStatus = resolveProviderDispatchHttpStatus(preflightError?.code);
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
  let firstTokenAt = 0;

  const consumeProviderStream = async (choiceIndex, primedStream) => {
    const stream = primedStream ?? await primeGatewayStream(gatewayService.executeStream(gatewayInput));
    for await (const event of iteratePrimedGatewayStream(stream)) {
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
        // Guardrails 输出侧（流式）：对每个 delta 尽力脱敏（跨块边界的模式以
        // 完成后的审计发现兜底），fail-open 保证流不中断。
        const redactedDelta = getGuardrailsEngine(request.enterpriseIdentity?.tenantId).inspectSseDelta(event.textDelta);
        if (redactedDelta !== event.textDelta) {
          event.textDelta = redactedDelta;
        }
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
    recordVirtualKeyUsage({
      enterpriseGovernanceService,
      request,
      writeServiceLog,
      tokens: Number(finalEvent?.rawProviderMeta?.usage?.totalTokens ?? 0)
        || (estimateTokens(gatewayInput).estimatedInputTokens + estimateTextTokens(streamOutputText)),
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

  response.on("close", () => {
    clientClosed = true;
  });
  const firstPrimedStream = await primeGatewayStream(gatewayService.executeStream(gatewayInput));
  const preflightError = readPrimedGatewayStreamError(firstPrimedStream);
  const preflightStatus = resolveProviderDispatchHttpStatus(preflightError?.code);
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
    for await (const event of iteratePrimedGatewayStream(stream)) {
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

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function estimateCompatibilityTokens(text) {
  return Math.max(1, Math.ceil(String(text).length / 4));
}

const MANAGED_LOCAL_CLIENT_PROTOCOL_ID_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;

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
      || application?.localClientManagedProtocolDispatchStatus?.ready !== true
    ) {
      throw createManagedLocalClientAuthError();
    }
    return await application.localClientPopHttpAuth.authenticate({
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

function createManagedLocalClientAuthError() {
  const error = new Error("Managed local-client proof authorization failed.");
  error.code = "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED";
  error.category = "auth";
  error.status = 401;
  error.retryable = false;
  return error;
}

function createManagedLocalClientRouteError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.category = "routing";
  error.status = 409;
  error.retryable = false;
  return error;
}

function normalizeUnifiedAiExtension(body) {
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
function normalizeUnifiedAiRag(rawRag) {
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
const modelListMemo = new WeakMap();
function resolveOpenAiModelTarget(requestedModel, descriptors) {
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

function buildModelRows(descriptors) {
  const available = listAvailableModels(descriptors);
  const counts = new Map();
  for (const item of available) {
    counts.set(item.model.id, (counts.get(item.model.id) ?? 0) + 1);
  }
  return { available, counts };
}

function listAvailableModels(descriptors) {
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

function normalizeFinishReason(value) {
  if (value === "length") return "length";
  if (value === "filtered") return "content_filter";
  if (value === "tool_call" || value === "tool_calls") return "tool_calls";
  return "stop";
}

function writeOpenAiSseData(response, data) {
  if (!response.writableEnded && !response.destroyed) {
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

export function resolveOpenAiErrorStatus(error) {
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

function validateOptionalBoolean(value, param) {
  if (value !== undefined && typeof value !== "boolean") {
    throw createValidationError(`${param} must be a boolean.`, param);
  }
}

function readRequiredString(value, param) {
  if (typeof value !== "string" || !value.trim()) {
    throw createValidationError(`${param} must be a non-empty string.`, param);
  }
  return value.trim();
}

function readNumberInRange(value, param, min, max) {
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

function toOpenAiCompletionId(value) {
  const suffix = String(value ?? Date.now()).replace(/[^a-zA-Z0-9_-]/g, "").slice(-48);
  return suffix.startsWith("chatcmpl-") ? suffix : `chatcmpl-${suffix}`;
}
