import { createHash } from "node:crypto";

export const INLINE_IMAGE_POLICY = Object.freeze({
  allowedMediaTypes: Object.freeze(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  maxImagesPerRequest: 8,
  maxBytesPerImage: 10 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
});

const INLINE_IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/i;

export function inspectInlineImageDataUrl(value, policy = INLINE_IMAGE_POLICY) {
  if (typeof value !== "string" || !value.startsWith("data:")) {
    throw createInlineImageError(
      "Image input must use an inline data URL; remote image URLs are disabled.",
      "INLINE_IMAGE_REMOTE_URL_UNSUPPORTED",
    );
  }

  const match = value.match(INLINE_IMAGE_DATA_URL);
  if (!match) {
    throw createInlineImageError(
      "Image data URL must contain strict base64 PNG, JPEG, WebP, or GIF data.",
      "INLINE_IMAGE_DATA_URL_INVALID",
    );
  }

  const mediaType = match[1].toLowerCase();
  const base64Data = match[2];
  if (!policy.allowedMediaTypes.includes(mediaType) || base64Data.length % 4 !== 0) {
    throw createInlineImageError(
      "Image data URL has an unsupported media type or malformed base64 payload.",
      "INLINE_IMAGE_DATA_URL_INVALID",
    );
  }

  const padding = base64Data.endsWith("==") ? 2 : base64Data.endsWith("=") ? 1 : 0;
  const estimatedBytes = (base64Data.length * 3) / 4 - padding;
  if (estimatedBytes > policy.maxBytesPerImage) {
    throw createInlineImageError(
      `Inline image exceeds the ${policy.maxBytesPerImage}-byte per-image limit.`,
      "INLINE_IMAGE_TOO_LARGE",
    );
  }

  const bytes = Buffer.from(base64Data, "base64");
  const canonicalPayload = bytes.toString("base64").replace(/=+$/, "");
  if (!bytes.length || canonicalPayload !== base64Data.replace(/=+$/, "")) {
    throw createInlineImageError(
      "Image data URL contains malformed base64 data.",
      "INLINE_IMAGE_DATA_URL_INVALID",
    );
  }

  return {
    mediaType,
    byteLength: bytes.length,
    base64Data,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export function extractMessageText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

export function hasImageContent(content) {
  return Array.isArray(content) && content.some((part) => part?.type === "image_url");
}

export function getMessageImageStats(messages, policy = INLINE_IMAGE_POLICY) {
  let imageCount = 0;
  let totalBytes = 0;

  for (const message of Array.isArray(messages) ? messages : []) {
    for (const part of Array.isArray(message?.content) ? message.content : []) {
      if (part?.type !== "image_url") continue;
      const inspected = inspectInlineImageDataUrl(part?.image_url?.url, policy);
      imageCount += 1;
      totalBytes += inspected.byteLength;
      if (imageCount > policy.maxImagesPerRequest) {
        throw createInlineImageError(
          `Request cannot contain more than ${policy.maxImagesPerRequest} inline images.`,
          "INLINE_IMAGE_COUNT_EXCEEDED",
        );
      }
      if (totalBytes > policy.maxTotalBytes) {
        throw createInlineImageError(
          `Inline images exceed the ${policy.maxTotalBytes}-byte request limit.`,
          "INLINE_IMAGE_TOTAL_TOO_LARGE",
        );
      }
    }
  }

  return { imageCount, totalBytes };
}

export function createMessageContentFingerprint(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (part?.type === "text" && typeof part.text === "string") return part.text;
    if (part?.type === "image_url") {
      const inspected = inspectInlineImageDataUrl(part?.image_url?.url);
      return `[inline-image:${inspected.sha256.slice(0, 24)}:${inspected.byteLength}]`;
    }
    return "";
  }).filter(Boolean).join("\n");
}

export function replaceMessageTextContent(content, replacement) {
  if (typeof content === "string") return replacement;
  if (!Array.isArray(content)) return replacement;

  let replaced = false;
  const next = [];
  for (const part of content) {
    if (part?.type === "text") {
      if (!replaced) {
        next.push({ type: "text", text: replacement });
        replaced = true;
      }
      continue;
    }
    next.push(part);
  }
  if (!replaced) next.unshift({ type: "text", text: replacement });
  return next;
}

function createInlineImageError(message, code) {
  const error = new TypeError(message);
  error.code = code;
  return error;
}

export function createRequestId(prefix = "req") {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${time}_${rand}`;
}

export function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

export const EXECUTION_ABORT_CODES = Object.freeze({
  CLIENT_DISCONNECTED: "CLIENT_DISCONNECTED",
  GATEWAY_DEADLINE_EXCEEDED: "GATEWAY_DEADLINE_EXCEEDED",
});

const EXECUTION_ABORT_CODE_SET = new Set(Object.values(EXECUTION_ABORT_CODES));

export class ExecutionAbortError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ExecutionAbortError";
    this.code = code;
    this.category = options.category
      ?? (code === EXECUTION_ABORT_CODES.GATEWAY_DEADLINE_EXCEEDED ? "timeout" : "cancellation");
    this.retryable = options.retryable ?? false;
    this.statusCode = options.statusCode
      ?? (code === EXECUTION_ABORT_CODES.GATEWAY_DEADLINE_EXCEEDED ? 504 : 499);
    this.details = options.details ?? {};
  }
}

export function createExecutionAbortError(code, message, options = {}) {
  if (!EXECUTION_ABORT_CODE_SET.has(code)) {
    throw new TypeError(`Unsupported execution abort code: ${code}`);
  }
  return new ExecutionAbortError(code, message, options);
}

export function isExecutionAbortError(error) {
  return Boolean(error && EXECUTION_ABORT_CODE_SET.has(error.code));
}

export function findExecutionAbortError(error, signal) {
  if (signal?.aborted && isExecutionAbortError(signal.reason)) {
    return signal.reason;
  }

  let current = error;
  const visited = new Set();
  while (current && !visited.has(current)) {
    if (isExecutionAbortError(current)) return current;
    visited.add(current);
    current = current.cause;
  }
  return null;
}

export function throwIfExecutionAborted(signal) {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  const error = new Error("Execution was aborted.");
  error.name = "AbortError";
  error.code = "ABORT_ERR";
  error.cause = signal.reason;
  throw error;
}

export function createLinkedAbortController(options = {}) {
  const controller = new AbortController();
  const parentSignal = options.signal;
  const abortFromParent = () => controller.abort(parentSignal.reason);

  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  const timeoutMs = Number(options.timeoutMs);
  const timeoutId = !controller.signal.aborted && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => {
        const reason = typeof options.timeoutReason === "function"
          ? options.timeoutReason()
          : options.timeoutReason;
        const timeoutError = reason instanceof Error ? reason : new Error(`Operation timed out after ${timeoutMs}ms`);
        if (!(reason instanceof Error)) timeoutError.name = "TimeoutError";
        controller.abort(timeoutError);
      }, timeoutMs)
    : undefined;
  timeoutId?.unref?.();

  let cleaned = false;
  return {
    controller,
    signal: controller.signal,
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
  };
}

export function abortableSleep(ms, signal) {
  throwIfExecutionAborted(signal);
  return new Promise((resolveSleep, rejectSleep) => {
    const onAbort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      if (signal.reason instanceof Error) {
        rejectSleep(signal.reason);
        return;
      }
      const error = new Error("Operation was aborted while waiting.");
      error.name = "AbortError";
      error.code = "ABORT_ERR";
      error.cause = signal.reason;
      rejectSleep(error);
    };
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolveSleep();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function listen(server, port = 0, host = "127.0.0.1") {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, host, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

export async function listenAtEphemeralUrl(server, host = "127.0.0.1") {
  await listen(server, 0, host);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server did not expose an ephemeral TCP port.");
  }
  return `http://${host}:${address.port}`;
}

export async function fetchJsonPayload(url, options) {
  const response = await fetch(url, options);
  return response.json();
}

export async function writeEvidenceFiles({
  evidenceDir,
  evidenceJsonPath,
  evidenceMdPath,
  body,
  renderMarkdown,
}) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, renderMarkdown(body), "utf8");
}

export function createOkEnvelope(data, params = {}) {
  return {
    status: "ok",
    data,
    meta: createMeta(params),
  };
}

export function createErrorEnvelope(code, message, params = {}) {
  return {
    status: "error",
    error: {
      code,
      message,
      category: params.category ?? "internal",
      retryable: params.retryable ?? false,
      details: params.details,
    },
    meta: createMeta(params),
  };
}

export async function withTimeout(task, params) {
  const timeoutMs = params.timeoutMs;
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(`${params.label ?? "operation"} timed out after ${timeoutMs}ms`);
      error.code = "TIMEOUT";
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([task, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function createPackageStatus(name) {
  return {
    name,
    status: "ready",
    phase: "phase-1-skeleton",
  };
}

function createMeta(params) {
  const now = Date.now();

  return {
    requestId: params.requestId,
    traceId: params.traceId,
    createdAt: new Date(now).toISOString(),
    durationMs: params.startedAt === undefined ? undefined : now - params.startedAt,
  };
}
