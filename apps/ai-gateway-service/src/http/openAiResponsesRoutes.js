import { randomUUID } from "node:crypto";
import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import {
  createOpenAiError,
  createUnsupportedError,
  createValidationError,
  createUnifiedAiMetadata,
  normalizeOpenAiChatCompletionRequest,
  resolveOpenAiErrorStatus,
} from "./openAiCompatibilityRoutes.js";
import { readJson, writeJson, writeSseHeaders } from "./utils/responseUtils.js";

export const RESPONSES_PATH = "/v1/responses";

const UNSUPPORTED_RESPONSE_FIELDS = Object.freeze([
  ["background", (value) => value === false || value === null],
  ["conversation", (value) => value === null],
  ["include", (value) => value === null || (Array.isArray(value) && value.length === 0)],
  ["moderation", (value) => value === null],
  ["max_tool_calls", (value) => value === null],
  ["parallel_tool_calls", (value) => value === false || value === null],
  ["previous_response_id", (value) => value === null],
  ["prompt", (value) => value === null],
  ["prompt_cache_key", (value) => value === null],
  ["reasoning", (value) => value === null],
  ["service_tier", (value) => value === null || value === "auto"],
  ["safety_identifier", (value) => value === null],
  ["store", (value) => value === false || value === null],
  ["tools", (value) => Array.isArray(value) && value.length === 0],
  ["tool_choice", (value) => value === "none"],
  ["top_logprobs", (value) => value === 0 || value === null],
  ["truncation", (value) => value === "disabled" || value === null],
  ["user", (value) => value === null],
  ["context_management", (value) => value === null || (Array.isArray(value) && value.length === 0)],
  ["prompt_cache_options", (value) => value === null],
  ["prompt_cache_retention", (value) => value === null],
]);

export async function dispatchOpenAiResponsesRoutes(context) {
  const {
    gatewayService,
    request,
    response,
    startedAt,
    url,
    writeServiceLog,
  } = context;

  if (request.method !== "POST" || url.pathname !== RESPONSES_PATH) {
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
    gatewayInput = normalizeOpenAiResponseRequest(
      body,
      gatewayService.getProviderDescriptors(),
    );
  } catch (error) {
    writeServiceLog?.("openai_response_validation_failed", {
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
    await streamOpenAiResponse({
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
    writeServiceLog?.("openai_response_failed", {
      method: request.method,
      path: url.pathname,
      code: error.code,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, resolveOpenAiErrorStatus(error), createOpenAiError(error));
    return;
  }

  const openAiResponse = createOpenAiResponse(result, {
    body,
    createdAt: Math.floor(startedAt / 1000),
    promptEnhancement: gatewayInput.metadata?.promptEnhancement,
  });
  writeServiceLog?.("openai_response_completed", {
    method: request.method,
    path: url.pathname,
    provider: result.data?.selectedProvider,
    model: result.data?.selectedModel,
    executionMode: result.data?.executionMode,
    durationMs: Date.now() - startedAt,
  });
  writeJson(response, 200, openAiResponse);
}

export function normalizeOpenAiResponseRequest(body, descriptors = []) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createValidationError("Request body must be a JSON object.", null);
  }
  validateUnsupportedResponseFields(body);
  validateResponseTextOptions(body.text);
  if (body.stream !== undefined && body.stream !== null && typeof body.stream !== "boolean") {
    throw createValidationError("stream must be a boolean.", "stream");
  }
  if (body.stream_options !== undefined && body.stream_options !== null) {
    throw createUnsupportedError(
      "stream_options is not supported by this compatibility layer yet.",
      "stream_options",
    );
  }

  const model = normalizeResponseModel(body.model, descriptors);
  const messages = normalizeResponseMessages(body.input, body.instructions);
  const chatBody = {
    model,
    messages,
    ...(body.temperature !== undefined && body.temperature !== null
      ? { temperature: body.temperature }
      : {}),
    ...(body.top_p !== undefined && body.top_p !== null ? { top_p: body.top_p } : {}),
    ...(body.max_output_tokens !== undefined && body.max_output_tokens !== null
      ? { max_completion_tokens: body.max_output_tokens }
      : {}),
    ...(body.stream !== undefined && body.stream !== null ? { stream: body.stream } : {}),
    ...(body.unified_ai !== undefined ? { unified_ai: body.unified_ai } : {}),
  };
  const gatewayInput = normalizeOpenAiChatCompletionRequest(chatBody, descriptors);
  gatewayInput.metadata.openAiCompatibility = {
    ...gatewayInput.metadata.openAiCompatibility,
    api: "responses",
  };
  if (body.metadata !== undefined && body.metadata !== null) {
    if (!body.metadata || typeof body.metadata !== "object" || Array.isArray(body.metadata)) {
      throw createValidationError("metadata must be an object.", "metadata");
    }
    gatewayInput.metadata.openAiCompatibility.responseMetadata = body.metadata;
  }
  return gatewayInput;
}

export function createOpenAiResponse(result, options = {}) {
  const data = result.data ?? {};
  const body = options.body ?? {};
  const usage = data.usage ?? {};
  const text = data.message?.content ?? data.outputText ?? data.text ?? "";
  const responseId = toResponseId(data.id ?? result.meta?.requestId);
  const message = createOutputMessage(responseId, text, "completed");
  const createdAt = options.createdAt ?? Math.floor(Date.now() / 1000);

  return {
    id: responseId,
    object: "response",
    created_at: createdAt,
    completed_at: createdAt,
    status: "completed",
    error: null,
    incomplete_details: null,
    instructions: body.instructions ?? null,
    metadata: body.metadata ?? null,
    model: data.selectedModel ?? data.model ?? body.model,
    output: [message],
    output_text: text,
    parallel_tool_calls: false,
    temperature: body.temperature ?? null,
    tool_choice: "none",
    tools: [],
    top_p: body.top_p ?? null,
    max_output_tokens: body.max_output_tokens ?? null,
    usage: {
      input_tokens: usage.inputTokens ?? 0,
      input_tokens_details: {
        cached_tokens: usage.cachedInputTokens ?? 0,
        cache_write_tokens: 0,
      },
      output_tokens: usage.outputTokens ?? 0,
      output_tokens_details: { reasoning_tokens: usage.reasoningTokens ?? 0 },
      total_tokens: usage.totalTokens ?? 0,
    },
    unified_ai: createUnifiedAiMetadata(
      data,
      result.meta,
      options.promptEnhancement,
    ),
  };
}

function normalizeResponseModel(value, descriptors) {
  if (value !== undefined && value !== null) {
    if (typeof value !== "string" || !value.trim()) {
      throw createValidationError("model must be a non-empty string.", "model");
    }
    return value.trim();
  }
  const firstModel = descriptors
    .flatMap((descriptor) => descriptor.models ?? [])
    .find((model) => model.enabled !== false);
  if (!firstModel?.id) {
    throw createValidationError("model is required when no default model is available.", "model");
  }
  return firstModel.id;
}

function normalizeResponseMessages(input, instructions) {
  const messages = [];
  if (instructions !== undefined && instructions !== null) {
    if (typeof instructions !== "string" || !instructions.trim()) {
      throw createValidationError(
        "instructions must be a non-empty string or null.",
        "instructions",
      );
    }
    messages.push({ role: "system", content: instructions });
  }

  if (typeof input === "string") {
    if (!input.trim()) throw createValidationError("input cannot be empty.", "input");
    messages.push({ role: "user", content: input });
    return messages;
  }
  if (!Array.isArray(input) || input.length === 0) {
    throw createValidationError("input must be text or a non-empty item array.", "input");
  }

  input.forEach((item, index) => {
    const param = `input[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw createValidationError(`${param} must be a message object.`, param);
    }
    if (item.type !== undefined && item.type !== "message") {
      throw createUnsupportedError(
        "Only text message input items are supported; tool, file, image, and audio items are not available yet.",
        `${param}.type`,
      );
    }
    const role = item.role === "developer" ? "system" : item.role;
    if (!new Set(["system", "user", "assistant"]).has(role)) {
      throw createValidationError(`${param}.role is not supported.`, `${param}.role`);
    }
    messages.push({
      role,
      content: normalizeResponseContent(item.content, `${param}.content`),
    });
  });
  return messages;
}

function normalizeResponseContent(content, param) {
  if (typeof content === "string") {
    if (!content.trim()) throw createValidationError(`${param} cannot be empty.`, param);
    return content;
  }
  if (!Array.isArray(content) || content.length === 0) {
    throw createValidationError(`${param} must contain text.`, param);
  }
  const text = content.map((part, index) => {
    if (
      !part
      || !new Set(["input_text", "output_text"]).has(part.type)
      || typeof part.text !== "string"
    ) {
      throw createUnsupportedError(
        "Only input_text and output_text content parts are supported.",
        `${param}[${index}]`,
      );
    }
    return part.text;
  }).join("\n");
  if (!text.trim()) throw createValidationError(`${param} cannot be empty.`, param);
  return text;
}

function validateUnsupportedResponseFields(body) {
  for (const [field, isNoop] of UNSUPPORTED_RESPONSE_FIELDS) {
    if (body[field] !== undefined && !isNoop(body[field])) {
      throw createUnsupportedError(
        `${field} is not supported by this Responses compatibility layer yet.`,
        field,
      );
    }
  }
}

function validateResponseTextOptions(text) {
  if (text === undefined || text === null) return;
  if (!text || typeof text !== "object" || Array.isArray(text)) {
    throw createValidationError("text must be an options object.", "text");
  }
  if (text.verbosity !== undefined && text.verbosity !== null) {
    throw createUnsupportedError("text.verbosity is not supported yet.", "text.verbosity");
  }
  if (
    text.format !== undefined
    && text.format !== null
    && text.format.type !== "text"
  ) {
    throw createUnsupportedError(
      "Only text.format.type='text' is supported.",
      "text.format",
    );
  }
}

async function streamOpenAiResponse({
  body,
  gatewayInput,
  gatewayService,
  request,
  response,
  startedAt,
  writeServiceLog,
}) {
  let clientClosed = false;
  let sequenceNumber = 0;
  let responseId = toResponseId();
  let selectedModel = body.model ?? gatewayInput.model;
  let selectedProvider = null;
  let executionMode = null;
  let outputText = "";
  let started = false;
  let failed = false;
  const createdAt = Math.floor(startedAt / 1000);

  response.on("close", () => {
    clientClosed = true;
  });
  writeSseHeaders(response);

  const initialResponse = createStreamingResponse({
    body,
    createdAt,
    model: selectedModel,
    responseId,
    status: "in_progress",
  });
  writeResponseSse(response, {
    type: "response.created",
    sequence_number: sequenceNumber++,
    response: initialResponse,
  });
  writeResponseSse(response, {
    type: "response.in_progress",
    sequence_number: sequenceNumber++,
    response: initialResponse,
  });

  try {
    for await (const event of gatewayService.executeStream(gatewayInput)) {
      if (clientClosed) break;
      if (event.type === "error") {
        failed = true;
        writeResponseStreamError(response, event.envelope?.error ?? event.envelope, sequenceNumber++);
        break;
      }

      selectedModel = event.selectedModel ?? selectedModel;
      selectedProvider = event.selectedProvider ?? selectedProvider;
      executionMode = event.executionMode ?? executionMode;
      const messageId = toMessageId(responseId);
      if (!started) {
        started = true;
        writeResponseSse(response, {
          type: "response.output_item.added",
          sequence_number: sequenceNumber++,
          output_index: 0,
          item: createOutputMessage(responseId, "", "in_progress"),
        });
        writeResponseSse(response, {
          type: "response.content_part.added",
          sequence_number: sequenceNumber++,
          item_id: messageId,
          output_index: 0,
          content_index: 0,
          part: createOutputText(""),
        });
      }
      if (event.type === "chunk") {
        const delta = event.textDelta ?? "";
        outputText += delta;
        writeResponseSse(response, {
          type: "response.output_text.delta",
          sequence_number: sequenceNumber++,
          item_id: messageId,
          output_index: 0,
          content_index: 0,
          delta,
          logprobs: [],
        });
      }
    }
  } catch (error) {
    failed = true;
    writeResponseStreamError(response, error, sequenceNumber++);
  }

  if (!clientClosed && !failed) {
    const message = createOutputMessage(responseId, outputText, "completed");
    writeResponseSse(response, {
      type: "response.output_text.done",
      sequence_number: sequenceNumber++,
      item_id: message.id,
      output_index: 0,
      content_index: 0,
      text: outputText,
      logprobs: [],
    });
    writeResponseSse(response, {
      type: "response.content_part.done",
      sequence_number: sequenceNumber++,
      item_id: message.id,
      output_index: 0,
      content_index: 0,
      part: createOutputText(outputText),
    });
    writeResponseSse(response, {
      type: "response.output_item.done",
      sequence_number: sequenceNumber++,
      output_index: 0,
      item: message,
    });
    const completed = createStreamingResponse({
      body,
      createdAt,
      executionMode,
      model: selectedModel,
      outputText,
      responseId,
      selectedProvider,
      status: "completed",
    });
    writeResponseSse(response, {
      type: "response.completed",
      sequence_number: sequenceNumber++,
      response: completed,
    });
  }

  writeServiceLog?.(failed ? "openai_response_stream_failed" : "openai_response_stream_completed", {
    method: request.method,
    path: RESPONSES_PATH,
    model: selectedModel,
    durationMs: Date.now() - startedAt,
  });
  if (!clientClosed) {
    response.write("data: [DONE]\n\n");
    response.end();
  }
}

function createStreamingResponse({
  body,
  createdAt,
  executionMode = null,
  model,
  outputText = "",
  responseId,
  selectedProvider = null,
  status,
}) {
  const completed = status === "completed";
  return {
    id: responseId,
    object: "response",
    created_at: createdAt,
    ...(completed ? { completed_at: createdAt } : {}),
    status,
    error: null,
    incomplete_details: null,
    instructions: body.instructions ?? null,
    metadata: body.metadata ?? null,
    model,
    output: completed ? [createOutputMessage(responseId, outputText, "completed")] : [],
    output_text: outputText,
    parallel_tool_calls: false,
    temperature: body.temperature ?? null,
    tool_choice: "none",
    tools: [],
    top_p: body.top_p ?? null,
    max_output_tokens: body.max_output_tokens ?? null,
    unified_ai: {
      selected_provider: selectedProvider,
      selected_model: model,
      execution_mode: executionMode,
    },
  };
}

function createOutputMessage(responseId, text, status) {
  return {
    id: toMessageId(responseId),
    type: "message",
    status,
    role: "assistant",
    content: [createOutputText(text)],
  };
}

function createOutputText(text) {
  return { type: "output_text", text, annotations: [], logprobs: [] };
}

function writeResponseSse(response, event) {
  if (!response.writableEnded && !response.destroyed) {
    response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }
}

function writeResponseStreamError(response, error, sequenceNumber) {
  writeResponseSse(response, {
    type: "error",
    sequence_number: sequenceNumber,
    code: error?.code ?? "gateway_error",
    message: error?.message ?? "Gateway stream failed.",
    param: error?.param ?? null,
  });
}

function toResponseId(value = randomUUID()) {
  const suffix = String(value).replace(/[^a-zA-Z0-9_-]/g, "").slice(-48);
  return suffix.startsWith("resp_") ? suffix : `resp_${suffix}`;
}

function toMessageId(responseId) {
  return `msg_${String(responseId).replace(/^resp_/, "")}`;
}
