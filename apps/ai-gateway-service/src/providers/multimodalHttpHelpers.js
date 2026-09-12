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
const BINARY_READER_CLEANUP_MS = 100;

function binaryAbortError(provider, cause, timedOut = false, timeoutMs) {
  const error = createAdapterError(
    timedOut ? "multimodal_request_timeout" : "multimodal_request_aborted",
    timedOut ? `${provider} request timed out after ${timeoutMs}ms.` : `${provider} request was cancelled.`,
    timedOut,
  );
  error.cause = cause;
  return error;
}

async function awaitBinaryOperation(operation, signal) {
  if (!signal) return operation();
  if (signal.aborted) throw signal.reason;
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    const result = await Promise.race([Promise.resolve().then(() => {
      if (signal.aborted) throw signal.reason;
      return operation();
    }), aborted]);
    if (signal.aborted) throw signal.reason;
    return result;
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

async function cancelBinaryReader(reader) {
  let cleanupTimer;
  try {
    // Cancelling local reads does not establish whether the provider stopped work.
    await Promise.race([
      Promise.resolve().then(() => reader.cancel()).catch(() => {}),
      new Promise((resolve) => { cleanupTimer = setTimeout(resolve, BINARY_READER_CLEANUP_MS); }),
    ]);
  } finally {
    clearTimeout(cleanupTimer);
  }
}

async function readBinaryWithLimit(response, provider, { maxBytes, requireReader, signal }) {
  const tooLarge = () => createAdapterError(
    "multimodal_response_too_large", `${provider} binary response exceeded ${maxBytes} bytes.`, false,
  );
  if (typeof response.body?.getReader !== "function") {
    if (requireReader) {
      throw createAdapterError("multimodal_response_stream_unavailable",
        `${provider} response cannot enforce a streaming byte limit.`, false);
    }
    // Compatibility for legacy response doubles; this fallback allocates before checking.
    const value = await awaitBinaryOperation(() => !response.ok && typeof response.arrayBuffer !== "function"
      ? response.text() : response.arrayBuffer(), signal);
    const buffer = Buffer.from(value);
    if (buffer.byteLength > maxBytes) throw tooLarge();
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  let complete = false;
  try {
    for (;;) {
      const { done, value } = await awaitBinaryOperation(() => reader.read(), signal);
      if (done) { complete = true; break; }
      if (value.byteLength > maxBytes - total) throw tooLarge();
      total += value.byteLength;
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  } finally {
    if (!complete) await cancelBinaryReader(reader);
    try { reader.releaseLock(); } catch { /* A pending custom reader may still own its lock. */ }
  }
}

/**
 * @param {typeof safeOutboundFetch} fetchImpl
 * @param {{url: string, provider: string, payload: unknown, apiKey?: string,
 *   timeoutMs?: number, signal?: AbortSignal, maxResponseBytes?: number, maxRetries?: number}} options
 * @returns {Promise<Buffer>}
 */
export async function callBinary(fetchImpl = safeOutboundFetch, {
  url, apiKey, payload, timeoutMs, provider, signal, maxResponseBytes, maxRetries = 2,
}) {
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 2) {
    throw createAdapterError("multimodal_validation_error", "TTS maxRetries must be an integer from 0 to 2.", false);
  }
  if (maxResponseBytes !== undefined && (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0)) {
    throw createAdapterError("multimodal_validation_error", "TTS maxResponseBytes must be a positive safe integer.", false);
  }
  const effectiveTimeoutMs = timeoutMs || 60_000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw binaryAbortError(provider, signal.reason);
    const headers = { "content-type": "application/json" };
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;

    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => { if (!controller.signal.aborted) controller.abort(signal.reason); };
    signal?.addEventListener("abort", onAbort, { once: true });
    const timeoutId = setTimeout(() => {
      if (!controller.signal.aborted) {
        timedOut = true;
        controller.abort(new Error(`${provider} request deadline exceeded.`));
      }
    }, effectiveTimeoutMs);
    let retryError;
    try {
      if (signal?.aborted) onAbort();
      const response = await awaitBinaryOperation(() => fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      }), controller.signal);
      const buffer = await readBinaryWithLimit(response, provider, {
        maxBytes: maxResponseBytes ?? MAX_BINARY_RESPONSE_BYTES,
        requireReader: maxResponseBytes !== undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        let errorBody = {};
        try { errorBody = JSON.parse(buffer.toString("utf8")); } catch { /* Retain the HTTP status for non-JSON errors. */ }
        throw createProviderHttpError(provider, response.status, errorBody);
      }
      return buffer;
    } catch (error) {
      if (error !== controller.signal.reason && (error?.category === "provider" || error?.category === "multimodal")) {
        // Keep an established body-limit failure if its cleanup reaches the deadline.
        retryError = error;
      } else if (controller.signal.aborted) {
        retryError = binaryAbortError(provider, controller.signal.reason, timedOut, effectiveTimeoutMs);
      } else {
        retryError = createAdapterError("multimodal_network_error",
          `${provider} request failed: ${error?.message ?? "unknown error"}`, true);
        retryError.cause = error;
      }
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
    }
    if (attempt === maxRetries || !retryError.retryable) throw retryError;
    let retryTimer;
    try {
      await awaitBinaryOperation(() => new Promise((resolve) => {
        retryTimer = setTimeout(resolve, 1000 * Math.pow(2, attempt) + Math.random() * 500);
      }), signal);
    } catch (cause) {
      throw binaryAbortError(provider, cause);
    } finally {
      clearTimeout(retryTimer);
    }
  }
  throw createAdapterError("multimodal_retry_exhausted", "TTS retry loop ended without a result.", false);
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
