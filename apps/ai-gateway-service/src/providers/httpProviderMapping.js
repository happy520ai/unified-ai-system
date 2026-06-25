// ── HTTP Provider Mapping ──
// Extracted from httpLlmProviderAdapter.js — request/response mapping,
// stream parsing, response validation, and quality scoring.

import { createProviderResponse } from "./providerMapping.js";
import { getOrCreateAgent, fetchWithAgent } from "../http/connectionPool.js";
import {
  createProviderError,
  createErrorDetails,
  createErrorPrefix,
  isPrivateOrReservedUrl,
  isNetworkError,
  readJsonResponse,
  createHttpProviderError,
} from "./httpProviderErrorHelpers.js";

// ── Response Quality Scoring ──
/**
 * Score a provider response on a 0-1 scale using lightweight heuristics.
 * @param {object} providerResponse - The mapped provider response.
 * @returns {number} Score between 0 and 1.
 */
export function scoreResponseQuality(providerResponse) {
  let score = 0;
  const text = providerResponse?.text ?? "";
  const finishReason = providerResponse?.raw?.finishReason;
  const usage = providerResponse?.usage;
  const toolCalls = providerResponse?.toolCalls;

  if (text.length > 0) score += 0.2;
  if (text.length > 50) score += 0.2;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) score += 0.3;
  if (finishReason === "stop") score += 0.3;
  if (finishReason === "length") score -= 0.3;
  if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) score += 0.1;

  return Math.max(0, Math.min(1, score));
}

// ── Incremental Stream Argument Parsing ──
/**
 * Try to partially parse tool_call arguments as they arrive during streaming.
 * Attempts full JSON.parse first, then falls back to regex extraction of
 * key-value pairs for partial progress display.
 *
 * @param {string} accumulatedArgs - The accumulated argument string so far.
 * @returns {object|null} Parsed object, partial object with `_partial: true`, or null.
 */
export function tryPartialToolArgs(accumulatedArgs) {
  if (!accumulatedArgs || typeof accumulatedArgs !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(accumulatedArgs);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    return null;
  } catch {
    // Fall through to partial extraction
  }

  const pairRegex = /"([^"\\]+)"\s*:\s*"([^"\\]*)"/g;
  const extracted = {};
  let match;
  let found = false;

  while ((match = pairRegex.exec(accumulatedArgs)) !== null) {
    extracted[match[1]] = match[2];
    found = true;
  }

  if (!found) {
    const numBoolRegex = /"([^"\\]+)"\s*:\s*(true|false|null|\d+(?:\.\d+)?)/g;
    while ((match = numBoolRegex.exec(accumulatedArgs)) !== null) {
      try {
        extracted[match[1]] = JSON.parse(match[2]);
        found = true;
      } catch {
        // skip
      }
    }
  }

  if (!found) {
    return null;
  }

  return { _partial: true, ...extracted };
}

// ── Response Validation ──
/**
 * Validate that a chat completions response has the expected structure.
 * Returns the body if valid, throws a descriptive error if malformed.
 */
export function validateChatResponse(body) {
  if (!body || typeof body !== "object") {
    throw new Error("Provider returned non-object response body.");
  }
  if (!Array.isArray(body.choices) || body.choices.length === 0) {
    throw new Error("Provider response missing 'choices' array or it is empty.");
  }
  const choice = body.choices[0];
  if (!choice || typeof choice !== "object") {
    throw new Error("Provider response choice[0] is not an object.");
  }
  if (!choice.message || typeof choice.message !== "object") {
    if (!choice.delta || typeof choice.delta !== "object") {
      throw new Error("Provider response choice[0] missing 'message' or 'delta'.");
    }
  }
  const msg = choice.message || choice.delta;
  if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
    for (let i = 0; i < msg.tool_calls.length; i++) {
      const tc = msg.tool_calls[i];
      if (!tc || typeof tc !== "object") {
        throw new Error(`Provider response tool_calls[${i}] is not an object.`);
      }
      if (!tc.id || typeof tc.id !== "string") {
        tc.id = `tool_call_${i}_${Date.now()}`;
      }
      if (!tc.function || typeof tc.function !== "object") {
        throw new Error(`Provider response tool_calls[${i}] missing 'function'.`);
      }
      if (!tc.function.name || typeof tc.function.name !== "string") {
        throw new Error(`Provider response tool_calls[${i}] missing 'function.name'.`);
      }
    }
  }
  return body;
}

// ── Request Mapping ──
export function mapGatewayRequestToChatCompletions(providerRequest) {
  const { request, target } = providerRequest;
  const maxOutputTokens = request.options?.maxOutputTokens;
  const body = {
    model: target.modelId,
    messages: request.messages
      .filter((message) =>
        message.role === "system" || message.role === "user" ||
        message.role === "assistant" || message.role === "tool"
      )
      .map((message) => {
        const mapped = { role: message.role, content: message.content || "" };
        if (message.role === "assistant" && Array.isArray(message.tool_calls)) {
          mapped.tool_calls = message.tool_calls;
        }
        if (message.role === "tool") {
          mapped.tool_call_id = message.tool_call_id || "";
          if (message.name) mapped.name = message.name;
        }
        return mapped;
      }),
    temperature: request.options?.temperature,
    max_tokens: maxOutputTokens,
    stream: false,
  };

  if (Array.isArray(request.tools) && request.tools.length > 0) {
    body.tools = request.tools;
  }
  if (request.toolChoice) {
    body.tool_choice = request.toolChoice;
  }

  if (target.providerId === "mimo") {
    body.max_completion_tokens = maxOutputTokens;
    body.thinking = {
      type: "disabled",
    };
  }

  return body;
}

// ── Response Mapping ──
/**
 * Safely parse tool call arguments from API response.
 */
function safeParseToolArguments(args) {
  if (!args) return {};
  if (typeof args === "object") return args;
  try {
    return JSON.parse(args);
  } catch {
    return { _raw: args };
  }
}

export function mapChatCompletionsResponseToProviderResponse(body, { providerRequest, latencyMs }) {
  const choice = body?.choices?.[0];
  const apiMessage = choice?.message;
  const content = apiMessage?.content ?? "";
  const text = content || `[${providerRequest.target.providerId}:${providerRequest.target.modelId}] empty response`;

  const rawToolCalls = apiMessage?.tool_calls;
  let parsedToolCalls = null;
  if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
    parsedToolCalls = rawToolCalls.map((tc) => ({
      id: tc.id,
      type: tc.type || "function",
      name: tc.function?.name || "",
      arguments: safeParseToolArguments(tc.function?.arguments),
    }));
  }

  const message = {
    role: "assistant",
    content: text,
  };
  if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
    message.tool_calls = rawToolCalls;
  }

  return createProviderResponse({
    text,
    message,
    toolCalls: parsedToolCalls,
    usage: {
      inputTokens: body?.usage?.prompt_tokens ?? 0,
      outputTokens: body?.usage?.completion_tokens ?? 0,
      totalTokens: body?.usage?.total_tokens ?? 0,
    },
    latencyMs,
    executionStatus: "success",
    raw: {
      id: body?.id,
      model: body?.model,
      finishReason: choice?.finish_reason,
    },
  });
}

// ── Stream Parsing ──
function parseStreamLine(line) {
  const trimmed = line.trim();

  if (!trimmed || !trimmed.startsWith("data:")) {
    return null;
  }

  const data = trimmed.slice("data:".length).trim();

  if (data === "[DONE]") {
    return "done";
  }

  try {
    const parsed = JSON.parse(data);
    const textDelta = parsed?.choices?.[0]?.delta?.content ?? "";

    if (!textDelta) {
      return null;
    }

    return {
      textDelta,
      raw: {
        id: parsed?.id,
        model: parsed?.model,
        finishReason: parsed?.choices?.[0]?.finish_reason,
      },
    };
  } catch {
    return null;
  }
}

export async function* readChatCompletionsStream(response, providerRequest) {
  if (!response.body) {
    throw createProviderError({
      code: `${createErrorPrefix(providerRequest.target.providerId)}_STREAM_BODY_MISSING`,
      type: "http",
      message: "HTTP LLM provider returned no stream body.",
      retryable: false,
      details: createErrorDetails(providerRequest),
    });
  }

  const decoder = new TextDecoder();
  let buffer = "";
  const MAX_SSE_BUFFER = 1024 * 1024; // 1MB cap

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });

    if (buffer.length > MAX_SSE_BUFFER) {
      throw createProviderError({
        code: `${createErrorPrefix(providerRequest.target.providerId)}_STREAM_BUFFER_OVERFLOW`,
        type: "http",
        message: `SSE stream buffer exceeded ${MAX_SSE_BUFFER} bytes — possible malformed stream.`,
        retryable: false,
        details: createErrorDetails(providerRequest),
      });
    }

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const parsed = parseStreamLine(line);

      if (parsed === "done") {
        return;
      }

      if (parsed?.textDelta) {
        yield parsed;
      }
    }
  }

  const remaining = parseStreamLine(buffer);

  if (remaining?.textDelta) {
    yield remaining;
  }
}

// ── Stream Connection with Retry ──
/**
 * Open a streaming connection to the provider with retry on transient
 * initial-connection errors. Once the HTTP response is received successfully,
 * returns it. The caller is responsible for reading the SSE body.
 *
 * @param {object} opts
 * @param {string} opts.baseUrl
 * @param {string} opts.apiKey
 * @param {object} opts.payload
 * @param {object} opts.providerRequest
 * @param {string} opts.errorPrefix
 * @param {string} opts.providerName
 * @param {number} opts.timeoutMs
 * @param {number} opts.maxRetries
 * @param {function} opts.retryDelay - async (attempt, error) => void
 */
export async function openStreamWithRetry({
  baseUrl, apiKey, payload, providerRequest, errorPrefix, providerName,
  timeoutMs, maxRetries, retryDelay,
}) {
  let response;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (isPrivateOrReservedUrl(`${baseUrl}/chat/completions`)) {
        throw createHttpProviderError({
          response: null, body: null, providerRequest,
          message: `SSRF blocked: baseUrl resolves to a private or reserved address.`,
          retryable: false,
        });
      }

      const agent = getOrCreateAgent(baseUrl);
      response = await fetchWithAgent(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        agent,
        timeout: controller.signal ? undefined : 60_000,
      });

      if (!response.ok) {
        const err = createHttpProviderError({
          response,
          body: await readJsonResponse(response),
          providerRequest,
          prefix: errorPrefix,
          providerName,
        });
        if (err?.retryable && attempt < maxRetries) {
          clearTimeout(timeoutId);
          await retryDelay(attempt, err);
          continue;
        }
        clearTimeout(timeoutId);
        throw err;
      }

      clearTimeout(timeoutId);
      break;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error?.category === "provider" && error?.retryable && attempt < maxRetries) {
        await retryDelay(attempt, error);
        continue;
      }
      if (error?.category === "provider") {
        throw error;
      }
      if (error?.name === "AbortError") {
        const timeoutErr = createProviderError({
          code: `${errorPrefix}_REQUEST_TIMEOUT`,
          type: "timeout",
          message: `${providerName} stream request timed out after ${timeoutMs}ms.`,
          retryable: true,
          details: createErrorDetails(providerRequest, { timeoutMs }),
        });
        if (attempt < maxRetries) {
          await retryDelay(attempt, timeoutErr);
          continue;
        }
        throw timeoutErr;
      }
      if (isNetworkError(error)) {
        const netErr = createProviderError({
          code: `${errorPrefix}_NETWORK_ERROR`,
          type: "network",
          message: `${providerName} stream request failed before receiving a response.`,
          retryable: true,
          details: createErrorDetails(providerRequest),
        });
        if (attempt < maxRetries) {
          await retryDelay(attempt, netErr);
          continue;
        }
        throw netErr;
      }

      throw createProviderError({
        code: `${errorPrefix}_UNKNOWN_ERROR`,
        type: "unknown",
        message: error instanceof Error ? error.message : "HTTP LLM provider stream failed.",
        retryable: false,
        details: createErrorDetails(providerRequest),
      });
    }
  }
  return response;
}
