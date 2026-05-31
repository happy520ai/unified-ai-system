const DEFAULT_TIMEOUT_MS = 10_000;

export class GatewayClientError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "GatewayClientError";
    this.statusCode = options.statusCode;
    this.responseBody = options.responseBody;
    this.cause = options.cause;
  }
}

export function createGatewayClient(options) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const headers = options.headers ?? {};
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

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
    metadata: options.metadata ?? {},
  };
}

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) {
    throw new GatewayClientError("Gateway baseUrl is required");
  }

  return baseUrl.replace(/\/+$/, "");
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

async function requestJson({ baseUrl, path, method = "GET", body, headers, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const responseBody = await readResponseBody(response);

    if (!response.ok) {
      throw new GatewayClientError(`Gateway request failed with ${response.status}`, {
        statusCode: response.status,
        responseBody,
      });
    }

    return responseBody;
  } catch (error) {
    if (error instanceof GatewayClientError) {
      throw error;
    }

    throw new GatewayClientError("Gateway request failed", { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

async function* requestSse({ baseUrl, path, method = "GET", body, headers, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new GatewayClientError(`Gateway stream request failed with ${response.status}`, {
        statusCode: response.status,
        responseBody: await readResponseBody(response),
      });
    }

    if (!response.body) {
      throw new GatewayClientError("Gateway stream returned no response body", {
        statusCode: response.status,
      });
    }

    for await (const event of readSseEvents(response.body)) {
      if (event.event === "error") {
        throw new GatewayClientError("Gateway stream returned an error event", {
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

    throw new GatewayClientError("Gateway stream request failed", { cause: error });
  } finally {
    clearTimeout(timeout);
  }
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
