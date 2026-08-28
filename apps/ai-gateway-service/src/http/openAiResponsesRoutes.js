import { randomUUID } from "node:crypto";
import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import {
  createOpenAiError,
  createUnsupportedError,
  createValidationError,
  createUnifiedAiMetadata,
  normalizeOpenAiChatCompletionRequest,
  resolveOpenAiErrorStatus,
  applyVirtualKeyRequestGate,
  recordVirtualKeyUsage,
} from "./openAiCompatibilityRoutes.js";
import { readJson, writeJson, writeSseHeaders } from "./utils/responseUtils.js";
import { getGuardrailsEngine } from "../guardrails/guardrailsEngine.ts";
import {
  recordGuardrailEvaluation,
  recordGuardrailFinding,
} from "../observability/aiMetrics.ts";
import { isResponseId } from "../responses/responseSessionStore.js";
import {
  closePrimedGatewayStream,
  iteratePrimedGatewayStream,
  primeGatewayStream,
  readPrimedGatewayStreamError,
} from "./gatewayStreamPreflight.ts";
import { resolveProviderDispatchHttpStatus } from "./providerDispatchHttpStatus.ts";

export const RESPONSES_PATH = "/v1/responses";
const OPENAI_AZURE_RESPONSES = /^\/openai\/deployments\/([^/]+)\/responses\/?$/;
const RESPONSES_PATH_ALIAS = "/responses";

const REASONING_EFFORTS = new Set(["minimal", "low", "medium", "high", "xhigh"]);
const REASONING_SUMMARY_MODES = new Set(["auto", "concise", "detailed"]);

// Declarative/built-in tool shapes that cannot be served on the
// chat-completions wire (namespace grouping, web_search, code_interpreter …).
// They are accepted and dropped instead of failing the whole request; the
// drop is recorded in gateway request metadata. Unknown tool types are still
// rejected loudly.
const DROPPED_TOOL_TYPES = new Set([
  "namespace",
  "web_search",
  "web_search_preview",
  "file_search",
  "computer_use",
  "computer_use_preview",
  "code_interpreter",
  "image_generation",
  "mcp",
  "local_shell",
  "unified_exec",
  "apply_patch",
  "view_image",
  "update_plan",
]);

const UNSUPPORTED_RESPONSE_FIELDS = Object.freeze([
  ["background", (value) => value === false || value === null],
  ["conversation", (value) => value === null],
  ["moderation", (value) => value === null],
  ["max_tool_calls", (value) => value === null],
  ["prompt", (value) => value === null],
  ["service_tier", (value) => value === null || value === "auto"],
  ["safety_identifier", (value) => value === null],
  ["top_logprobs", (value) => value === 0 || value === null],
  ["truncation", (value) => value === "disabled" || value === null],
  ["user", (value) => value === null],
  ["context_management", (value) => value === null || (Array.isArray(value) && value.length === 0)],
]);

// Include tokens that cannot be served on the chat-completions wire but are
// accepted and dropped: session-side reasoning retention replaces encrypted
// reasoning content replay. Unknown include tokens are still rejected.
const DROPPED_INCLUDE_TOKENS = new Set([
  "reasoning.encrypted_content",
]);

// Prompt-cache routing hints: accepted for client compatibility and dropped —
// the gateway cannot honor upstream cache placement on the chat wire.
const DROPPED_PARAMETER_VALIDATORS = Object.freeze({
  prompt_cache_key: (value) => typeof value === "string",
  prompt_cache_options: (value) => value === null || typeof value === "object",
  prompt_cache_retention: (value) => value === null || typeof value === "string" || typeof value === "number",
});

function normalizeOpenAiResponsesPath(pathname) {
  const path = typeof pathname === "string" ? pathname : "";
  const noTrailingSlash = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const azureMatch = noTrailingSlash.match(OPENAI_AZURE_RESPONSES);
  if (azureMatch) {
    return { path: RESPONSES_PATH, modelFromPath: azureMatch[1] };
  }
  if (noTrailingSlash === RESPONSES_PATH_ALIAS) {
    return { path: RESPONSES_PATH };
  }
  if (noTrailingSlash === "/v1" || noTrailingSlash.startsWith("/v1/")) {
    return { path: noTrailingSlash };
  }
  return { path: noTrailingSlash };
}

export async function dispatchOpenAiResponsesRoutes(context) {
  const {
    gatewayService,
    enterpriseGovernanceService,
    request,
    response,
    startedAt,
    url,
    writeServiceLog,
    responseSessionStore,
    application,
  } = context;
  const normalized = normalizeOpenAiResponsesPath(url.pathname);

  const retrieveMatch = normalized.path.match(/^\/v1\/responses\/(resp_[A-Za-z0-9_-]{1,64})$/);
  if (retrieveMatch) {
    dispatchResponseRetrieval({
      responseId: retrieveMatch[1],
      method: request.method,
      response,
      startedAt,
      sessionStore: responseSessionStore ?? application?.responseSessionStore ?? null,
      writeServiceLog,
    });
    return;
  }

  if (
    request.method !== "POST"
    || normalized.path !== RESPONSES_PATH
  ) {
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

  const shouldInjectModel = (
    normalized.modelFromPath
    && body
    && typeof body === "object"
    && !Array.isArray(body)
    && !body.model
  );
  const normalizedBody = shouldInjectModel
    ? { ...body, model: normalized.modelFromPath }
    : body;

  const sessionStore = responseSessionStore
    ?? application?.responseSessionStore
    ?? null;

  let gatewayInput;
  let session;
  let mergedWireMessages = [];
  try {
    session = normalizeResponseSessionOptions(normalizedBody, sessionStore);
    const messageMeta = { droppedReasoningItems: 0 };
    const turnMessages = normalizeResponseMessages(
      normalizedBody.input,
      normalizedBody.instructions,
      messageMeta,
    );
    mergedWireMessages = mergeSessionMessages(session.previous, turnMessages);
    const toolNormalization = normalizeResponseTools(normalizedBody.tools);
    gatewayInput = normalizeOpenAiResponseRequest(
      normalizedBody,
      gatewayService.getProviderDescriptors(),
      {
        messages: mergedWireMessages,
        reasoning: session.reasoning,
        tools: toolNormalization?.tools,
        toolChoice: normalizeResponseToolChoice(normalizedBody.tool_choice),
        parallelToolCalls: normalizedBody.parallel_tool_calls,
      },
    );
    const droppedToolTypes = [...new Set(toolNormalization?.droppedToolTypes ?? [])];
    if (droppedToolTypes.length > 0) {
      gatewayInput.metadata.openAiCompatibility.droppedToolTypes = droppedToolTypes;
    }
    const droppedIncludeTokens = normalizeResponseInclude(normalizedBody.include);
    if (droppedIncludeTokens.length > 0) {
      gatewayInput.metadata.openAiCompatibility.droppedIncludeTokens = droppedIncludeTokens;
    }
    const droppedParameters = validateDroppedParameters(normalizedBody);
    if (droppedParameters.length > 0) {
      gatewayInput.metadata.openAiCompatibility.droppedParameters = droppedParameters;
    }
    if (messageMeta.droppedReasoningItems > 0) {
      gatewayInput.metadata.openAiCompatibility.droppedReasoningInputItems = messageMeta.droppedReasoningItems;
    }
  } catch (error) {
    writeServiceLog?.("openai_response_validation_failed", {
      method: request.method,
      path: normalized.path,
      code: error?.code,
      param: error?.param,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, resolveOpenAiErrorStatus(error), createOpenAiError(error));
    return;
  }

  // Guardrails（确定性本地扫描）：与 /v1/chat/completions 同一引擎与租户覆盖，
  // 作用于归一化后的消息序列；拦截/脱敏同时覆盖 JSON 与流式路径。
  const guardrailsEngine = getGuardrailsEngine(request.enterpriseIdentity?.tenantId);
  const guardrailInputVerdict = guardrailsEngine.inspectInput({ messages: gatewayInput.messages });
  if (guardrailInputVerdict.decision === "block") {
    recordGuardrailEvaluation("input", "block");
    for (const finding of guardrailInputVerdict.findings) {
      if (finding.action === "block") recordGuardrailFinding(finding.rule, finding.action);
    }
    writeServiceLog?.("openai_response_guardrail_blocked", {
      method: request.method,
      path: normalized.path,
      findings: guardrailInputVerdict.findings,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 400, createOpenAiError({
      code: "guardrail_blocked",
      category: "governance",
      message: "Request blocked by chat guardrails.",
      param: "input",
    }));
    return;
  }
  if (guardrailInputVerdict.findings.length) {
    recordGuardrailEvaluation("input", "allow");
    for (const finding of guardrailInputVerdict.findings) {
      recordGuardrailFinding(finding.rule, finding.action);
    }
  }
  for (const replacement of guardrailInputVerdict.replacements) {
    const message = gatewayInput.messages?.[replacement.index];
    if (message && typeof message.content === "string") {
      message.content = replacement.content;
    }
  }

  if (applyVirtualKeyRequestGate({
    enterpriseGovernanceService,
    request,
    gatewayInput,
    response,
    writeServiceLog,
    startedAt,
    path: RESPONSES_PATH,
  })) {
    return;
  }

  if (normalizedBody.stream === true) {
    await streamOpenAiResponse({
      body: normalizedBody,
      gatewayInput,
      mergedWireMessages,
      gatewayService,
      enterpriseGovernanceService,
      request,
      response,
      startedAt,
      writeServiceLog,
      session,
      sessionStore,
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
      path: normalized.path,
      code: error.code,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, resolveOpenAiErrorStatus(error), createOpenAiError(error));
    return;
  }

  const openAiResponse = createOpenAiResponse(result, {
    body: normalizedBody,
    createdAt: Math.floor(startedAt / 1000),
    promptEnhancement: gatewayInput.metadata?.promptEnhancement,
    session,
  });
  const storedSession = storeResponseSession({
    sessionStore,
    session,
    responseId: openAiResponse.id,
    instructions: normalizedBody.instructions ?? session.previous?.instructions ?? null,
    contextMessages: [
      ...mergedWireMessages,
      ...createAssistantWireReplies(result),
    ],
    assistantOutput: openAiResponse.output_text,
    reasoningSummary: readGatewayReasoningSummary(result),
    model: openAiResponse.model,
    providerId: result.data?.selectedProvider ?? null,
    responseBody: openAiResponse,
  });
  openAiResponse.store = storedSession;

  // Guardrails 输出侧：对最终 output_text 脱敏/拦截；fail-open 保证不影响正常响应。
  if (typeof openAiResponse.output_text === "string" && openAiResponse.output_text) {
    const outputVerdict = guardrailsEngine.inspectOutputText(openAiResponse.output_text);
    if (outputVerdict.decision === "block") {
      recordGuardrailEvaluation("output", "block");
      for (const finding of outputVerdict.findings) {
        if (finding.action === "block") recordGuardrailFinding(finding.rule, finding.action);
      }
      writeServiceLog?.("openai_response_guardrail_output_blocked", {
        method: request.method,
        path: normalized.path,
        findings: outputVerdict.findings,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 400, createOpenAiError({
        code: "guardrail_blocked",
        category: "governance",
        message: "Response blocked by chat guardrails.",
        param: "input",
      }));
      return;
    }
    if (outputVerdict.findings.length) {
      recordGuardrailEvaluation("output", "allow");
      for (const finding of outputVerdict.findings) {
        recordGuardrailFinding(finding.rule, finding.action);
      }
    }
    if (outputVerdict.text !== openAiResponse.output_text) {
      openAiResponse.output_text = outputVerdict.text;
      for (const item of openAiResponse.output ?? []) {
        if (item?.type === "message" && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part?.type === "output_text" && typeof part.text === "string") {
              part.text = outputVerdict.text;
            }
          }
        }
      }
    }
  }
  recordVirtualKeyUsage({
    enterpriseGovernanceService,
    request,
    writeServiceLog,
    tokens: Number(result.data?.usage?.totalTokens ?? 0),
    path: RESPONSES_PATH,
  });
  writeServiceLog?.("openai_response_completed", {
    method: request.method,
    path: normalized.path,
    provider: result.data?.selectedProvider,
    model: result.data?.selectedModel,
    executionMode: result.data?.executionMode,
    sessionChained: session.previous !== null,
    sessionStored: storedSession,
    durationMs: Date.now() - startedAt,
  });
  writeJson(response, 200, openAiResponse);
}

export function normalizeResponseSessionOptions(body, sessionStore) {
  if (body.store !== undefined && body.store !== null && typeof body.store !== "boolean") {
    throw createValidationError("store must be a boolean.", "store");
  }
  const store = body.store !== false;

  let reasoning = null;
  if (body.reasoning !== undefined && body.reasoning !== null) {
    if (typeof body.reasoning !== "object" || Array.isArray(body.reasoning)) {
      throw createValidationError("reasoning must be an options object.", "reasoning");
    }
    const { effort, summary } = body.reasoning;
    if (effort !== undefined && effort !== null) {
      if (typeof effort !== "string" || !REASONING_EFFORTS.has(effort)) {
        throw createValidationError(
          `reasoning.effort must be one of: ${[...REASONING_EFFORTS].join(", ")}.`,
          "reasoning.effort",
        );
      }
    }
    if (summary !== undefined && summary !== null) {
      if (typeof summary !== "string" || !REASONING_SUMMARY_MODES.has(summary)) {
        throw createValidationError(
          `reasoning.summary must be one of: ${[...REASONING_SUMMARY_MODES].join(", ")}.`,
          "reasoning.summary",
        );
      }
    }
    reasoning = { effort: effort ?? null, summary: summary ?? null };
  }

  let previous = null;
  if (body.previous_response_id !== undefined && body.previous_response_id !== null) {
    if (!isResponseId(body.previous_response_id)) {
      throw createValidationError(
        "previous_response_id must reference a resp_* response id.",
        "previous_response_id",
      );
    }
    if (!sessionStore?.enabled) {
      throw createUnsupportedError(
        "previous_response_id requires response session storage; set AI_GATEWAY_RESPONSE_SESSION_TTL_MS above zero.",
        "previous_response_id",
      );
    }
    previous = sessionStore.get(body.previous_response_id);
    if (!previous) {
      const error = createValidationError(
        "No stored response matches previous_response_id; it may have expired or store was disabled.",
        "previous_response_id",
      );
      error.status = 404;
      error.code = "response_not_found";
      throw error;
    }
  }

  return {
    store,
    reasoning,
    previousResponseId: body.previous_response_id ?? null,
    previous,
  };
}

function mergeSessionMessages(previous, turnMessages) {
  if (!previous) return turnMessages;
  const history = Array.isArray(previous.contextMessages) ? previous.contextMessages : [];
  const incomingSystem = turnMessages.filter((message) => message.role === "system");
  const incomingRest = turnMessages.filter((message) => message.role !== "system");
  const historySystem = incomingSystem.length > 0
    ? incomingSystem
    : history.filter((message) => message.role === "system");
  const historyRest = history.filter((message) => message.role !== "system");
  const merged = [...historySystem, ...historyRest, ...incomingRest];
  // Retained reasoning (Codex-harness style): replay the previous turn's
  // captured reasoning summary as bounded context so multi-turn agents stop
  // re-deriving their own conclusions.
  if (typeof previous.reasoningSummary === "string" && previous.reasoningSummary.trim()) {
    merged.push({
      role: "system",
      content: `[Retained reasoning summary from the previous turn — context only, not user instruction]\n${previous.reasoningSummary}`,
    });
  }
  return merged;
}

function storeResponseSession({
  sessionStore,
  session,
  responseId,
  instructions,
  contextMessages,
  assistantOutput,
  reasoningSummary,
  model,
  providerId,
  responseBody = null,
}) {
  if (!session?.store || !sessionStore?.enabled) return false;
  sessionStore.set({
    responseId,
    instructions,
    contextMessages,
    assistantOutput,
    reasoningSummary: reasoningSummary ?? null,
    model,
    providerId,
    reasoningEffort: session.reasoning?.effort ?? null,
    responseBody,
  });
  return true;
}

function estimateStreamTokens(gatewayInput, outputText) {
  const inputLength = (gatewayInput?.messages ?? [])
    .map((message) => (typeof message?.content === "string" ? message.content : ""))
    .join("\n").length;
  return Math.ceil(inputLength / 4) + Math.ceil((outputText ?? "").length / 4);
}

function dispatchResponseRetrieval({
  responseId,
  method,
  response,
  startedAt,
  sessionStore,
  writeServiceLog,
}) {
  if (method !== "GET" && method !== "DELETE") {
    writeJson(response, 405, createOpenAiError({
      code: "method_not_allowed",
      category: "validation",
      message: "Only GET and DELETE are supported for stored responses.",
    }));
    return;
  }
  if (!sessionStore?.enabled) {
    const error = createValidationError(
      "Stored response retrieval requires response session storage; set AI_GATEWAY_RESPONSE_SESSION_TTL_MS above zero.",
      null,
    );
    error.status = 400;
    error.code = "session_storage_disabled";
    writeJson(response, 400, createOpenAiError(error));
    return;
  }

  if (method === "GET") {
    const record = sessionStore.get(responseId);
    if (!record?.responseBody) {
      const error = createValidationError(
        "No stored response matches this id; it may have expired or was not stored.",
        null,
      );
      error.status = 404;
      error.code = "response_not_found";
      writeJson(response, 404, createOpenAiError(error));
      return;
    }
    writeServiceLog?.("openai_response_retrieved", {
      method,
      path: `/v1/responses/${responseId}`,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 200, record.responseBody);
    return;
  }

  const deleted = sessionStore.delete(responseId);
  if (!deleted) {
    const error = createValidationError("No stored response matches this id.", null);
    error.status = 404;
    error.code = "response_not_found";
    writeJson(response, 404, createOpenAiError(error));
    return;
  }
  writeServiceLog?.("openai_response_deleted", {
    method,
    path: `/v1/responses/${responseId}`,
    durationMs: Date.now() - startedAt,
  });
  writeJson(response, 200, { id: responseId, object: "response", deleted: true });
}

export function normalizeOpenAiResponseRequest(body, descriptors = [], options = {}) {
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
  const messages = Array.isArray(options.messages) && options.messages.length > 0
    ? options.messages
    : normalizeResponseMessages(body.input, body.instructions, { droppedReasoningItems: 0 });
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
    ...(options.tools ? { tools: options.tools } : {}),
    ...(options.toolChoice ? { tool_choice: options.toolChoice } : {}),
    ...(typeof options.parallelToolCalls === "boolean"
      ? { parallel_tool_calls: options.parallelToolCalls }
      : {}),
    ...(body.unified_ai !== undefined ? { unified_ai: body.unified_ai } : {}),
  };
  const gatewayInput = normalizeOpenAiChatCompletionRequest(chatBody, descriptors);
  if (options.reasoning?.effort) {
    gatewayInput.options.reasoningEffort = options.reasoning.effort;
  }
  gatewayInput.metadata.openAiCompatibility = {
    ...gatewayInput.metadata.openAiCompatibility,
    api: "responses",
    ...(options.reasoning?.effort ? { reasoningEffort: options.reasoning.effort } : {}),
    ...(options.reasoning?.summary ? { reasoningSummary: options.reasoning.summary } : {}),
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
  const session = options.session ?? null;
  const usage = data.usage ?? {};
  const text = data.message?.content ?? data.outputText ?? data.text ?? "";
  const responseId = toResponseId(data.id ?? result.meta?.requestId);
  const message = createOutputMessage(responseId, text, "completed");
  const createdAt = options.createdAt ?? Math.floor(Date.now() / 1000);
  const toolCalls = readWireToolCalls(data.message);

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
    output: [
      ...createReasoningOutputItems(data.message),
      ...toolCalls.map((toolCall) => toFunctionCallItem(toolCall)),
      message,
    ],
    output_text: text,
    parallel_tool_calls: body.parallel_tool_calls ?? false,
    temperature: body.temperature ?? null,
    tool_choice: body.tool_choice ?? "auto",
    tools: body.tools ?? [],
    top_p: body.top_p ?? null,
    max_output_tokens: body.max_output_tokens ?? null,
    previous_response_id: session?.previousResponseId ?? null,
    reasoning: session?.reasoning
      ? { effort: session.reasoning.effort, summary: session.reasoning.summary }
      : null,
    store: session?.store === true,
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

function readWireToolCalls(message) {
  const raw = message?.tool_calls ?? message?.toolCalls;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.filter((toolCall) => {
    const fn = toolCall?.function;
    return fn && typeof fn.name === "string";
  }).map((toolCall) => ({
    id: toolCall.id ?? `call_${randomUUID().slice(0, 8)}`,
    type: "function",
    function: {
      name: toolCall.function.name,
      arguments: typeof toolCall.function.arguments === "string"
        ? toolCall.function.arguments
        : JSON.stringify(toolCall.function.arguments ?? {}),
    },
  }));
}

function createReasoningOutputItems(message) {
  const reasoning = message?.reasoningContent ?? message?.reasoning_content;
  if (typeof reasoning !== "string" || !reasoning.trim()) return [];
  return [{
    id: `rs_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    type: "reasoning",
    summary: [{ type: "summary_text", text: reasoning }],
    content: [],
  }];
}

function toFunctionCallItem(toolCall) {
  return {
    id: `fc_${String(toolCall.id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24)}`,
    type: "function_call",
    status: "completed",
    call_id: toolCall.id,
    name: toolCall.function.name,
    arguments: toolCall.function.arguments,
  };
}

function readGatewayReasoningSummary(result) {
  const reasoning = result?.data?.message?.reasoningContent;
  if (typeof reasoning !== "string" || !reasoning.trim()) return null;
  return reasoning.length > 8_000 ? `${reasoning.slice(0, 8_000)}…` : reasoning;
}

function createAssistantWireReplies(result) {
  const message = result?.data?.message;
  const text = message?.content ?? result?.data?.outputText ?? result?.data?.text ?? "";
  const toolCalls = readWireToolCalls(message);
  const reply = { role: "assistant", content: text || "" };
  if (toolCalls.length > 0) reply.tool_calls = toolCalls;
  return [reply];
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

function normalizeResponseMessages(input, instructions, meta = { droppedReasoningItems: 0 }) {
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

    // Reasoning items are accepted and dropped: with session chaining the
    // gateway retains its own reasoning summaries, so opaque client-resent
    // reasoning payloads are not needed on the chat-completions wire.
    if (item.type === "reasoning") {
      meta.droppedReasoningItems += 1;
      return;
    }

    if (item.type === "function_call") {
      const callId = readRequiredResponseString(item.call_id, `${param}.call_id`);
      const name = readRequiredResponseString(item.name, `${param}.name`);
      if (typeof item.arguments !== "string") {
        throw createValidationError(
          `${param}.arguments must be a JSON string.`,
          `${param}.arguments`,
        );
      }
      messages.push({
        role: "assistant",
        content: "",
        tool_calls: [{
          id: callId,
          type: "function",
          function: { name, arguments: item.arguments },
        }],
      });
      return;
    }

    if (item.type === "function_call_output") {
      const callId = readRequiredResponseString(item.call_id, `${param}.call_id`);
      if (typeof item.output !== "string") {
        throw createValidationError(`${param}.output must be a string.`, `${param}.output`);
      }
      messages.push({
        role: "tool",
        content: item.output,
        tool_call_id: callId,
      });
      return;
    }

    if (item.type !== undefined && item.type !== "message") {
      throw createUnsupportedError(
        "Only message, function_call, function_call_output, and reasoning input items are supported.",
        `${param}.type`,
      );
    }
    const role = item.role === "developer" ? "system" : item.role;
    if (!new Set(["system", "user", "assistant"]).has(role)) {
      throw createValidationError(`${param}.role is not supported.`, `${param}.role`);
    }
    const content = normalizeResponseContent(item.content, `${param}.content`, role);
    if (role === "assistant" && typeof content === "string" && !content.trim()) {
      // Clients replay blank assistant turns ("\n\n") as history; they carry
      // no signal next to the function_call items that follow them.
      meta.droppedBlankAssistantMessages = (meta.droppedBlankAssistantMessages ?? 0) + 1;
      return;
    }
    messages.push({ role, content });
  });
  return messages;
}

function readRequiredResponseString(value, param) {
  if (typeof value !== "string" || !value.trim()) {
    throw createValidationError(`${param} must be a non-empty string.`, param);
  }
  return value;
}

function normalizeResponseTools(value) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw createValidationError("tools must be an array.", "tools");
  }
  if (value.length === 0) return undefined;
  if (value.length > 128) {
    throw createValidationError("tools cannot contain more than 128 entries.", "tools");
  }
  const mapped = [];
  const droppedToolTypes = [];
  value.forEach((tool, index) => {
    const param = `tools[${index}]`;
    if (!tool || typeof tool !== "object" || Array.isArray(tool)) {
      throw createValidationError(`${param} must be an object.`, param);
    }
    if (DROPPED_TOOL_TYPES.has(tool.type)) {
      droppedToolTypes.push(tool.type);
      return;
    }
    if (tool.type !== "function") {
      throw createUnsupportedError(
        `Only function tools are supported in the Responses layer; ${tool.type ?? "unknown"} is not.`,
        `${param}.type`,
      );
    }
    const name = readRequiredResponseString(tool.name, `${param}.name`);
    const fn = { name };
    if (tool.description !== undefined && tool.description !== null) {
      if (typeof tool.description !== "string") {
        throw createValidationError(`${param}.description must be a string.`, `${param}.description`);
      }
      fn.description = tool.description;
    }
    if (tool.parameters !== undefined && tool.parameters !== null) {
      if (typeof tool.parameters !== "object" || Array.isArray(tool.parameters)) {
        throw createValidationError(`${param}.parameters must be an object.`, `${param}.parameters`);
      }
      fn.parameters = tool.parameters;
    }
    if (tool.strict !== undefined && tool.strict !== null) {
      if (typeof tool.strict !== "boolean") {
        throw createValidationError(`${param}.strict must be a boolean.`, `${param}.strict`);
      }
      fn.strict = tool.strict;
    }
    mapped.push({ type: "function", function: fn });
  });
  if (mapped.length === 0) return droppedToolTypes.length > 0 ? { droppedToolTypes } : undefined;
  return droppedToolTypes.length > 0 ? { tools: mapped, droppedToolTypes } : { tools: mapped };
}

function normalizeResponseToolChoice(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    if (!new Set(["none", "auto", "required"]).has(value)) {
      throw createValidationError(
        "tool_choice must be 'none', 'auto', 'required', or a named function object.",
        "tool_choice",
      );
    }
    return value;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw createValidationError("tool_choice must be a string or an object.", "tool_choice");
  }
  if (value.type !== "function") {
    throw createUnsupportedError(
      "Only function tool_choice objects are supported.",
      "tool_choice.type",
    );
  }
  const name = readRequiredResponseString(value.name, "tool_choice.name");
  return { type: "function", function: { name } };
}

function normalizeResponseInclude(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw createValidationError("include must be an array of tokens.", "include");
  }
  const dropped = [];
  for (const token of value) {
    if (typeof token !== "string" || !token.trim()) {
      throw createValidationError("include tokens must be non-empty strings.", "include");
    }
    if (!DROPPED_INCLUDE_TOKENS.has(token)) {
      throw createUnsupportedError(
        `include token "${token}" is not supported by this Responses compatibility layer.`,
        "include",
      );
    }
    dropped.push(token);
  }
  return [...new Set(dropped)];
}

function validateDroppedParameters(body) {
  const dropped = [];
  for (const [field, isValid] of Object.entries(DROPPED_PARAMETER_VALIDATORS)) {
    const value = body[field];
    if (value === undefined || value === null) continue;
    if (!isValid(value)) {
      throw createValidationError(`${field} has an unsupported shape.`, field);
    }
    dropped.push(field);
  }
  return dropped;
}

function normalizeResponseContent(content, param, role) {
  if (typeof content === "string") {
    if (!content.trim()) throw createValidationError(`${param} cannot be empty.`, param);
    return content;
  }
  if (!Array.isArray(content) || content.length === 0) {
    throw createValidationError(`${param} must contain text.`, param);
  }
  let hasImage = false;
  const normalized = content.map((part, index) => {
    const partParam = `${param}[${index}]`;
    if (part && new Set(["input_text", "output_text"]).has(part.type) && typeof part.text === "string") {
      return { type: "text", text: part.text };
    }
    if (part?.type === "input_image") {
      if (role !== "user") {
        throw createUnsupportedError("input_image is allowed only in user messages.", partParam);
      }
      if (typeof part.image_url !== "string") {
        throw createValidationError(`${partParam}.image_url must be a string.`, `${partParam}.image_url`);
      }
      if (!part.image_url.startsWith("data:")) {
        throw createUnsupportedError(
          "Remote image URLs are disabled; use an inline base64 data URL.",
          `${partParam}.image_url`,
        );
      }
      hasImage = true;
      return {
        type: "image_url",
        image_url: {
          url: part.image_url,
          detail: part.detail ?? "auto",
        },
      };
    }
    throw createUnsupportedError(
      "Only input_text, output_text, and inline input_image content parts are supported.",
      partParam,
    );
  });
  const text = normalized
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  if (!text.trim() && !hasImage && role !== "assistant") {
    throw createValidationError(`${param} cannot be empty.`, param);
  }
  return hasImage ? normalized : text;
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
  mergedWireMessages = [],
  gatewayService,
  enterpriseGovernanceService,
  request,
  response,
  startedAt,
  writeServiceLog,
  session = null,
  sessionStore = null,
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
  const accumulatedToolCalls = new Map();
  const createdAt = Math.floor(startedAt / 1000);
  const guardrailsEngine = getGuardrailsEngine(request.enterpriseIdentity?.tenantId);

  response.on("close", () => {
    clientClosed = true;
  });
  const primedStream = await primeGatewayStream(gatewayService.executeStream(gatewayInput));
  const preflightError = readPrimedGatewayStreamError(primedStream);
  const preflightStatus = resolveProviderDispatchHttpStatus(preflightError?.code);
  if (preflightError && preflightStatus !== null) {
    await closePrimedGatewayStream(primedStream);
    writeServiceLog?.("openai_response_stream_failed", {
      method: request.method,
      path: RESPONSES_PATH,
      code: preflightError.code,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, preflightStatus, createOpenAiError(preflightError));
    return;
  }
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
    for await (const event of iteratePrimedGatewayStream(primedStream)) {
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
        // Guardrails 输出侧（流式）：对每个 delta 尽力脱敏，fail-open 保证流不中断。
        const delta = guardrailsEngine.inspectSseDelta(event.textDelta ?? "");
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
      if (Array.isArray(event.rawProviderMeta?.toolCallsDelta)) {
        for (const deltaCall of event.rawProviderMeta.toolCallsDelta) {
          if (!deltaCall || typeof deltaCall !== "object") continue;
          const index = Number.isInteger(deltaCall.index) ? deltaCall.index : 0;
          const current = accumulatedToolCalls.get(index) ?? {
            id: null,
            function: { name: "", arguments: "" },
          };
          if (typeof deltaCall.id === "string" && deltaCall.id) current.id = deltaCall.id;
          if (deltaCall.function?.name) {
            current.function.name += deltaCall.function.name;
          }
          if (typeof deltaCall.function?.arguments === "string") {
            current.function.arguments += deltaCall.function.arguments;
          }
          accumulatedToolCalls.set(index, current);
        }
      }
    }
  } catch (error) {
    failed = true;
    writeResponseStreamError(response, error, sequenceNumber++);
  }

  if (!clientClosed && !failed) {
    const toolCallItems = [...accumulatedToolCalls.values()]
      .filter((call) => call.function.name)
      .map((call) => toFunctionCallItem({
        id: call.id ?? `call_${randomUUID().slice(0, 8)}`,
        function: call.function,
      }));
    for (const [itemIndex, item] of toolCallItems.entries()) {
      writeResponseSse(response, {
        type: "response.output_item.added",
        sequence_number: sequenceNumber++,
        output_index: itemIndex + 1,
        item: { ...item, status: "in_progress" },
      });
      writeResponseSse(response, {
        type: "response.output_item.done",
        sequence_number: sequenceNumber++,
        output_index: itemIndex + 1,
        item,
      });
    }
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
      session,
      status: "completed",
      toolCallItems,
    });
    const streamedToolCalls = toolCallItems.map((item) => ({
      id: item.call_id,
      type: "function",
      function: { name: item.name, arguments: item.arguments },
    }));
    const storedSession = storeResponseSession({
      sessionStore,
      session,
      responseId,
      instructions: body.instructions ?? session?.previous?.instructions ?? null,
      contextMessages: [
        ...mergedWireMessages,
        streamedToolCalls.length > 0
          ? { role: "assistant", content: outputText || "", tool_calls: streamedToolCalls }
          : { role: "assistant", content: outputText },
      ],
      assistantOutput: outputText,
      model: selectedModel,
      providerId: selectedProvider,
      responseBody: completed,
    });
    completed.store = storedSession;
    recordVirtualKeyUsage({
      enterpriseGovernanceService,
      request,
      writeServiceLog,
      tokens: estimateStreamTokens(gatewayInput, outputText),
      path: RESPONSES_PATH,
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
  session = null,
  status,
  toolCallItems = [],
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
    output: completed
      ? [...toolCallItems, createOutputMessage(responseId, outputText, "completed")]
      : [],
    output_text: outputText,
    parallel_tool_calls: body.parallel_tool_calls ?? false,
    temperature: body.temperature ?? null,
    tool_choice: body.tool_choice ?? "auto",
    tools: body.tools ?? [],
    top_p: body.top_p ?? null,
    max_output_tokens: body.max_output_tokens ?? null,
    previous_response_id: session?.previousResponseId ?? null,
    reasoning: session?.reasoning
      ? { effort: session.reasoning.effort, summary: session.reasoning.summary }
      : null,
    store: session?.store === true,
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
