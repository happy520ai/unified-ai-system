// src/providers/multimodalHttpHelpers.js
// HTTP call helpers for the multimodal provider adapter.

import { sleep } from "../entrypoints/entrypointUtils.js";
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

export async function callJson(fetchImpl, { url, apiKey, payload, method = "POST", timeoutMs, provider, extraHeaders = {} }) {
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

export async function callBinary(fetchImpl, { url, apiKey, payload, timeoutMs, provider }) {
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

      const buffer = Buffer.from(await response.arrayBuffer());
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

export async function callMultipart(fetchImpl, { url, apiKey, formData, timeoutMs, provider }) {
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
