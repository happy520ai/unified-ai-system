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
