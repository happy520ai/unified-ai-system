// ── HTTP Provider Mapping ──
// Extracted from httpLlmProviderAdapter.js — request/response mapping,
// stream parsing, response validation, and quality scoring.

import { createProviderResponse } from "./providerMapping.js";
import { getOrCreateAgent, fetchWithAgent } from "../http/connectionPool.js";
import { resolveSafeOutboundUrl } from "../security/outboundUrlPolicy.ts";
import {
  createLinkedAbortController,
  findExecutionAbortError,
  throwIfExecutionAborted,
} from "@unified-ai-system/shared-utils";
import {
  createProviderError,
  createErrorDetails,
  createErrorPrefix,
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
        const toolCalls = message.toolCalls ?? message.tool_calls;
        if (message.role === "assistant" && Array.isArray(toolCalls)) {
          mapped.tool_calls = toolCalls;
        }
        if (message.role === "tool") {
          mapped.tool_call_id = message.toolCallId ?? message.tool_call_id ?? "";
          if (message.name) mapped.name = message.name;
        }
        return mapped;
      }),
    temperature: request.options?.temperature,
    top_p: request.options?.topP,
    max_tokens: maxOutputTokens,
    stop: request.options?.stopSequences,
    stream: false,
  };

  if (Array.isArray(request.tools) && request.tools.length > 0) {
    body.tools = request.tools;
  }
  if (request.toolChoice) {
    body.tool_choice = request.toolChoice;
  }
  if (typeof request.parallelToolCalls === "boolean") {
    body.parallel_tool_calls = request.parallelToolCalls;
  }
  if (request.options?.reasoningEffort) {
    body.reasoning_effort = request.options.reasoningEffort;
  }
  const responseFormat = request.metadata?.openAiCompatibility?.responseFormat;
  if (responseFormat) {
    body.response_format = responseFormat;
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

  // Reasoning capture: DeepSeek-style `reasoning_content`, Anthropic-via-OpenAI
  // `reasoning: { content }`, or a plain `reasoning` string. Only surfaced —
  // never re-sent to providers that did not ask for it.
  const reasoningContent = readReasoningContent(apiMessage);

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
  if (reasoningContent) {
    message.reasoningContent = reasoningContent;
  }
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
      reasoningTokens: body?.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
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

function readReasoningContent(apiMessage) {
  if (!apiMessage || typeof apiMessage !== "object") return "";
  if (typeof apiMessage.reasoning_content === "string") {
    return apiMessage.reasoning_content.trim() ? apiMessage.reasoning_content : "";
  }
  const reasoning = apiMessage.reasoning;
  if (typeof reasoning === "string") return reasoning.trim() ? reasoning : "";
  if (reasoning && typeof reasoning === "object" && typeof reasoning.content === "string") {
    return reasoning.content.trim() ? reasoning.content : "";
  }
  return "";
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
    const choice = parsed?.choices?.[0];
    const textDelta = choice?.delta?.content ?? "";
    const toolCallsDelta = choice?.delta?.tool_calls;
    const finishReason = choice?.finish_reason;

    if (!textDelta && !Array.isArray(toolCallsDelta) && !finishReason) {
      return null;
    }

    return {
      textDelta,
      raw: {
        id: parsed?.id,
        model: parsed?.model,
        finishReason,
        ...(Array.isArray(toolCallsDelta) ? { toolCallsDelta } : {}),
      },
    };
  } catch {
    return null;
  }
}

export async function* readChatCompletionsStream(response, providerRequest, signal) {
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

  throwIfExecutionAborted(signal);
  for await (const chunk of response.body) {
    throwIfExecutionAborted(signal);
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

      // Yield chunks that carry text, tool-call deltas, or a finish reason.
      // Tool-only deltas often have empty content — dropping them would lose
      // function calls on providers that emit them in one piece.
      if (
        parsed
        && (parsed.textDelta || Array.isArray(parsed.raw?.toolCallsDelta) || parsed.raw?.finishReason)
      ) {
        yield parsed;
      }
    }
  }

  const remaining = parseStreamLine(buffer);

  if (
    remaining
    && (remaining.textDelta || Array.isArray(remaining.raw?.toolCallsDelta) || remaining.raw?.finishReason)
  ) {
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
  timeoutMs, maxRetries, retryDelay, resolveOutboundUrl = resolveSafeOutboundUrl, signal,
}) {
  let response;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    throwIfExecutionAborted(signal);
    const timeoutError = createProviderError({
      code: `${errorPrefix}_REQUEST_TIMEOUT`,
      type: "timeout",
      message: `${providerName} stream request timed out after ${timeoutMs}ms.`,
      retryable: true,
      details: createErrorDetails(providerRequest, { timeoutMs }),
    });
    const requestControl = createLinkedAbortController({
      signal,
      timeoutMs,
      timeoutReason: timeoutError,
    });

    try {
      let destination;
      try {
        destination = await resolveOutboundUrl(`${baseUrl}/chat/completions`);
      } catch {
        throw createProviderError({
          code: `${errorPrefix}_SSRF_BLOCKED`,
          type: "security",
          message: "SSRF blocked: provider endpoint resolves to a private or reserved address.",
          retryable: false,
          details: createErrorDetails(providerRequest),
        });
      }

      const agent = getOrCreateAgent(baseUrl);
      response = await fetchWithAgent(destination.url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        agent,
        lookup: destination.lookup,
        signal: requestControl.signal,
        timeout: timeoutMs,
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
          requestControl.cleanup();
          await retryDelay(attempt, err, signal);
          continue;
        }
        requestControl.cleanup();
        throw err;
      }

      return {
        response,
        signal: requestControl.signal,
        cleanup: requestControl.cleanup,
      };
    } catch (error) {
      const cancellation = findExecutionAbortError(error, signal);
      if (cancellation) {
        requestControl.cleanup();
        throw cancellation;
      }
      const effectiveError = requestControl.signal.aborted && requestControl.signal.reason instanceof Error
        ? requestControl.signal.reason
        : error;
      requestControl.cleanup();

      if (effectiveError?.category === "provider" && effectiveError?.retryable && attempt < maxRetries) {
        await retryDelay(attempt, effectiveError, signal);
        continue;
      }
      if (effectiveError?.category === "provider") {
        throw effectiveError;
      }
      if (effectiveError?.name === "AbortError") {
        const timeoutErr = timeoutError;
        if (attempt < maxRetries) {
          await retryDelay(attempt, timeoutErr, signal);
          continue;
        }
        throw timeoutErr;
      }
      if (isNetworkError(effectiveError)) {
        const netErr = createProviderError({
          code: `${errorPrefix}_NETWORK_ERROR`,
          type: "network",
          message: `${providerName} stream request failed before receiving a response.`,
          retryable: true,
          details: createErrorDetails(providerRequest),
        });
        if (attempt < maxRetries) {
          await retryDelay(attempt, netErr, signal);
          continue;
        }
        throw netErr;
      }

      throw createProviderError({
        code: `${errorPrefix}_UNKNOWN_ERROR`,
        type: "unknown",
        message: effectiveError instanceof Error ? effectiveError.message : "HTTP LLM provider stream failed.",
        retryable: false,
        details: createErrorDetails(providerRequest),
      });
    }
  }
  return response;
}
