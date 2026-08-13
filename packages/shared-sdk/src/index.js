const DEFAULT_TIMEOUT_MS = 10_000;

export const GATEWAY_CLIENT_ERROR_CODES = Object.freeze({
  ABORTED: "GATEWAY_CLIENT_ABORTED",
  TIMEOUT: "GATEWAY_CLIENT_TIMEOUT",
  NETWORK: "GATEWAY_NETWORK_ERROR",
  HTTP: "GATEWAY_HTTP_ERROR",
  PROTOCOL: "GATEWAY_PROTOCOL_ERROR",
  STREAM: "GATEWAY_STREAM_ERROR",
});

export class GatewayClientError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "GatewayClientError";
    this.code = options.code ?? GATEWAY_CLIENT_ERROR_CODES.NETWORK;
    this.kind = options.kind ?? "network";
    this.retryable = options.retryable ?? false;
    this.statusCode = options.statusCode;
    this.responseBody = options.responseBody;
  }
}

export class GatewayClientAbortError extends GatewayClientError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: GATEWAY_CLIENT_ERROR_CODES.ABORTED,
      kind: "cancelled",
      retryable: false,
    });
    this.name = "GatewayClientAbortError";
    this.reason = options.reason;
  }
}

export class GatewayClientTimeoutError extends GatewayClientError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: GATEWAY_CLIENT_ERROR_CODES.TIMEOUT,
      kind: "timeout",
      retryable: false,
    });
    this.name = "GatewayClientTimeoutError";
    this.timeoutMs = options.timeoutMs;
  }
}

export function createGatewayClient(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const headers = options.headers ?? {};
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const signal = options.signal;
  const requestJson = (requestOptions) =>
    requestJsonImpl({ baseUrl, headers, timeoutMs, signal, ...requestOptions });
  const requestSse = (requestOptions) =>
    requestSseImpl({ baseUrl, headers, timeoutMs, signal, ...requestOptions });

  return {
    baseUrl,
    health() {
      return requestJson({
        baseUrl,
        path: "/health/check",
        headers,
        timeoutMs,
      });
    },
    setupReadiness() {
      return requestJson({
        baseUrl,
        path: "/setup/readiness",
        headers,
        timeoutMs,
      });
    },
    enhancePrompt(request) {
      return requestJson({
        baseUrl,
        path: "/prompts/enhance",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    enhancePromptLlm(request) {
      return requestJson({
        baseUrl,
        path: "/prompts/enhance-llm",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    chat(request) {
      return requestJson({
        baseUrl,
        path: "/chat",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    ragChat(request) {
      return requestJson({
        baseUrl,
        path: "/chat/rag",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    chatStream(request) {
      return requestSse({
        baseUrl,
        path: "/chat/stream",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    knowledgeRetrieve(request) {
      return requestJson({
        baseUrl,
        path: "/knowledge/retrieve",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    knowledgeLoad(request) {
      return requestJson({
        baseUrl,
        path: "/knowledge/load",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    knowledgeInfraReadiness() {
      return requestJson({
        baseUrl,
        path: "/knowledge/infra/readiness",
        headers,
        timeoutMs,
      });
    },
    modelImportPreview(request) {
      return requestJson({
        baseUrl,
        path: "/models/import/preview",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    modelImportConfirm(request) {
      return requestJson({
        baseUrl,
        path: "/models/import/confirm",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workflowHealth() {
      return requestJson({
        baseUrl,
        path: "/workflow/health",
        headers,
        timeoutMs,
      });
    },
    workflowActions() {
      return requestJson({
        baseUrl,
        path: "/workflow/actions",
        headers,
        timeoutMs,
      });
    },
    workflowPlan(request) {
      return requestJson({
        baseUrl,
        path: "/workflow/plan",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workflowRun(request) {
      return requestJson({
        baseUrl,
        path: "/workflow/run",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workforceHealth() {
      return requestJson({
        baseUrl,
        path: "/workforce/health",
        headers,
        timeoutMs,
      });
    },
    workforceAgents() {
      return requestJson({
        baseUrl,
        path: "/workforce/agents",
        headers,
        timeoutMs,
      });
    },
    workforcePlan(request) {
      return requestJson({
        baseUrl,
        path: "/workforce/plan",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workforcePlanSave(request) {
      return requestJson({
        baseUrl,
        path: "/workforce/plans/save",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workforcePlans() {
      return requestJson({
        baseUrl,
        path: "/workforce/plans",
        headers,
        timeoutMs,
      });
    },
    workforcePlanGet(planId) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}`,
        headers,
        timeoutMs,
      });
    },
    workforcePlanDelete(planId) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}`,
        method: "DELETE",
        headers,
        timeoutMs,
      });
    },
    workforcePlanExport(planId) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/export`,
        headers,
        timeoutMs,
      });
    },
    workforcePlanClarifications(planId, request) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/clarifications`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workforcePlanLifecycle(planId, request) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/lifecycle`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workforcePlanReviewPackage(planId) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/review-package`,
        headers,
        timeoutMs,
      });
    },
    workforcePlanApprovalGate(planId, request) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/approval-gate`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    generate(request) {
      return requestJson({
        baseUrl,
        path: "/gateway/route",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
  };
}

export function createGatewayChatRequest(options) {
  const messages = options.messages ?? createPromptMessages(options.prompt);

  return {
    context: options.context,
    taskType: "chat",
    messages,
    options: options.options ?? {},
    ...(options.promptEnhancement
      ? { promptEnhancement: options.promptEnhancement }
      : {}),
    metadata: options.metadata ?? {},
  };
}

function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    throw new GatewayClientError("Gateway baseUrl is required");
  }

  return baseUrl.trim().replace(/\/+$/, "");
}

function createPromptMessages(prompt) {
  if (typeof prompt !== "string" || prompt.length === 0) {
    throw new GatewayClientError("Gateway chat prompt is required");
  }

  return [
    {
      role: "user",
      content: prompt,
    },
  ];
}

async function requestJsonImpl({
  baseUrl,
  path,
  method = "GET",
  body,
  headers,
  signal,
  timeoutMs,
}) {
  const requestController = createRequestController({ signal, timeoutMs });

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: requestController.signal,
    });
    const responseBody = await readResponseBody(response);

    if (!response.ok) {
      throw createHttpClientError(`Gateway request failed with ${response.status}`, response, responseBody);
    }

    return responseBody;
  } catch (error) {
    if (error instanceof GatewayClientError) {
      throw error;
    }

    throw createTransportClientError("Gateway request failed", error, requestController);
  } finally {
    requestController.cleanup();
  }
}

async function* requestSseImpl({
  baseUrl,
  path,
  method = "GET",
  body,
  headers,
  signal,
  timeoutMs,
}) {
  const requestController = createRequestController({ signal, timeoutMs });

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: requestController.signal,
    });

    if (!response.ok) {
      throw createHttpClientError(
        `Gateway stream request failed with ${response.status}`,
        response,
        await readResponseBody(response),
      );
    }

    if (!response.body) {
      throw new GatewayClientError("Gateway stream returned no response body", {
        statusCode: response.status,
      });
    }

    for await (const event of readSseEvents(response.body)) {
      if (event.event === "error") {
        throw new GatewayClientError("Gateway stream returned an error event", {
          code: readServerError(event.data).code ?? GATEWAY_CLIENT_ERROR_CODES.STREAM,
          kind: "stream",
          retryable: readServerError(event.data).retryable,
          statusCode: response.status,
          responseBody: event.data,
        });
      }

      yield event.data;
    }
  } catch (error) {
    if (error instanceof GatewayClientError) {
      throw error;
    }

    throw createTransportClientError("Gateway stream request failed", error, requestController);
  } finally {
    requestController.cleanup();
  }
}

function createRequestController({ signal, timeoutMs }) {
  const controller = new AbortController();
  let abortSource = null;
  const onCallerAbort = () => {
    if (controller.signal.aborted) return;
    abortSource = "caller";
    controller.abort(signal.reason);
  };

  if (signal?.aborted) {
    onCallerAbort();
  } else {
    signal?.addEventListener("abort", onCallerAbort, { once: true });
  }

  const timeout = controller.signal.aborted ? undefined : setTimeout(() => {
    if (controller.signal.aborted) return;
    abortSource = "timeout";
    const timeoutError = new Error(`Gateway request timed out after ${timeoutMs}ms`);
    timeoutError.name = "TimeoutError";
    controller.abort(timeoutError);
  }, timeoutMs);

  return {
    signal: controller.signal,
    timeoutMs,
    get abortSource() {
      return abortSource;
    },
    cleanup() {
      if (timeout !== undefined) clearTimeout(timeout);
      signal?.removeEventListener("abort", onCallerAbort);
    },
  };
}

function createHttpClientError(message, response, responseBody) {
  const serverError = readServerError(responseBody);
  return new GatewayClientError(message, {
    code: serverError.code ?? GATEWAY_CLIENT_ERROR_CODES.HTTP,
    kind: "http",
    retryable: serverError.retryable,
    statusCode: response.status,
    responseBody,
  });
}

function createTransportClientError(message, error, requestController) {
  if (requestController.abortSource === "caller") {
    return new GatewayClientAbortError(message, {
      cause: error,
      reason: requestController.signal.reason,
    });
  }
  if (requestController.abortSource === "timeout") {
    return new GatewayClientTimeoutError(message, {
      cause: error,
      timeoutMs: requestController.timeoutMs,
    });
  }
  return new GatewayClientError(message, {
    code: GATEWAY_CLIENT_ERROR_CODES.NETWORK,
    kind: "network",
    retryable: false,
    cause: error,
  });
}

function readServerError(responseBody) {
  if (!responseBody || typeof responseBody !== "object") return {};
  const nested = responseBody.error;
  if (nested && typeof nested === "object") {
    return {
      code: typeof nested.code === "string" ? nested.code : undefined,
      retryable: nested.retryable === true,
    };
  }
  return {
    code: typeof responseBody.code === "string" ? responseBody.code : undefined,
    retryable: responseBody.retryable === true,
  };
}

async function* readSseEvents(stream) {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const event = parseSseFrame(frame);

      if (event) {
        yield event;
      }
    }
  }

  const event = parseSseFrame(buffer);

  if (event) {
    yield event;
  }
}

function parseSseFrame(frame) {
  const lines = frame.split(/\r?\n/);
  const event = lines
    .find((line) => line.startsWith("event:"))
    ?.slice("event:".length)
    .trim();
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("\n");

  if (!event || !data) {
    return null;
  }

  return {
    event,
    data: JSON.parse(data),
  };
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new GatewayClientError("Gateway returned invalid JSON", {
      statusCode: response.status,
      responseBody: text,
      cause: error,
    });
  }
}
