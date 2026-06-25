// =============================================================================
// GodReviewCellExecutor — Gateway Call Helper
// Extracted gateway HTTP call logic to keep the main executor under 500 lines.
// =============================================================================

import {
  DEFAULT_TIMEOUT_MS,
  isUnsafeGatewayHost,
  safeJsonParse,
  log,
} from "./godReviewCellExecutor-helpers.js";

/**
 * Extract text content from various gateway response structures.
 * Supports OpenAI-compatible, simplified, and nested formats.
 * @param {*} data - Gateway response data
 * @returns {string}
 */
export function extractContent(data) {
  if (!data) return "";
  if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
    const choice = data.choices[0];
    if (choice.message?.content) return choice.message.content;
    if (choice.text) return choice.text;
    if (typeof choice === "string") return choice;
  }
  if (typeof data.content === "string") return data.content;
  if (typeof data.text === "string") return data.text;
  if (typeof data.result === "string") return data.result;
  if (typeof data.response === "string") return data.response;
  if (typeof data.output === "string") return data.output;
  if (data.data?.content) return data.data.content;
  if (data.response?.text) return data.response.text;
  if (data.result?.content) return data.result.content;
  return JSON.stringify(data);
}

/**
 * Send a request to the gateway /chat/auto endpoint with retry logic.
 *
 * @param {string} gatewayUrl - Base gateway URL
 * @param {Array<{role: string, content: string}>} messages - Message list
 * @param {Object} [options]
 * @param {number} [options.temperature] - Temperature parameter
 * @param {number} [options.maxTokens] - Max tokens
 * @param {string} [options.purpose] - Call purpose (for logging)
 * @param {number} [options.timeout] - Timeout in ms
 * @returns {Promise<{content: string, model: string, usage: Object|null}>}
 */
export async function callGateway(gatewayUrl, messages, options = {}) {
  const url = `${gatewayUrl}/chat/auto`;
  const timeout = options.timeout || DEFAULT_TIMEOUT_MS;
  const purpose = options.purpose || "unknown";

  // SSRF protection: validate gateway URL host
  try {
    const parsedUrl = new URL(gatewayUrl);
    if (isUnsafeGatewayHost(parsedUrl.hostname)) {
      throw new Error(`Gateway URL host "${parsedUrl.hostname}" is not allowed (private/reserved network).`);
    }
  } catch (e) {
    if (e.message.includes("not allowed")) throw e;
    throw new Error(`Invalid gateway URL: ${gatewayUrl}`);
  }

  const requestBody = { messages, stream: false };
  if (options.temperature !== undefined) requestBody.temperature = options.temperature;
  if (options.maxTokens !== undefined) requestBody.max_tokens = options.maxTokens;

  let lastError = null;
  const maxAttempts = 2; // first + 1 retry

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      log("info", `网关请求 [${purpose}] (attempt ${attempt}/${maxAttempts})`, {
        url, messageCount: messages.length, timeout,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Purpose": purpose,
          "X-Executor": "GodReviewCell",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // HTTP error handling
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "(无法读取错误响应体)");
        const errMsg = `Gateway responded with ${response.status}: ${errorBody.slice(0, 500)}`;

        // 5xx errors are retryable
        if (response.status >= 500 && attempt < maxAttempts) {
          log("warn", `网关 5xx 错误，将重试: ${errMsg}`);
          lastError = new Error(errMsg);
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }

        throw new Error(errMsg);
      }

      // Parse response
      const contentType = response.headers.get("content-type") || "";
      let data;

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const rawText = await response.text();
        data = safeJsonParse(rawText, { content: rawText });
      }

      const content = extractContent(data);
      const model = data.model || data.modelId || data.model_id || "unknown";
      const usage = data.usage || null;

      return { content, model, usage };
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === "AbortError") {
        lastError = new Error(`Gateway request timed out after ${timeout}ms [${purpose}]`);
      } else {
        lastError = err;
      }

      const isRetryable = attempt < maxAttempts && (
        err.name === "AbortError" ||
        err.message?.includes("ECONNREFUSED") ||
        err.message?.includes("ENOTFOUND") ||
        err.message?.includes("fetch failed") ||
        err.message?.includes("5xx") ||
        err.message?.includes("500") ||
        err.message?.includes("502") ||
        err.message?.includes("503")
      );

      if (isRetryable) {
        log("warn", `网关请求失败，将重试 (attempt ${attempt}): ${err.message}`);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error("Gateway call failed after all retry attempts");
}
