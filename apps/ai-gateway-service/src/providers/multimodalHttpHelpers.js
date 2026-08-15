// src/providers/multimodalHttpHelpers.js
// HTTP call helpers for the multimodal provider adapter.

import { sleep } from "../entrypoints/entrypointUtils.js";
import { safeOutboundFetch } from "../security/safeOutboundFetch.ts";
import { safeReadJsonResponse, createProviderHttpError, createAdapterError } from "./multimodalUtils.js";

export async function executeWithRetry(fn, { maxRetries = 2, baseDelayMs = 1000 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries || !err.retryable) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      await sleep(delay);
    }
  }
}

export async function callJson(fetchImpl = safeOutboundFetch, { url, apiKey, payload, method = "POST", timeoutMs, provider, extraHeaders = {} }) {
  return executeWithRetry(async () => {
    const headers = { "content-type": "application/json" };
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;
    Object.assign(headers, extraHeaders);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 30_000);

    try {
      const response = await fetchImpl(url, {
        method,
        headers,
        body: method === "GET" ? undefined : JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await safeReadJsonResponse(response);
        throw createProviderHttpError(provider, response.status, errorBody);
      }

      return await safeReadJsonResponse(response);
    } catch (error) {
      if (error?.category === "provider" || error?.category === "multimodal") throw error;
      if (error?.name === "AbortError") {
        throw createAdapterError("multimodal_request_timeout", `${provider} request timed out after ${timeoutMs}ms.`, true);
      }
      throw createAdapterError("multimodal_network_error", `${provider} request failed: ${error?.message ?? "unknown error"}`, true);
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

const MAX_BINARY_RESPONSE_BYTES = 50 * 1024 * 1024;

async function readBinaryWithLimit(response, provider, maxBytes = MAX_BINARY_RESPONSE_BYTES) {
  if (!response.body) {
    return Buffer.from(await response.arrayBuffer());
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw createAdapterError(
        "multimodal_response_too_large",
        `${provider} binary response exceeded ${maxBytes} bytes.`,
        false,
      );
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export async function callBinary(fetchImpl = safeOutboundFetch, { url, apiKey, payload, timeoutMs, provider }) {
  return executeWithRetry(async () => {
    const headers = { "content-type": "application/json" };
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 60_000);

    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await safeReadJsonResponse(response);
        throw createProviderHttpError(provider, response.status, errorBody);
      }

      const buffer = await readBinaryWithLimit(response, provider);
      return buffer;
    } catch (error) {
      if (error?.category === "provider" || error?.category === "multimodal") throw error;
      if (error?.name === "AbortError") {
        throw createAdapterError("multimodal_request_timeout", `${provider} request timed out after ${timeoutMs}ms.`, true);
      }
      throw createAdapterError("multimodal_network_error", `${provider} request failed: ${error?.message ?? "unknown error"}`, true);
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

export async function callMultipart(fetchImpl = safeOutboundFetch, { url, apiKey, formData, timeoutMs, provider }) {
  return executeWithRetry(async () => {
    const headers = {
      "content-type": `multipart/form-data; boundary=${formData.boundary}`,
    };
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 120_000);

    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers,
        body: formData.body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await safeReadJsonResponse(response);
        throw createProviderHttpError(provider, response.status, errorBody);
      }

      return await safeReadJsonResponse(response);
    } catch (error) {
      if (error?.category === "provider" || error?.category === "multimodal") throw error;
      if (error?.name === "AbortError") {
        throw createAdapterError("multimodal_request_timeout", `${provider} request timed out after ${timeoutMs}ms.`, true);
      }
      throw createAdapterError("multimodal_network_error", `${provider} request failed: ${error?.message ?? "unknown error"}`, true);
    } finally {
      clearTimeout(timeoutId);
    }
  });
}
