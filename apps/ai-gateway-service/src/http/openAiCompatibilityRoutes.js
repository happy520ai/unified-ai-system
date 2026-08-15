import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { getChatResponseCacheIntegration } from "../cache/chatResponseCacheIntegration.ts";
import { estimateTextTokens, estimateTokens } from "../cost/tokenEstimator.js";
import {
  recordChatCacheEvent,
  recordChatRequest,
  recordChatTokens,
  recordChatTtft,
  recordChatVirtualKeyRejection,
} from "../observability/aiMetrics.ts";
import { getLangfuseCallback } from "../observability/langfuseCallback.ts";
import { applyPromptEnhancement } from "./utils/chatUtils.js";
import { readJson, writeJson, writeSseHeaders } from "./utils/responseUtils.js";
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
  ["stream_options", () => false],
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
      request,
      response,
      startedAt,
      writeServiceLog,
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
    const cacheCandidate = chatResponseCache.describeCacheCandidate(requestBody, gatewayInput);
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
  request,
  response,
  startedAt,
  writeServiceLog,
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

  if (body.stream === true) {
    await streamAnthropicMessage({
      body,
      gatewayInput,
      gatewayService,
      request,
      response,
      startedAt,
      writeServiceLog,
    });
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
  writeJson(response, 200, createAnthropicMessage(result, {
    requestedModel: body.model,
    messages: gatewayInput.messages,
  }));
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

  const conversation = normalizeAnthropicMessages(body.messages);
  const system = normalizeAnthropicSystem(body.system);
  const messages = system ? [{ role: "system", content: system }, ...conversation] : conversation;
  const target = resolveOpenAiModelTarget(requestedModel, descriptors);
  const extension = normalizeUnifiedAiExtension(body);
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
    options,
    metadata: {
      source: "anthropic-compatible-api",
      anthropicCompatibility: {
        requestedModel,
        stream: body.stream === true,
        systemPresent: Boolean(system),
        metadataUserIdPresent,
      },
    },
  };

  return extension.promptEnhancement?.enabled === true
    ? applyPromptEnhancement(gatewayInput, extension.promptEnhancement)
    : gatewayInput;
}

function normalizeAnthropicMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw createAnthropicValidationError(
      "messages must contain at least one message.",
      "messages",
    );
  }

  return messages.map((message, index) => {
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
        `${param}.role`,
      );
    }
    return {
      role: message.role,
      content: normalizeAnthropicTextContent(message.content, `${param}.content`),
    };
  });
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
      if (key !== "type" && key !== "text") {
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

  return {
    id: toAnthropicMessageId(data.id ?? requestId),
    type: "message",
    role: "assistant",
    model: data.selectedModel ?? data.model ?? options.requestedModel,
    content: [{ type: "text", text: String(text) }],
    stop_reason: normalizeAnthropicStopReason(data.finishReason),
    stop_sequence: data.stopSequence ?? null,
    usage: {
      input_tokens: usage.inputTokens ?? estimateAnthropicInputTokens(options.messages),
      output_tokens: usage.outputTokens ?? estimateCompatibilityTokens(text),
    },
    unified_ai: createAnthropicUnifiedAiMetadata(data, requestId),
  };
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
  request,
  response,
  startedAt,
  writeServiceLog,
}) {
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
  const inputTokens = estimateAnthropicInputTokens(gatewayInput.messages);

  response.on("close", () => {
    clientClosed = true;
  });
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

  for await (const event of gatewayService.executeStream(gatewayInput)) {
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
      outputText += event.textDelta;
      writeAnthropicSseEvent(response, "content_block_delta", {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: event.textDelta },
      });
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

  if (!clientClosed) {
    if (!failed) {
      ensureStarted(finalEvent ?? {});
      if (contentBlockStarted) {
        writeAnthropicSseEvent(response, "content_block_stop", {
          type: "content_block_stop",
          index: 0,
        });
      }
      writeAnthropicSseEvent(response, "message_delta", {
        type: "message_delta",
        delta: {
          stop_reason: normalizeAnthropicStopReason(finalEvent?.rawProviderMeta?.finishReason),
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

export function normalizeOpenAiChatCompletionRequest(body, descriptors = []) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createValidationError("Request body must be a JSON object.", null);
  }

  const requestedModel = readRequiredString(body.model, "model");
  const messages = normalizeOpenAiMessages(body.messages);
  const imageStats = getMessageImageStats(messages);
  validateOptionalBoolean(body.stream, "stream");
  validateUnsupportedFields(body);

  if (body.n !== undefined && body.n !== 1) {
    throw createUnsupportedError("Only n=1 is supported.", "n");
  }
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
      },
    },
  };

  return extension.promptEnhancement?.enabled === true
    ? applyPromptEnhancement(gatewayInput, extension.promptEnhancement)
    : gatewayInput;
}

export function createOpenAiModelList(descriptors = [], startedAt = Date.now()) {
  const available = listAvailableModels(descriptors);
  const counts = new Map();
  for (const item of available) {
    counts.set(item.model.id, (counts.get(item.model.id) ?? 0) + 1);
  }

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

  if (body.n !== undefined && body.n !== 1) {
    throw createUnsupportedError("Only n=1 is supported.", "n");
  }
  if (body.stream_options?.include_usage === true) {
    throw createUnsupportedError(
      "stream_options.include_usage is not available because streamed provider usage is not yet reported.",
      "stream_options.include_usage",
    );
  }

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

function applyVirtualKeyRequestGate({
  enterpriseGovernanceService,
  request,
  gatewayInput,
  response,
  writeServiceLog,
  startedAt,
}) {
  const fingerprint = request?.enterpriseIdentity?.apiKeyFingerprint;
  if (!fingerprint) return false;
  const manager = enterpriseGovernanceService?.getApiKeyManager?.();
  // 接线缺失时 fail-open：虚拟 key 认证已由治理层完成，缺记账器不应阻断请求。
  if (!manager) return false;

  const estimatedInputTokens = estimateTokens(gatewayInput).estimatedInputTokens;
  const decision = manager.authorizeUsage({ keyId: fingerprint, estimatedTokens: estimatedInputTokens });
  if (decision.allowed) return false;

  writeServiceLog?.("openai_chat_virtual_key_rejected", {
    path: CHAT_COMPLETIONS_PATH,
    code: decision.code,
    keyFingerprint: fingerprint,
    durationMs: Date.now() - startedAt,
  });
  recordChatVirtualKeyRejection(decision.code);
  writeJson(response, 429, createOpenAiError({
    code: decision.code,
    category: "rate_limit",
    message: decision.code === "VIRTUAL_KEY_RATE_LIMITED"
      ? "Virtual key request rate limit exceeded; retry later."
      : "Virtual key token budget exhausted for the current window.",
  }));
  return true;
}

function recordVirtualKeyUsage({
  enterpriseGovernanceService,
  request,
  writeServiceLog,
  tokens,
}) {
  const fingerprint = request?.enterpriseIdentity?.apiKeyFingerprint;
  if (!fingerprint) return;
  const manager = enterpriseGovernanceService?.getApiKeyManager?.();
  if (!manager) return;
  try {
    const result = manager.recordUsage({ keyId: fingerprint, tokens });
    if (result.softBudgetExceeded) {
      writeServiceLog?.("openai_chat_virtual_key_soft_budget", {
        path: CHAT_COMPLETIONS_PATH,
        keyFingerprint: fingerprint,
        tokensUsed: result.budget?.tokensUsed ?? null,
        limitTokens: result.budget?.limitTokens ?? null,
      });
    }
  } catch {
    // 记账失败不影响响应。
  }
}

async function streamOpenAiChatCompletion({
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

  writeSseHeaders(response);

  const chatResponseCache = getChatResponseCacheIntegration();
  const cacheCandidate = chatResponseCache.describeCacheCandidate(body, gatewayInput);
  const cacheLookup = cacheCandidate
    ? chatResponseCache.lookup({ candidate: cacheCandidate, tenantIdentity: request.enterpriseIdentity })
    : null;
  if (cacheLookup?.payload.kind === "sse") {
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

  const capturedChunks = [];
  let capturedUsageChunk;
  let firstTokenAt = 0;

  for await (const event of gatewayService.executeStream(gatewayInput)) {
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
    });
    capturedChunks.push(chunk);
    writeOpenAiSseData(response, chunk);
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
  const created = Math.floor(startedAt / 1000);

  response.on("close", () => {
    clientClosed = true;
  });
  writeSseHeaders(response);

  for await (const event of gatewayService.executeStream(gatewayInput)) {
    if (clientClosed) break;
    if (event.type === "error") {
      failed = true;
      writeOpenAiSseData(response, createOpenAiError(event.envelope?.error ?? event.envelope));
      break;
    }

    completionId ??= toOpenAiCompletionId(event.requestId);
    selectedModel = event.selectedModel ?? selectedModel;
    writeOpenAiSseData(
      response,
      createOpenAiCompletionChunk(event, {
        completionId,
        created,
        model: selectedModel,
        promptEnhancement: gatewayInput.metadata?.promptEnhancement,
      }),
    );
  }

  writeServiceLog?.(failed ? "openai_completion_stream_failed" : "openai_completion_stream_completed", {
    method: request.method,
    path: COMPLETIONS_PATH,
    model: selectedModel,
    durationMs: Date.now() - startedAt,
  });
  if (!clientClosed) {
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
        index: 0,
        text: delta,
        logprobs: null,
        finish_reason: event.type === "done" ? "stop" : null,
      },
    ],
    unified_ai: createUnifiedAiMetadata(event, { requestId: event.requestId }, options.promptEnhancement),
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
        index: 0,
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

function normalizeOpenAiMessageContent(content, param, role) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content) || content.length === 0) {
    throw createValidationError(`${param} must be text or a non-empty content array.`, param);
  }

  let hasImage = false;
  let hasNonEmptyText = false;
  const normalized = content.map((part, index) => {
    const partParam = `${param}[${index}]`;
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
        "Only text and inline image_url content parts are supported.",
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

  if (!hasImage) return normalized.map((part) => part.text).join("\n");
  if (!hasNonEmptyText && normalized.every((part) => part.type !== "image_url")) {
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

  const rawEnhancement = extension.prompt_enhancement ?? body.prompt_enhancement;
  if (rawEnhancement === undefined || rawEnhancement === false) {
    return { providerId: providerId?.trim() };
  }
  if (rawEnhancement === true) {
    return { providerId: providerId?.trim(), promptEnhancement: { enabled: true } };
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
  };
}

function resolveOpenAiModelTarget(requestedModel, descriptors) {
  const available = listAvailableModels(descriptors);
  const counts = new Map();
  for (const item of available) {
    counts.set(item.model.id, (counts.get(item.model.id) ?? 0) + 1);
  }

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
