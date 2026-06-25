// src/providers/multimodalUtils.js
// Shared utility helpers for the multimodal provider adapter.

import { MODEL_PROVIDER_HINTS } from "./multimodalConstants.js";

export function resolveProvider(explicitProvider, model) {
  if (explicitProvider && String(explicitProvider).trim()) {
    return String(explicitProvider).trim().toLowerCase();
  }
  const modelText = String(model ?? "").trim();
  if (modelText) {
    for (const hint of MODEL_PROVIDER_HINTS) {
      if (hint.pattern.test(modelText)) return hint.provider;
    }
  }
  return "openai"; // default fallback
}

export function clampInt(value, min, max) {
  const parsed = Math.floor(Number(value));
  if (Number.isNaN(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

export function estimateTokenCount(inputArray) {
  // Rough heuristic: ~4 chars per token
  const totalChars = inputArray.reduce((sum, text) => sum + String(text).length, 0);
  return Math.max(1, Math.ceil(totalChars / 4));
}

export function formatToContentType(format) {
  const map = {
    mp3: "audio/mpeg",
    opus: "audio/opus",
    aac: "audio/aac",
    flac: "audio/flac",
    wav: "audio/wav",
    pcm: "audio/pcm",
  };
  return map[format] ?? "audio/mpeg";
}

export function buildMultipartFormData(fields) {
  const boundary = `----MultimodalBoundary${Date.now().toString(36)}`;
  const parts = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value && typeof value === "object" && value.buffer) {
      parts.push(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${key}"; filename="${value.filename}"\r\n` +
        `Content-Type: ${value.contentType}\r\n\r\n`,
      );
      parts.push(value.buffer);
      parts.push("\r\n");
    } else {
      parts.push(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
        `${String(value)}\r\n`,
      );
    }
  }

  parts.push(`--${boundary}--\r\n`);

  // Build the body as a Buffer
  const bufferParts = parts.map((part) => {
    if (Buffer.isBuffer(part)) return part;
    return Buffer.from(part, "utf8");
  });

  const body = Buffer.concat(bufferParts);
  // We need to return the body + boundary info for the caller
  body._boundary = boundary;
  return { body, boundary };
}

export async function safeReadJsonResponse(response) {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export function createProviderHttpError(provider, status, errorBody) {
  const errorMessage = errorBody?.error?.message || errorBody?.message || `HTTP ${status}`;
  const code = `multimodal_${provider}_http_${status}`;
  const error = new Error(`${provider} returned HTTP ${status}: ${errorMessage}`);
  error.code = code;
  error.category = "provider";
  error.retryable = status >= 500 || status === 429;
  error.httpStatus = status;
  error.provider = provider;
  return error;
}

export function createAdapterError(code, message, retryable) {
  const error = new Error(message);
  error.code = code;
  error.category = "multimodal";
  error.retryable = Boolean(retryable);
  return error;
}
