// src/http/multimodalRoutes.js
// Multimodal API routes: image generation, embeddings, TTS, STT.
// These routes are OpenAI-compatible and delegate to the multimodalProviderAdapter.

import { randomUUID } from "node:crypto";
import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import { createMultimodalProviderAdapter } from "../providers/multimodalProviderAdapter.js";

const MULTIMODAL_ROUTES = new Set([
  "/v1/images/generations",
  "/v1/embeddings",
  "/v1/audio/speech",
  "/v1/audio/transcriptions",
  // Convenience aliases without /v1 prefix
  "/images/generations",
  "/embeddings",
  "/audio/speech",
  "/audio/transcriptions",
]);

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB upload limit for audio
const MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024; // 10 MB for JSON bodies

// --- Per-route rate limiting (sliding window) ---

const RATE_LIMITS = {
  image: 10,
  tts: 20,
  embedding: 60,
  stt: 10,
};

const rateLimiters = new Map();

function checkRateLimit(key, maxPerMinute) {
  const now = Date.now();
  const window = rateLimiters.get(key) || [];
  const recent = window.filter(t => now - t < 60000);
  if (recent.length >= maxPerMinute) {
    return { allowed: false, retryAfterMs: 60000 - (now - recent[0]) };
  }
  recent.push(now);
  rateLimiters.set(key, recent);
  return { allowed: true };
}

function getRateLimitKey(pathname) {
  if (pathname.includes("/images/")) return "image";
  if (pathname.includes("/embeddings")) return "embedding";
  if (pathname.includes("/audio/speech")) return "tts";
  if (pathname.includes("/audio/transcriptions")) return "stt";
  return null;
}

export function isMultimodalRoute(pathname) {
  return MULTIMODAL_ROUTES.has(pathname);
}

export function getMultimodalRouteList() {
  return [
    "POST /v1/images/generations",
    "POST /v1/embeddings",
    "POST /v1/audio/speech",
    "POST /v1/audio/transcriptions",
  ];
}

/**
 * Handles a multimodal route request. Must be called only when isMultimodalRoute returns true.
 *
 * @param {object} params
 * @param {import("node:http").IncomingMessage} params.request
 * @param {import("node:http").ServerResponse} params.response
 * @param {URL} params.url
 * @param {number} params.startedAt
 * @param {object} params.application - The gateway application context
 * @param {object} [params.multimodalAdapter] - Optional pre-built adapter instance for reuse
 */
export async function handleMultimodalRoute({ request, response, url, startedAt, application, writeServiceLog, multimodalAdapter }) {
  const pathname = url.pathname;
  const requestId = randomUUID();

  if (request.method !== "POST") {
    writeJsonResponse(response, 405, createErrorEnvelope(
      "multimodal_method_not_allowed",
      `Only POST is supported for ${pathname}.`,
      { startedAt, category: "routing", requestId },
    ));
    return true;
  }

  // Rate limiting
  const rateLimitKey = getRateLimitKey(pathname);
  if (rateLimitKey) {
    const maxPerMinute = RATE_LIMITS[rateLimitKey];
    const rateCheck = checkRateLimit(rateLimitKey, maxPerMinute);
    if (!rateCheck.allowed) {
      const retryAfterSeconds = Math.ceil(rateCheck.retryAfterMs / 1000);
      response.writeHead(429, {
        "content-type": "application/json; charset=utf-8",
        "retry-after": String(retryAfterSeconds),
      });
      response.end(JSON.stringify(createErrorEnvelope(
        "multimodal_rate_limited",
        `Rate limit exceeded for ${rateLimitKey} requests. Max ${maxPerMinute} per minute.`,
        { startedAt, category: "rate_limit", requestId, retryAfterMs: rateCheck.retryAfterMs },
      )));
      return true;
    }
  }

  // Adapter reuse: use pre-built adapter if provided, otherwise create one (backward compatible)
  const adapter = multimodalAdapter ?? application?.multimodalAdapter ?? createMultimodalProviderAdapter({
    runtimeCredentialStore: application.runtimeCredentialStore,
    env: process.env,
  });

  const log = writeServiceLog || defaultLog;

  try {
    if (pathname === "/v1/images/generations" || pathname === "/images/generations") {
      return await handleImageGeneration({ request, response, startedAt, adapter, log, requestId });
    }
    if (pathname === "/v1/embeddings" || pathname === "/embeddings") {
      return await handleEmbedding({ request, response, startedAt, adapter, log, requestId });
    }
    if (pathname === "/v1/audio/speech" || pathname === "/audio/speech") {
      return await handleTts({ request, response, startedAt, adapter, log, requestId });
    }
    if (pathname === "/v1/audio/transcriptions" || pathname === "/audio/transcriptions") {
      return await handleStt({ request, response, startedAt, adapter, log, requestId });
    }
  } catch (error) {
    const statusCode = error?.category === "validation" ? 400
      : error?.category === "multimodal" && error?.code === "multimodal_api_key_missing" ? 401
      : error?.httpStatus && error.httpStatus >= 400 && error.httpStatus < 600 ? error.httpStatus
      : 422;

    log("multimodal_request_failed", {
      path: pathname,
      code: error?.code,
      category: error?.category,
      retryable: error?.retryable,
      requestId,
      durationMs: Date.now() - startedAt,
    });

    writeJsonResponse(response, statusCode, createErrorEnvelope(
      error?.code ?? "multimodal_request_failed",
      error instanceof Error ? error.message : "Multimodal request failed.",
      {
        startedAt,
        category: error?.category ?? "multimodal",
        retryable: error?.retryable ?? false,
        requestId,
      },
    ));
    return true;
  }

  return false;
}

// --- Route handlers ---

async function handleImageGeneration({ request, response, startedAt, adapter, log, requestId }) {
  const body = await readJsonBody(request);

  const prompt = String(body?.prompt ?? "").trim();
  if (!prompt) {
    throw createValidationError("multimodal_validation_error", "Image generation requires a non-empty prompt.");
  }

  const result = await adapter.generateImage({
    provider: body?.provider,
    model: body?.model,
    prompt,
    n: body?.n,
    size: body?.size,
    responseFormat: body?.response_format ?? body?.responseFormat,
    quality: body?.quality,
    style: body?.style,
    requestId,
  });

  log("image_generation_completed", {
    path: "/v1/images/generations",
    provider: result?.data?.provider,
    model: result?.data?.model,
    imageCount: result?.data?.usage?.images ?? 0,
    requestId,
    durationMs: Date.now() - startedAt,
  });

  writeJsonResponse(response, 200, createOkEnvelope(result.data, { startedAt, requestId }));
  return true;
}

async function handleEmbedding({ request, response, startedAt, adapter, log, requestId }) {
  const body = await readJsonBody(request);

  const input = body?.input;
  if (input === undefined || input === null || (typeof input === "string" && !input.trim()) || (Array.isArray(input) && input.length === 0)) {
    throw createValidationError("multimodal_validation_error", "Embedding request requires a non-empty input string or array.");
  }

  const result = await adapter.generateEmbedding({
    provider: body?.provider,
    model: body?.model,
    input,
    dimensions: body?.dimensions,
    encodingFormat: body?.encoding_format ?? body?.encodingFormat,
    requestId,
  });

  log("embedding_completed", {
    path: "/v1/embeddings",
    provider: result?.data?.provider,
    model: result?.data?.model,
    embeddingCount: result?.data?.embeddings?.length ?? 0,
    requestId,
    durationMs: Date.now() - startedAt,
  });

  writeJsonResponse(response, 200, createOkEnvelope(result.data, { startedAt, requestId }));
  return true;
}

async function handleTts({ request, response, startedAt, adapter, log, requestId }) {
  const body = await readJsonBody(request);

  const input = String(body?.input ?? "").trim();
  if (!input) {
    throw createValidationError("multimodal_validation_error", "TTS request requires a non-empty input text.");
  }

  const result = await adapter.synthesizeSpeech({
    provider: body?.provider,
    model: body?.model,
    input,
    voice: body?.voice,
    responseFormat: body?.response_format ?? body?.responseFormat,
    speed: body?.speed,
    requestId,
  });

  log("tts_completed", {
    path: "/v1/audio/speech",
    provider: result?.data?.provider,
    model: result?.data?.model,
    voice: result?.data?.voice,
    format: result?.data?.format,
    bytes: result?.data?.bytes,
    requestId,
    durationMs: Date.now() - startedAt,
  });

  // Return binary audio
  if (result.binary && result.audioBuffer) {
    response.writeHead(200, {
      "content-type": result.contentType || "audio/mpeg",
      "content-length": result.audioBuffer.length,
      "x-multimodal-provider": result.data.provider,
      "x-multimodal-model": result.data.model,
      "x-request-id": requestId,
    });
    response.end(result.audioBuffer);
  } else {
    writeJsonResponse(response, 200, createOkEnvelope(result.data, { startedAt, requestId }));
  }
  return true;
}

async function handleStt({ request, response, startedAt, adapter, log, requestId }) {
  const contentType = String(request.headers["content-type"] ?? "").toLowerCase();

  let audioBuffer;
  let filename = "audio.wav";
  let model = "whisper-1";
  let provider;
  let language;
  let responseFormat = "json";

  if (contentType.includes("multipart/form-data")) {
    // Parse multipart form data
    const parsed = await parseMultipartRequest(request, contentType);
    audioBuffer = parsed.file;
    filename = parsed.filename || "audio.wav";
    model = parsed.model || model;
    provider = parsed.provider;
    language = parsed.language;
    responseFormat = parsed.response_format || responseFormat;
  } else {
    // Accept raw audio body with model/provider in headers
    audioBuffer = await readRawBody(request, MAX_AUDIO_BYTES);
    model = request.headers["x-model"] || model;
    provider = request.headers["x-provider"];
    language = request.headers["x-language"];
    filename = request.headers["x-filename"] || "audio.wav";
  }

  if (!audioBuffer || audioBuffer.length === 0) {
    throw createValidationError("multimodal_validation_error", "STT request requires audio data in multipart form or raw body.");
  }

  const result = await adapter.transcribeAudio({
    provider,
    model,
    audioBuffer,
    filename,
    language,
    responseFormat,
    requestId,
  });

  log("stt_completed", {
    path: "/v1/audio/transcriptions",
    provider: result?.data?.provider,
    model: result?.data?.model,
    textLength: result?.data?.text?.length ?? 0,
    requestId,
    durationMs: Date.now() - startedAt,
  });

  writeJsonResponse(response, 200, createOkEnvelope(result.data, { startedAt, requestId }));
  return true;
}

// --- HTTP / body helpers ---

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      throw createValidationError("multimodal_body_too_large", `Request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes.`);
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw createValidationError("multimodal_invalid_json", "Request body must be valid JSON.");
  }
}

async function readRawBody(request, maxBytes) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      throw createValidationError("multimodal_body_too_large", `Audio data exceeds ${maxBytes} bytes.`);
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function parseMultipartRequest(request, contentType) {
  const rawBody = await readRawBody(request, MAX_AUDIO_BYTES);
  const boundary = extractBoundary(contentType);
  if (!boundary) {
    throw createValidationError("multimodal_multipart_invalid", "Multipart content-type must include a boundary.");
  }

  const result = {};
  const bodyText = rawBody.toString("binary");
  const parts = bodyText.split(`--${boundary}`);

  for (const part of parts) {
    if (!part || part.trim() === "--" || part.trim() === "") continue;

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headerSection = part.substring(0, headerEnd);
    const bodySection = part.substring(headerEnd + 4);
    // Strip trailing \r\n
    const cleanBody = bodySection.endsWith("\r\n") ? bodySection.slice(0, -2) : bodySection;

    const dispositionMatch = headerSection.match(/content-disposition:\s*form-data;\s*name="([^"]*)"(?:;\s*filename="([^"]*)")?/i);
    if (!dispositionMatch) continue;

    const fieldName = dispositionMatch[1];
    const fieldFilename = dispositionMatch[2];

    if (fieldName === "file" && fieldFilename) {
      result.file = Buffer.from(cleanBody, "binary");
      result.filename = fieldFilename;
    } else {
      result[fieldName] = cleanBody.trim();
    }
  }

  return result;
}

function extractBoundary(contentType) {
  const match = contentType.match(/boundary=([^\s;]+)/i);
  return match ? match[1] : null;
}

function writeJsonResponse(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function createValidationError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.category = "validation";
  error.retryable = false;
  return error;
}

function defaultLog(event, details) {
  // Fallback no-op logger; httpServer passes its own.
}
