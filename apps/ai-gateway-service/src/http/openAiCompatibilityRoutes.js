import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { applyPromptEnhancement } from "./utils/chatUtils.js";
import { readJson, writeJson, writeSseHeaders } from "./utils/responseUtils.js";

const CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
const MODELS_PATH = "/v1/models";
const UNSUPPORTED_FIELDS = Object.freeze([
  ["tools", (value) => Array.isArray(value) && value.length === 0],
  ["tool_choice", (value) => value === "none"],
  ["functions", (value) => Array.isArray(value) && value.length === 0],
  ["function_call", (value) => value === "none"],
  ["modalities", (value) => Array.isArray(value) && value.length === 1 && value[0] === "text"],
  ["audio", () => false],
  ["prediction", () => false],
  ["reasoning_effort", () => false],
  ["seed", () => false],
  ["logit_bias", () => false],
  ["service_tier", () => false],
  ["store", (value) => value === false],
  ["metadata", () => false],
  ["web_search_options", () => false],
  ["verbosity", () => false],
  ["parallel_tool_calls", (value) => value === false],
  ["presence_penalty", (value) => value === 0],
  ["frequency_penalty", (value) => value === 0],
  ["logprobs", (value) => value === false],
  ["top_logprobs", () => false],
]);

export function isOpenAiCompatibilityRoute(pathname) {
  return pathname === CHAT_COMPLETIONS_PATH || pathname === MODELS_PATH;
}

export async function dispatchOpenAiCompatibilityRoutes(context) {
  const {
    gatewayService,
    request,
    response,
    startedAt,
    url,
    writeServiceLog,
  } = context;

  if (request.method === "GET" && url.pathname === MODELS_PATH) {
    const models = createOpenAiModelList(gatewayService.getProviderDescriptors(), startedAt);
    writeServiceLog?.("openai_models_listed", {
      method: request.method,
      path: url.pathname,
      modelCount: models.data.length,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 200, models);
    return;
  }

  if (request.method !== "POST" || url.pathname !== CHAT_COMPLETIONS_PATH) {
    return ROUTE_NOT_HANDLED;
  }

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

  let gatewayInput;
  try {
    gatewayInput = normalizeOpenAiChatCompletionRequest(
      body,
      gatewayService.getProviderDescriptors(),
    );
  } catch (error) {
    writeServiceLog?.("openai_chat_validation_failed", {
      method: request.method,
      path: url.pathname,
      code: error?.code,
      param: error?.param,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 400, createOpenAiError(error));
    return;
  }

  if (body.stream === true) {
    await streamOpenAiChatCompletion({
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
    writeServiceLog?.("openai_chat_failed", {
      method: request.method,
      path: url.pathname,
      code: error.code,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, resolveOpenAiErrorStatus(error), createOpenAiError(error));
    return;
  }

  writeServiceLog?.("openai_chat_completed", {
    method: request.method,
    path: url.pathname,
    provider: result.data?.selectedProvider,
    model: result.data?.selectedModel,
    executionMode: result.data?.executionMode,
    durationMs: Date.now() - startedAt,
  });
  writeJson(response, 200, createOpenAiChatCompletion(result, {
    created: Math.floor(startedAt / 1000),
    requestedModel: body.model,
    promptEnhancement: gatewayInput.metadata?.promptEnhancement,
  }));
}

export function normalizeOpenAiChatCompletionRequest(body, descriptors = []) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createValidationError("Request body must be a JSON object.", null);
  }

  const requestedModel = readRequiredString(body.model, "model");
  const messages = normalizeOpenAiMessages(body.messages);
  validateOptionalBoolean(body.stream, "stream");
  validateUnsupportedFields(body);

  if (body.n !== undefined && body.n !== 1) {
    throw createUnsupportedError("Only n=1 is supported.", "n");
  }
  if (body.stream_options?.include_usage === true) {
    throw createUnsupportedError(
      "stream_options.include_usage is not available because streamed provider usage is not yet reported.",
      "stream_options.include_usage",
    );
  }

  const responseFormat = body.response_format;
  if (responseFormat !== undefined && responseFormat?.type !== "text") {
    throw createUnsupportedError("Only response_format.type='text' is supported.", "response_format");
  }

  const target = resolveOpenAiModelTarget(requestedModel, descriptors);
  const extension = normalizeUnifiedAiExtension(body);
  const gatewayInput = {
    taskType: "chat",
    messages,
    model: target.modelId,
    providerId: extension.providerId ?? target.providerId,
    options: normalizeGenerationOptions(body),
    metadata: {
      source: "openai-compatible-api",
      openAiCompatibility: {
        requestedModel,
        stream: body.stream === true,
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

export function createOpenAiChatCompletion(result, options = {}) {
  const data = result.data ?? {};
  const usage = data.usage ?? {};
  const content = data.message?.content ?? data.outputText ?? data.text ?? "";

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
          content,
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

async function streamOpenAiChatCompletion({
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
    writeOpenAiSseData(response, createOpenAiChatCompletionChunk(event, {
      completionId,
      created,
      model: selectedModel,
      promptEnhancement: gatewayInput.metadata?.promptEnhancement,
    }));
  }

  writeServiceLog?.(failed ? "openai_chat_stream_failed" : "openai_chat_stream_completed", {
    method: request.method,
    path: CHAT_COMPLETIONS_PATH,
    model: selectedModel,
    durationMs: Date.now() - startedAt,
  });
  if (!clientClosed) {
    response.write("data: [DONE]\n\n");
    response.end();
  }
}

export function createOpenAiChatCompletionChunk(event, options = {}) {
  const delta = event.type === "start"
    ? { role: "assistant", content: "" }
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
        finish_reason: event.type === "done" ? "stop" : null,
      },
    ],
    system_fingerprint: null,
    unified_ai: createUnifiedAiMetadata(event, { requestId: event.requestId }, options.promptEnhancement),
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
    if (message.role === "tool" || message.tool_calls || message.tool_call_id) {
      throw createUnsupportedError("Tool messages and tool calls are not supported yet.", param);
    }

    const role = message.role === "developer" ? "system" : message.role;
    if (!new Set(["system", "user", "assistant"]).has(role)) {
      throw createValidationError(`${param}.role is not supported.`, `${param}.role`);
    }

    return {
      role,
      content: normalizeTextContent(message.content, `${param}.content`),
      ...(typeof message.name === "string" && message.name ? { name: message.name } : {}),
    };
  });
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

function normalizeGenerationOptions(body) {
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

  return options;
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

function listAvailableModels(descriptors) {
  return descriptors.flatMap((descriptor) => (descriptor.models ?? [])
    .filter((model) => model.enabled !== false)
    .map((model) => ({ descriptor, model })));
}

function createUnifiedAiMetadata(data, meta, promptEnhancement) {
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
  if (value === "tool_call") return "tool_calls";
  return "stop";
}

function writeOpenAiSseData(response, data) {
  if (!response.writableEnded && !response.destroyed) {
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

function resolveOpenAiErrorStatus(error) {
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

function createValidationError(message, param) {
  const error = new Error(message);
  error.code = "invalid_request";
  error.category = "validation";
  error.param = param;
  return error;
}

function createUnsupportedError(message, param) {
  const error = createValidationError(message, param);
  error.code = "unsupported_parameter";
  return error;
}

function toOpenAiCompletionId(value) {
  const suffix = String(value ?? Date.now()).replace(/[^a-zA-Z0-9_-]/g, "").slice(-48);
  return suffix.startsWith("chatcmpl-") ? suffix : `chatcmpl-${suffix}`;
}
