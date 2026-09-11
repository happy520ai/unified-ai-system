import {
  A2A_CONTENT_TYPE,
  A2A_PROTOCOL_VERSION,
  A2A_VERSION_HEADER,
} from "@a2a-js/sdk";
import {
  ServerCallContext,
  UnauthenticatedUser,
  JsonRpcTransportHandler,
  validateVersion,
} from "@a2a-js/sdk/server";
import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import {
  A2A_AGENT_CARD_PATH,
  A2A_JSONRPC_PATH,
  A2A_JWKS_PATH,
} from "./a2aGateway.js";
import { readJson } from "./utils/responseUtils.js";
import { bindA2AGatewayCall, releaseA2AGatewayCall } from "./a2aGatewayExecution.ts";
import { authenticateManagedLocalClientProtocolRequest, resolveManagedLocalClientProviderRoute, applyManagedLocalClientProviderRoute } from "./openAiCompatibilityRoutes.js";
import { createExecutionAbortError, EXECUTION_ABORT_CODES, throwIfExecutionAborted } from "@unified-ai-system/shared-utils";

function writeA2AJson(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "content-type": `${A2A_CONTENT_TYPE}; charset=utf-8`,
    [A2A_VERSION_HEADER]: A2A_PROTOCOL_VERSION,
    ...headers,
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function writeJson(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function requestUser(request) {
  const identity = request.enterpriseIdentity;
  if (!identity) return new UnauthenticatedUser();
  const userName = identity.subject ?? identity.userId ?? identity.id ?? "authenticated-user";
  return {
    get isAuthenticated() {
      return true;
    },
    get userName() {
      return String(userName);
    },
    permissions: Array.isArray(identity.permissions) ? [...identity.permissions] : [],
  };
}

export async function dispatchA2ARoutes(context) {
  const {
    a2aGateway,
    request,
    response,
    url,
    writeServiceLog,
    startedAt,
    requestExecution,
    application,
  } = context;

  if (request.method === "GET" && url.pathname === A2A_JWKS_PATH) {
    if (!a2aGateway.agentCardSigning?.configured || !a2aGateway.agentCardJwks) {
      writeJson(response, 404, {
        error: "a2a_agent_card_signing_not_configured",
      }, {
        "cache-control": "no-store",
      });
      return;
    }
    writeJson(response, 200, a2aGateway.agentCardJwks, {
      "cache-control": "public, max-age=300",
    });
    return;
  }
  if (request.method === "GET" && url.pathname === A2A_AGENT_CARD_PATH) {
    try {
      const agentCardJson = await a2aGateway.getAgentCardJson();
      writeA2AJson(response, 200, agentCardJson, {
        "cache-control": "public, max-age=300",
      });
    } catch {
      writeServiceLog?.("a2a_agent_card_signing_failed", {
        method: request.method,
        path: url.pathname,
        durationMs: Date.now() - startedAt,
      });
      writeA2AJson(response, 503, {
        error: "a2a_agent_card_signing_failed",
      }, {
        "cache-control": "no-store",
      });
    }
    return;
  }
  if (request.method !== "POST" || url.pathname !== A2A_JSONRPC_PATH) {
    return ROUTE_NOT_HANDLED;
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    writeA2AJson(response, 400, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
    return;
  }

  let identity = request.enterpriseIdentity;
  let managedCall;
  const clientId = body?.params?.metadata?.unifiedAi?.localClientId;
  const serverBinding = application?.localClientProtocolPrincipalResolver?.resolve?.(identity);
  if (serverBinding || identity?.role === "local_client" || identity?.managedClientId
    || clientId !== undefined || request.headers?.["x-ai-gateway-local-client-proof"] !== undefined) {
    try {
      assertManagedA2AMethod(body);
      if (!serverBinding || identity?.role !== "local_client") throw Object.assign(new Error("Managed A2A principal is not authorized."), {
        code: "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED", statusCode: 401,
      });
      const principal = await authenticateManagedLocalClientProtocolRequest({ application, request, url,
        requestBody: { unified_ai: { local_client_id: clientId } } });
      if (!principal) throw Object.assign(new Error("Managed A2A principal is not authorized."), { code: "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED", statusCode: 401 });
      throwIfExecutionAborted(requestExecution?.signal);
      if (Math.min(requestExecution?.deadlineAt ?? Infinity, principal.expiresAtMs) <= Date.now()) {
        throw createExecutionAbortError(EXECUTION_ABORT_CODES.GATEWAY_DEADLINE_EXCEEDED, "Managed A2A admission expired.", { retryable: false });
      }
      identity = Object.freeze({ ...identity, tenantId: principal.identity.tenantId, userId: principal.identity.subjectId,
        subject: principal.identity.subjectId, managedClientId: principal.identity.clientId });
      managedCall = Object.freeze({ expiresAtMs: principal.expiresAtMs,
        prepareGatewayInput: async (input, signal) => {
          const route = await resolveManagedLocalClientProviderRoute({ application, principal, gatewayInput: input });
          throwIfExecutionAborted(signal);
          response.setHeader("X-AI-Gateway-Local-Client-Routing", "policy-pinned");
          response.setHeader("X-AI-Gateway-Local-Client-Policy-Revision", route.policyRevision);
          response.setHeader("X-AI-Gateway-Local-Client-Revision", String(principal.identity.clientRevision));
          response.setHeader("X-AI-Gateway-Local-Client-Decision-Digest", route.decisionDigest);
          return applyManagedLocalClientProviderRoute(input, route);
        },
      });
    } catch (error) {
      writeA2AJson(response, error.statusCode ?? error.status ?? 403, { jsonrpc: "2.0",
        id: typeof body?.id === "string" || typeof body?.id === "number" ? body.id : null,
        error: { code: -32001, message: "Managed A2A request authorization failed.", data: { code: error.code ?? "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED" } } });
      return;
    }
  }

  // 未带版本头的请求按网关自身协议版本处理（agentCard 为 1.0）。
  const requestedVersion = request.headers[A2A_VERSION_HEADER.toLowerCase()] ?? A2A_PROTOCOL_VERSION;
  const serverContext = new ServerCallContext({
    requestedVersion: String(requestedVersion),
    user: requestUser({ enterpriseIdentity: identity }),
    tenant: identity?.tenantId ?? "default",
    state: new Map([["headers", request.headers]]),
  });
  let result;
  try {
    bindA2AGatewayCall(serverContext, identity, requestExecution, managedCall);
    validateVersion(serverContext.requestedVersion, a2aGateway.agentCard, "JSONRPC");
    result = await a2aGateway.transportHandler.handle(body, serverContext);
  } catch (error) {
    result = {
      jsonrpc: "2.0",
      id: body?.id ?? null,
      error: JsonRpcTransportHandler.mapToJSONRPCError(error),
    };
  } finally { releaseA2AGatewayCall(serverContext); }

  if (result && typeof result[Symbol.asyncIterator] === "function") {
    // A2A 流式：JSON-RPC 响应按规范作为 SSE data 事件透传（content-type
    // text/event-stream + A2A 版本头），流结束即响应结束。
    let clientClosed = false;
    response.on("close", () => {
      clientClosed = true;
    });
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      "connection": "keep-alive",
      [A2A_VERSION_HEADER]: A2A_PROTOCOL_VERSION,
    });
    let eventCount = 0;
    for await (const update of result) {
      if (clientClosed) break;
      if (update === undefined || update === null) continue;
      response.write(`data: ${JSON.stringify(update)}\n\n`);
      eventCount += 1;
    }
    writeServiceLog?.("a2a_stream_completed", {
      method: request.method,
      path: url.pathname,
      operation: body?.method,
      eventCount,
      durationMs: Date.now() - startedAt,
    });
    if (!clientClosed) {
      response.end();
    }
    return;
  }
  writeServiceLog?.("a2a_request_completed", {
    method: request.method,
    path: url.pathname,
    operation: body?.method,
    success: !result?.error,
    durationMs: Date.now() - startedAt,
  });
  writeA2AJson(response, 200, result);
}

function assertManagedA2AMethod(body) {
  const params = body?.params;
  const configuration = params?.configuration;
  const executionMode = params?.metadata?.unifiedAi?.executionMode;
  if (!body || Array.isArray(body) || body.jsonrpc !== "2.0" || body.method !== "SendMessage"
    || !params || typeof params !== "object" || Array.isArray(params)
    || (configuration !== undefined && (!configuration || typeof configuration !== "object" || Array.isArray(configuration)
      || (configuration.returnImmediately !== undefined && configuration.returnImmediately !== false)))
    || (executionMode !== undefined && executionMode !== "fake-provider")) {
    throw Object.assign(new Error("Managed A2A permits blocking SendMessage fake chat only."), {
      code: "LOCAL_CLIENT_A2A_METHOD_UNSUPPORTED", statusCode: 403,
    });
  }
}
