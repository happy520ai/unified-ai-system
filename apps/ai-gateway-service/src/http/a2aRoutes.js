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
import { A2A_AGENT_CARD_PATH, A2A_JSONRPC_PATH } from "./a2aGateway.js";
import { readJson } from "./utils/responseUtils.js";

function writeA2AJson(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "content-type": `${A2A_CONTENT_TYPE}; charset=utf-8`,
    [A2A_VERSION_HEADER]: A2A_PROTOCOL_VERSION,
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
  } = context;

  if (request.method === "GET" && url.pathname === A2A_AGENT_CARD_PATH) {
    writeA2AJson(response, 200, a2aGateway.agentCardJson, {
      "cache-control": "public, max-age=300",
    });
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

  // 未带版本头的请求按网关自身协议版本处理（agentCard 为 1.0）。
  const requestedVersion = request.headers[A2A_VERSION_HEADER.toLowerCase()] ?? A2A_PROTOCOL_VERSION;
  const serverContext = new ServerCallContext({
    requestedVersion: String(requestedVersion),
    user: requestUser(request),
    tenant: request.enterpriseIdentity?.tenantId ?? "default",
    state: new Map([["headers", request.headers]]),
  });
  let result;
  try {
    validateVersion(serverContext.requestedVersion, a2aGateway.agentCard, "JSONRPC");
    result = await a2aGateway.transportHandler.handle(body, serverContext);
  } catch (error) {
    result = {
      jsonrpc: "2.0",
      id: body?.id ?? null,
      error: JsonRpcTransportHandler.mapToJSONRPCError(error),
    };
  }

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
