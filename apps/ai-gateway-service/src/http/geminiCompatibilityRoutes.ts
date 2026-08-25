// =============================================================================
// geminiCompatibilityRoutes.ts — inbound Gemini v1beta generateContent surface
//
// Lets Gemini-native clients call the gateway with the Google wire protocol:
//   POST /v1beta/models/{model}:generateContent
//   POST /v1beta/models/{model}:streamGenerateContent   (SSE, alt=sse)
//   GET  /v1beta/models
//
// Requests are translated to the internal chat input (reusing the OpenAI
// normalizer for validation and model resolution) so guardrails, virtual-key
// budgets, and metrics behave identically across protocol lanes. Responses are
// mapped back to Gemini GenerateContentResponse chunks. The credential-free
// fake provider stays the default execution lane.
// =============================================================================

import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { readJson, writeJson, writeSseHeaders } from "./utils/responseUtils.js";
import { getGuardrailsEngine } from "../guardrails/guardrailsEngine.ts";
import {
  applyVirtualKeyRequestGate,
  normalizeOpenAiChatCompletionRequest,
  recordVirtualKeyUsage,
  resolveOpenAiErrorStatus,
} from "./openAiCompatibilityRoutes.js";
import {
  recordChatRequest,
  recordChatTokens,
  recordChatTtft,
  recordGuardrailEvaluation,
  recordGuardrailFinding,
} from "../observability/aiMetrics.ts";
import { estimateTextTokens, estimateTokens } from "../cost/tokenEstimator.js";
import {
  closePrimedGatewayStream,
  iteratePrimedGatewayStream,
  primeGatewayStream,
  readPrimedGatewayStreamError,
} from "./gatewayStreamPreflight.ts";
import { resolveProviderDispatchHttpStatus } from "./providerDispatchHttpStatus.ts";

type GeminiModelRoute = {
  modelId: string;
  action: "generateContent" | "streamGenerateContent" | "batchGenerateContent";
};

const GEMINI_METHOD_ROUTE_PATTERN =
  /^\/(?:v1beta|v1)\/models\/([^/:][^/]*):(generateContent|streamGenerateContent|batchGenerateContent)$/;
const MAX_BATCH_REQUESTS = 16;
const GEMINI_MODELS_LIST_PATHS = new Set(["/v1beta/models", "/v1/models"]);

const GEMINI_AUDIO_MIME_TO_FORMAT: Record<string, string> = {
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
};

const FINISH_REASON_TO_GEMINI: Record<string, string> = {
  stop: "STOP",
  length: "MAX_TOKENS",
  content_filter: "SAFETY",
  tool_calls: "STOP",
  function_call: "STOP",
};

const HTTP_STATUS_TO_GOOGLE_STATUS: Record<number, string> = {
  400: "INVALID_ARGUMENT",
  401: "UNAUTHENTICATED",
  403: "PERMISSION_DENIED",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "ABORTED",
  413: "FAILED_PRECONDITION",
  429: "RESOURCE_EXHAUSTED",
  500: "INTERNAL",
  502: "UNAVAILABLE",
  503: "UNAVAILABLE",
  504: "DEADLINE_EXCEEDED",
};

// ── Route matching ──

export function parseGeminiModelRoute(pathname: unknown): GeminiModelRoute | null {
  const match = GEMINI_METHOD_ROUTE_PATTERN.exec(String(pathname ?? ""));
  if (!match) return null;
  return {
    modelId: safeDecode(match[1]),
    action: match[2] as GeminiModelRoute["action"],
  };
}

export function isGeminiModelsListRoute(pathname: unknown) {
  return GEMINI_MODELS_LIST_PATHS.has(String(pathname ?? "").replace(/\/+$/, ""));
}

export function isGeminiCompatibilityRoute(pathname: unknown) {
  return parseGeminiModelRoute(pathname) !== null || isGeminiModelsListRoute(pathname);
}

export function isGeminiStreamRoute(pathname: unknown) {
  return parseGeminiModelRoute(pathname)?.action === "streamGenerateContent";
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// ── Errors (Google REST error format) ──

export function createGeminiErrorPayload(
  statusCode: number,
  message: string,
  details?: unknown,
) {
  return {
    error: {
      code: statusCode,
      message,
      status: HTTP_STATUS_TO_GOOGLE_STATUS[statusCode] ?? "INTERNAL",
      ...(details !== undefined ? { details: [details] } : {}),
    },
  };
}

function writeGeminiError(response: any, statusCode: number, message: string, details?: unknown) {
  writeJson(response, statusCode, createGeminiErrorPayload(statusCode, message, details));
}

function googleStatusForHttp(statusCode: number) {
  return HTTP_STATUS_TO_GOOGLE_STATUS[statusCode] ?? "INTERNAL";
}

// ── Request translation: Gemini generateContent → OpenAI chat body ──

class GeminiTranslationError extends Error {
  statusCode: number;
  param?: string;

  constructor(message: string, param?: string, statusCode = 400) {
    super(message);
    this.name = "GeminiTranslationError";
    this.param = param;
    this.statusCode = statusCode;
  }
}

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  functionCall?: { name?: string; args?: Record<string, unknown> };
  functionResponse?: { name?: string; response?: unknown };
};

type GeminiContent = { role?: string; parts?: GeminiPart[] };

export function geminiRequestToOpenAiBody(
  body: Record<string, any>,
  modelId: string,
): Record<string, any> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new GeminiTranslationError("Request body must be a JSON object.");
  }
  if (!Array.isArray(body.contents) || body.contents.length === 0) {
    throw new GeminiTranslationError("contents must contain at least one entry.", "contents");
  }

  const messages: Record<string, any>[] = [];
  const systemText = extractSystemInstruction(body.systemInstruction);
  if (systemText) messages.push({ role: "system", content: systemText });

  // functionResponse parts resolve their tool_call_id against the most recent
  // assistant functionCall with the same function name (Gemini identifies
  // calls by name, OpenAI by call id).
  const callIdByName = new Map<string, string>();
  let callCounter = 0;

  body.contents.forEach((content: GeminiContent, contentIndex: number) => {
    const param = `contents[${contentIndex}]`;
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    if (parts.length === 0) {
      throw new GeminiTranslationError(`${param}.parts must not be empty.`, `${param}.parts`);
    }

    const textParts: { type: "text"; text: string }[] = [];
    const imageParts: { type: "image_url"; image_url: { url: string } }[] = [];
    const audioParts: { type: "input_audio"; input_audio: { data: string; format: string } }[] = [];
    const functionCalls: { name: string; args: Record<string, unknown> }[] = [];
    const functionResponses: { name: string; response: unknown }[] = [];

    for (const [partIndex, part] of parts.entries()) {
      const partParam = `${param}.parts[${partIndex}]`;
      if (!part || typeof part !== "object") {
        throw new GeminiTranslationError(`${partParam} must be an object.`, partParam);
      }
      if (typeof part.text === "string") {
        textParts.push({ type: "text", text: part.text });
      } else if (part.inlineData && typeof part.inlineData === "object") {
        const mimeType = String(part.inlineData.mimeType ?? "");
        const data = String(part.inlineData.data ?? "");
        if (!mimeType || !data) {
          throw new GeminiTranslationError(
            `${partParam}.inlineData requires mimeType and data.`,
            partParam,
          );
        }
        if (mimeType.startsWith("image/")) {
          imageParts.push({
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${data}` },
          });
        } else {
          // 音频：映射为 OpenAI input_audio（仅 wav/mp3，与兼容层策略一致）。
          const audioFormat = GEMINI_AUDIO_MIME_TO_FORMAT[mimeType];
          if (!audioFormat) {
            throw new GeminiTranslationError(
              `inlineData mimeType "${mimeType}" is not supported; use image/*, audio/wav, or audio/mpeg.`,
              partParam,
              400,
            );
          }
          audioParts.push({
            type: "input_audio",
            input_audio: { data, format: audioFormat },
          });
        }
      } else if (part.functionCall && typeof part.functionCall === "object") {
        const name = String(part.functionCall.name ?? "");
        if (!name) {
          throw new GeminiTranslationError(`${partParam}.functionCall requires a name.`, partParam);
        }
        functionCalls.push({
          name,
          args:
            part.functionCall.args && typeof part.functionCall.args === "object"
              ? part.functionCall.args as Record<string, unknown>
              : {},
        });
      } else if (part.functionResponse && typeof part.functionResponse === "object") {
        const name = String(part.functionResponse.name ?? "");
        if (!name) {
          throw new GeminiTranslationError(
            `${partParam}.functionResponse requires a name.`,
            partParam,
          );
        }
        functionResponses.push({ name, response: part.functionResponse.response ?? {} });
      } else {
        throw new GeminiTranslationError(
          `${partParam} must be a text, inlineData, functionCall, or functionResponse part.`,
          partParam,
        );
      }
    }

    if (functionResponses.length > 0) {
      for (const fnResponse of functionResponses) {
        const callId = callIdByName.get(fnResponse.name);
        if (!callId) {
          throw new GeminiTranslationError(
            `functionResponse for "${fnResponse.name}" has no preceding functionCall.`,
            param,
          );
        }
        messages.push({
          role: "tool",
          tool_call_id: callId,
          content: JSON.stringify(fnResponse.response ?? {}),
        });
      }
    }

    const role = content.role === "model" ? "assistant" : "user";
    if (functionCalls.length > 0 && role !== "assistant") {
      throw new GeminiTranslationError(
        `${param}.role must be "model" for functionCall parts.`,
        `${param}.role`,
      );
    }

    const contentParts = [...textParts, ...imageParts, ...audioParts];
    if (functionCalls.length > 0) {
      const toolCalls = functionCalls.map((call) => {
        const callId = `call_gemini_${++callCounter}`;
        callIdByName.set(call.name, callId);
        return {
          id: callId,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) },
        };
      });
      messages.push({
        role: "assistant",
        content: contentParts.length
          ? contentParts.map((part) => (part.type === "text" ? part.text : part)).join("\n")
          : null,
        tool_calls: toolCalls,
      });
    } else if (contentParts.length > 0 || functionResponses.length === 0) {
      if (contentParts.length === 1 && contentParts[0].type === "text" && imageParts.length === 0 && audioParts.length === 0) {
        messages.push({ role, content: textParts[0].text });
      } else {
        messages.push({ role, content: contentParts });
      }
    }
  });

  const openAiBody: Record<string, any> = { model: modelId, messages };

  const tools = translateGeminiTools(body.tools);
  if (tools) openAiBody.tools = tools;
  const toolChoice = translateGeminiToolConfig(body.toolConfig);
  if (toolChoice) openAiBody.tool_choice = toolChoice;

  const config = body.generationConfig && typeof body.generationConfig === "object"
    ? body.generationConfig
    : {};
  if (config.temperature != null) openAiBody.temperature = config.temperature;
  if (config.topP != null) openAiBody.top_p = config.topP;
  if (config.maxOutputTokens != null) openAiBody.max_tokens = config.maxOutputTokens;
  if (Array.isArray(config.stopSequences) && config.stopSequences.length > 0) {
    openAiBody.stop = config.stopSequences;
  }
  if (config.responseMimeType === "application/json") {
    openAiBody.response_format = { type: "json_object" };
  }

  return openAiBody;
}

function extractSystemInstruction(systemInstruction: unknown): string {
  if (systemInstruction == null) return "";
  if (typeof systemInstruction === "string") return systemInstruction;
  const parts = (systemInstruction as { parts?: GeminiPart[] })?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n\n");
}

function translateGeminiTools(tools: unknown) {
  if (tools == null) return null;
  if (!Array.isArray(tools)) {
    throw new GeminiTranslationError("tools must be an array.", "tools");
  }
  const functions: Record<string, unknown>[] = [];
  for (const [index, tool] of tools.entries()) {
    const declarations = (tool as { functionDeclarations?: unknown[] })?.functionDeclarations;
    if (!Array.isArray(declarations)) {
      throw new GeminiTranslationError(
        `tools[${index}] must declare functionDeclarations.`,
        `tools[${index}]`,
      );
    }
    for (const declaration of declarations) {
      const spec = declaration as Record<string, any>;
      if (!spec || typeof spec.name !== "string" || !spec.name) {
        throw new GeminiTranslationError(
          `tools[${index}].functionDeclarations entries require a name.`,
          `tools[${index}]`,
        );
      }
      functions.push({
        type: "function",
        function: {
          name: spec.name,
          ...(spec.description ? { description: spec.description } : {}),
          ...(spec.parameters && typeof spec.parameters === "object"
            ? { parameters: spec.parameters }
            : {}),
        },
      });
    }
  }
  return functions.length > 0 ? functions : null;
}

const TOOL_CONFIG_MODE_TO_OPENAI: Record<string, string> = {
  AUTO: "auto",
  ANY: "required",
  NONE: "none",
};

function translateGeminiToolConfig(toolConfig: unknown) {
  if (toolConfig == null) return null;
  const mode = (toolConfig as { functionCallingConfig?: { mode?: string } })?.functionCallingConfig
    ?.mode;
  if (mode == null) return null;
  const mapped = TOOL_CONFIG_MODE_TO_OPENAI[String(mode).toUpperCase()];
  if (!mapped) {
    throw new GeminiTranslationError(
      `toolConfig.functionCallingConfig.mode "${mode}" is not supported.`,
      "toolConfig",
    );
  }
  return mapped;
}

// ── Response translation: gateway result → Gemini GenerateContentResponse ──

export function createGeminiGenerateContentResponse(
  result: Record<string, any>,
  options: { requestedModel?: string } = {},
) {
  const data = result?.data ?? {};
  const usage = data.usage ?? {};
  const toolCalls = Array.isArray(data.message?.tool_calls)
    ? data.message.tool_calls
    : Array.isArray(data.message?.toolCalls)
      ? data.message.toolCalls
      : [];
  const text = data.message?.content ?? data.outputText ?? data.text ?? "";

  const parts: Record<string, any>[] = [];
  if (typeof text === "string" && text) parts.push({ text });
  for (const call of toolCalls) {
    const name = call?.function?.name ?? call?.name;
    if (!name) continue;
    parts.push({
      functionCall: {
        name,
        args: safeParseJsonObject(call?.function?.arguments ?? call?.arguments),
      },
    });
  }
  if (parts.length === 0) parts.push({ text: "" });

  return {
    candidates: [
      {
        content: { role: "model", parts },
        finishReason: FINISH_REASON_TO_GEMINI[data.finishReason ?? "stop"] ?? "STOP",
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: Number(usage.inputTokens ?? 0),
      candidatesTokenCount: Number(usage.outputTokens ?? 0),
      totalTokenCount: Number(
        usage.totalTokens ?? Number(usage.inputTokens ?? 0) + Number(usage.outputTokens ?? 0),
      ),
    },
    modelVersion: data.selectedModel ?? options.requestedModel ?? "",
    ...(data.id ?? result?.meta?.requestId
      ? { responseId: String(data.id ?? result?.meta?.requestId) }
      : {}),
  };
}

function safeParseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string" || value.trim() === "") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// ── Model list ──

export function createGeminiModelList(descriptors: any[] = []) {
  const models: Record<string, any>[] = [];
  for (const descriptor of descriptors ?? []) {
    for (const model of descriptor?.models ?? []) {
      if (model?.enabled === false) continue;
      const id = String(model?.id ?? "");
      if (!id) continue;
      models.push({
        name: `models/${id}`,
        displayName: String(model?.displayName ?? id),
        supportedGenerationMethods: ["generateContent", "streamGenerateContent"],
      });
    }
  }
  return { models };
}

// ── SSE helpers ──

function writeGeminiSseData(response: any, payload: unknown) {
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function createGeminiStreamChunk(
  textDelta: string,
  extra: Record<string, unknown> = {},
): Record<string, any> {
  return {
    candidates: [
      {
        content: { role: "model", parts: [{ text: textDelta }] },
        index: 0,
      },
    ],
    ...extra,
  };
}

function createGeminiStreamErrorPayload(envelopeError: unknown) {
  const error = (envelopeError ?? {}) as Record<string, any>;
  const statusCode = resolveOpenAiErrorStatus(error);
  return createGeminiErrorPayload(
    statusCode,
    String(error?.message ?? "Gateway execution failed."),
    error?.code ? { reason: String(error.code) } : undefined,
  );
}

// ── Dispatcher ──

export async function dispatchGeminiCompatibilityRoutes(context: Record<string, any>) {
  const {
    gatewayService,
    request,
    response,
    startedAt,
    url,
    writeServiceLog,
    enterpriseGovernanceService,
  } = context;

  const route = parseGeminiModelRoute(url?.pathname);
  const isModelsList = isGeminiModelsListRoute(url?.pathname);
  if (!route && !isModelsList) return ROUTE_NOT_HANDLED;
  const pathname = String(url.pathname);

  if (isModelsList) {
    if (request.method !== "GET") {
      writeGeminiError(response, 405, `Only GET is supported for ${pathname}.`);
      return;
    }
    const payload = createGeminiModelList(gatewayService.getProviderDescriptors());
    writeServiceLog?.("gemini_models_listed", {
      method: request.method,
      path: pathname,
      modelCount: payload.models.length,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 200, payload);
    return;
  }
  if (!route) return ROUTE_NOT_HANDLED;

  if (request.method !== "POST") {
    writeGeminiError(response, 405, `Only POST is supported for ${pathname}.`);
    return;
  }

  let body: Record<string, any>;
  try {
    body = await readJson(request);
  } catch {
    writeGeminiError(response, 400, "Request body must be valid JSON.");
    return;
  }

  // batchGenerateContent:批量体没有顶层 contents,必须在单条转换之前处理。
  if (route.action === "batchGenerateContent") {
    if (!Array.isArray(body.requests) || body.requests.length === 0) {
      writeGeminiError(response, 400, "requests must contain at least one GenerateContentRequest.");
      return;
    }
    if (body.requests.length > MAX_BATCH_REQUESTS) {
      writeGeminiError(response, 400, `requests supports at most ${MAX_BATCH_REQUESTS} entries.`);
      return;
    }
    const batchGuardrails = getGuardrailsEngine(request.enterpriseIdentity?.tenantId);
    const convertedEntries: Record<string, any>[] = [];
    for (const [index, entry] of body.requests.entries()) {
      const entryBody = geminiRequestToOpenAiBody(entry ?? {}, route.modelId);
      const verdict = batchGuardrails.inspectInput(entryBody);
      if (verdict.decision === "block") {
        recordGuardrailEvaluation("input", "block");
        writeGeminiError(response, 400, `Request ${index} blocked by chat guardrails.`);
        return;
      }
      for (const replacement of verdict.replacements) {
        const message = entryBody.messages?.[replacement.index];
        if (message && typeof message.content === "string") {
          message.content = replacement.content;
        }
      }
      convertedEntries.push(entryBody);
    }
    // 预算门以第一条的输入近似预检(批量按实际消耗记账)。
    const firstInput = normalizeOpenAiChatCompletionRequest(
      convertedEntries[0],
      gatewayService.getProviderDescriptors(),
    );
    if (applyVirtualKeyRequestGate({
      enterpriseGovernanceService,
      request,
      gatewayInput: firstInput,
      response,
      writeServiceLog,
      startedAt,
    })) {
      return;
    }
    const responses: Record<string, any>[] = [];
    let failures = 0;
    for (const [index, entryBody] of convertedEntries.entries()) {
      try {
        const entryInput = normalizeOpenAiChatCompletionRequest(
          entryBody,
          gatewayService.getProviderDescriptors(),
        );
        entryInput.metadata = {
          ...entryInput.metadata,
          source: "gemini-compatible-api",
          geminiCompatibility: { requestedModel: route.modelId, stream: false, batchIndex: index },
        };
        const result = await gatewayService.execute(entryInput);
        if (!result?.success) {
          failures += 1;
          responses.push(
            createGeminiErrorPayload(
              resolveOpenAiErrorStatus(result?.error ?? {}),
              String(result?.error?.message ?? result?.message ?? "Execution failed."),
            ),
          );
          continue;
        }
        responses.push(createGeminiGenerateContentResponse(result, { requestedModel: route.modelId }));
        const usage = result.data?.usage ?? {};
        recordVirtualKeyUsage({
          enterpriseGovernanceService,
          request,
          writeServiceLog,
          tokens: Number(usage.totalTokens ?? 0),
          path: pathname,
        });
      } catch (error) {
        if (error instanceof GeminiTranslationError) throw error;
        failures += 1;
        responses.push(
          createGeminiErrorPayload(500, error instanceof Error ? error.message : "Execution failed."),
        );
      }
    }
    recordChatRequest(pathname, false);
    writeServiceLog?.("gemini_batch_completed", {
      method: request.method,
      path: pathname,
      model: route.modelId,
      requestCount: body.requests.length,
      failures,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, 200, {
      responses,
      ...(failures > 0 ? { partialFailure: true, failureCount: failures } : {}),
    });
    return;
  }

  let openAiBody: Record<string, any>;
  try {
    openAiBody = geminiRequestToOpenAiBody(body, route.modelId);
  } catch (error) {
    if (error instanceof GeminiTranslationError) {
      writeGeminiError(response, error.statusCode, error.message, error.param ? { field: error.param } : undefined);
      return;
    }
    throw error;
  }

  // Guardrails（确定性本地扫描）：与 OpenAI lane 同一引擎、同一租户覆盖。
  const guardrailsEngine = getGuardrailsEngine(request.enterpriseIdentity?.tenantId);
  const guardrailInputVerdict = guardrailsEngine.inspectInput(openAiBody);
  if (guardrailInputVerdict.decision === "block") {
    recordGuardrailEvaluation("input", "block");
    for (const finding of guardrailInputVerdict.findings) {
      if (finding.action === "block") recordGuardrailFinding(finding.rule, finding.action);
    }
    writeServiceLog?.("gemini_generate_guardrail_blocked", {
      method: request.method,
      path: pathname,
      findings: guardrailInputVerdict.findings,
      durationMs: Date.now() - startedAt,
    });
    writeGeminiError(response, 400, "Request blocked by chat guardrails.");
    return;
  }
  if (guardrailInputVerdict.findings.length) {
    recordGuardrailEvaluation("input", "allow");
    for (const finding of guardrailInputVerdict.findings) {
      recordGuardrailFinding(finding.rule, finding.action);
    }
  }
  for (const replacement of guardrailInputVerdict.replacements) {
    const message = openAiBody.messages?.[replacement.index];
    if (message && typeof message.content === "string") {
      message.content = replacement.content;
    }
  }

  let gatewayInput: Record<string, any>;
  try {
    gatewayInput = normalizeOpenAiChatCompletionRequest(
      openAiBody,
      gatewayService.getProviderDescriptors(),
    );
  } catch (error) {
    const validationError = readErrorDetails(error);
    writeServiceLog?.("gemini_generate_validation_failed", {
      method: request.method,
      path: pathname,
      code: validationError.code,
      param: validationError.param,
      durationMs: Date.now() - startedAt,
    });
    writeGeminiError(
      response,
      400,
      String(validationError.message ?? "Invalid request."),
      validationError.param ? { field: String(validationError.param) } : undefined,
    );
    return;
  }
  gatewayInput.metadata = {
    ...gatewayInput.metadata,
    source: "gemini-compatible-api",
    geminiCompatibility: {
      requestedModel: route.modelId,
      stream: route.action === "streamGenerateContent",
    },
  };

  if (route.action === "streamGenerateContent") {
    await streamGeminiGenerateContent({
      gatewayInput,
      gatewayService,
      request,
      response,
      startedAt,
      pathname,
      writeServiceLog,
      enterpriseGovernanceService,
    });
    return;
  }



  const result = await gatewayService.execute(gatewayInput);
  if (!result?.success) {
    const error = readErrorDetails(result?.error ?? {
      code: result?.code,
      message: result?.message ?? "Gateway execution failed.",
    });
    const statusCode = resolveOpenAiErrorStatus(error);
    writeServiceLog?.("gemini_generate_failed", {
      method: request.method,
      path: pathname,
      code: error.code,
      durationMs: Date.now() - startedAt,
    });
    writeGeminiError(
      response,
      statusCode,
      String(error.message),
      error.code ? { reason: String(error.code) } : undefined,
    );
    return;
  }

  const geminiResponse = createGeminiGenerateContentResponse(result, {
    requestedModel: route.modelId,
  });

  // Guardrails 输出侧：对最终文本脱敏/拦截；fail-open 保证不影响正常响应。
  const outputPart = geminiResponse.candidates[0].content.parts.find(
    (part: Record<string, any>) => typeof part.text === "string",
  );
  if (outputPart && outputPart.text) {
    const outputVerdict = guardrailsEngine.inspectOutputText(outputPart.text);
    if (outputVerdict.decision === "block") {
      recordGuardrailEvaluation("output", "block");
      for (const finding of outputVerdict.findings) {
        if (finding.action === "block") recordGuardrailFinding(finding.rule, finding.action);
      }
      writeServiceLog?.("gemini_generate_guardrail_output_blocked", {
        method: request.method,
        path: pathname,
        findings: outputVerdict.findings,
        durationMs: Date.now() - startedAt,
      });
      writeGeminiError(response, 400, "Response blocked by chat guardrails.");
      return;
    }
    if (outputVerdict.findings.length) {
      recordGuardrailEvaluation("output", "allow");
      for (const finding of outputVerdict.findings) {
        recordGuardrailFinding(finding.rule, finding.action);
      }
    }
    if (outputVerdict.text !== outputPart.text) {
      outputPart.text = outputVerdict.text;
    }
  }

  recordChatRequest(pathname, false);
  const usage = result.data?.usage ?? {};
  recordChatTokens(
    result.data?.selectedModel ?? route.modelId,
    "input",
    usage.inputTokens ?? estimateTokens(gatewayInput).estimatedInputTokens,
  );
  recordChatTokens(
    result.data?.selectedModel ?? route.modelId,
    "output",
    usage.outputTokens ?? estimateTextTokens(String(outputPart?.text ?? "")),
  );
  writeServiceLog?.("gemini_generate_completed", {
    method: request.method,
    path: pathname,
    model: route.modelId,
    durationMs: Date.now() - startedAt,
  });
  writeJson(response, 200, geminiResponse);
}

function readErrorDetails(value: unknown): { code?: unknown; param?: unknown; message?: unknown } {
  return value && typeof value === "object"
    ? value as { code?: unknown; param?: unknown; message?: unknown }
    : {};
}

async function streamGeminiGenerateContent({
  gatewayInput,
  gatewayService,
  request,
  response,
  startedAt,
  pathname,
  writeServiceLog,
  enterpriseGovernanceService,
}: Record<string, any>) {
  let clientClosed = false;
  let failed = false;
  let firstTokenAt = 0;
  let streamOutputText = "";
  let finalEvent: Record<string, any> | null = null;
  let selectedModel = gatewayInput.model;

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

  const primedStream = await primeGatewayStream<Record<string, any>>(
    gatewayService.executeStream(gatewayInput),
  );
  const preflightError = readPrimedGatewayStreamError(primedStream);
  const preflightStatus = resolveProviderDispatchHttpStatus(preflightError?.code);
  if (preflightError && preflightStatus !== null) {
    await closePrimedGatewayStream(primedStream);
    writeServiceLog?.("gemini_stream_failed", {
      method: request.method,
      path: pathname,
      code: preflightError.code,
      durationMs: Date.now() - startedAt,
    });
    writeGeminiError(
      response,
      preflightStatus,
      String(preflightError.message ?? "Gateway execution failed."),
      preflightError.code ? { reason: String(preflightError.code) } : undefined,
    );
    return;
  }
  writeSseHeaders(response);

  const guardrailsEngine = getGuardrailsEngine(request.enterpriseIdentity?.tenantId);
  for await (const event of iteratePrimedGatewayStream(primedStream)) {
    if (clientClosed) break;
    if (event.type === "error") {
      failed = true;
      writeGeminiSseData(response, createGeminiStreamErrorPayload(event.envelope?.error ?? event.envelope));
      break;
    }
    finalEvent = event;
    selectedModel = event.selectedModel ?? selectedModel;
    if (typeof event.textDelta === "string" && event.textDelta) {
      // Guardrails 输出侧（流式）：对每个 delta 尽力脱敏，fail-open 保证流不中断。
      const redactedDelta = guardrailsEngine.inspectSseDelta(event.textDelta);
      if (redactedDelta !== event.textDelta) {
        event.textDelta = redactedDelta;
      }
      if (!firstTokenAt) {
        firstTokenAt = Date.now();
        recordChatTtft(pathname, firstTokenAt, startedAt);
      }
      streamOutputText += event.textDelta;
      writeGeminiSseData(response, createGeminiStreamChunk(event.textDelta));
    }
  }

  if (!failed && !clientClosed) {
    recordChatRequest(pathname, true);
    const usage = finalEvent?.rawProviderMeta?.usage ?? {};
    recordChatTokens(
      selectedModel,
      "input",
      usage.inputTokens ?? estimateTokens(gatewayInput).estimatedInputTokens,
    );
    recordChatTokens(
      selectedModel,
      "output",
      usage.outputTokens ?? estimateTextTokens(streamOutputText),
    );
    // 终块携带 finishReason 与 usageMetadata，与 Gemini 官方 SSE 行为一致。
    writeGeminiSseData(
      response,
      createGeminiStreamChunk("", {
        candidates: [
          {
            content: { role: "model", parts: [{ text: "" }] },
            finishReason: FINISH_REASON_TO_GEMINI[finalEvent?.finishReason ?? "stop"] ?? "STOP",
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: Number(usage.inputTokens ?? estimateTokens(gatewayInput).estimatedInputTokens),
          candidatesTokenCount: Number(usage.outputTokens ?? estimateTextTokens(streamOutputText)),
          totalTokenCount: Number(
            usage.totalTokens
              ?? (usage.inputTokens ?? estimateTokens(gatewayInput).estimatedInputTokens)
                + (usage.outputTokens ?? estimateTextTokens(streamOutputText)),
          ),
        },
      }),
    );
  }

  writeServiceLog?.(failed ? "gemini_generate_stream_failed" : "gemini_generate_stream_completed", {
    method: "POST",
    path: pathname,
    model: selectedModel,
    durationMs: Date.now() - startedAt,
  });
  if (!clientClosed) {
    response.end();
  }
}
