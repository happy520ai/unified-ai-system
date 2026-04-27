export function createRequestId(prefix = "req") {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${time}_${rand}`;
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
