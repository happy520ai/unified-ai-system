export function createRequestId(prefix = "req") {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${time}_${rand}`;
}

export function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
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
