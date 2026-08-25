import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import {
  EXECUTION_ABORT_CODES,
  createExecutionAbortError,
  type ExecutionAbortError,
} from "@unified-ai-system/shared-utils";

export interface GatewayExecutionContext {
  signal: AbortSignal;
  timeoutMs: number;
  deadlineAt: number;
  providerDispatchKeyHash?: string;
  providerDispatchKeyInvalid?: boolean;
  providerDispatchRoute?: string;
  providerDispatchInvocation?: number;
  transportRequestId?: string;
  transportTraceId?: string;
}

interface RequestExecutionScopeOptions {
  request: IncomingMessage;
  response: ServerResponse;
  timeoutMs: number;
  now?: () => number;
  onClientDisconnect?: (error: ExecutionAbortError) => void;
  onDeadline?: (error: ExecutionAbortError) => void;
}

export interface HttpRequestExecutionScope {
  context: GatewayExecutionContext;
  cleanup(): void;
}

export function createHttpRequestExecutionScope(
  options: RequestExecutionScopeOptions,
): HttpRequestExecutionScope {
  const now = options.now ?? Date.now;
  const timeoutMs = Math.max(1, Math.floor(options.timeoutMs));
  const controller = new AbortController();
  let cleaned = false;

  const abortOnce = (error: ExecutionAbortError, callback?: (error: ExecutionAbortError) => void) => {
    if (controller.signal.aborted) return;
    controller.abort(error);
    callback?.(error);
  };
  const onRequestAborted = () => abortOnce(createClientDisconnectedError("request-aborted"), options.onClientDisconnect);
  const onResponseClose = () => {
    if (!options.response.writableFinished) {
      abortOnce(createClientDisconnectedError("response-closed"), options.onClientDisconnect);
    }
    cleanup();
  };
  const onResponseFinish = () => cleanup();
  const timeoutId = setTimeout(() => {
    abortOnce(createExecutionAbortError(
      EXECUTION_ABORT_CODES.GATEWAY_DEADLINE_EXCEEDED,
      `Gateway execution deadline exceeded after ${timeoutMs}ms.`,
      {
        category: "timeout",
        retryable: false,
        statusCode: 504,
        details: { timeoutMs },
      },
    ), options.onDeadline);
  }, timeoutMs);
  timeoutId.unref?.();

  options.request.once("aborted", onRequestAborted);
  options.response.once("close", onResponseClose);
  options.response.once("finish", onResponseFinish);

  const context = Object.freeze({
    signal: controller.signal,
    timeoutMs,
    deadlineAt: now() + timeoutMs,
    ...readTransportContext(options.request),
    ...readProviderDispatchContext(options.request),
  });

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    clearTimeout(timeoutId);
    options.request.off("aborted", onRequestAborted);
    options.response.off("close", onResponseClose);
    options.response.off("finish", onResponseFinish);
  }

  return { context, cleanup };
}

export function bindGatewayExecution<TService extends object>(
  gatewayService: TService,
  execution: GatewayExecutionContext,
  identityProvider?: () => unknown,
): TService {
  let providerDispatchInvocation = 0;
  return new Proxy(gatewayService, {
    get(target, property, receiver) {
      if (property === "execute" || property === "executeStream" || property === "executeProviderOperation") {
        const operation = Reflect.get(target, property, receiver);
        if (typeof operation !== "function") return operation;
        return (input: unknown) => {
          const boundExecution = execution.providerDispatchKeyHash
            || execution.providerDispatchKeyInvalid
            ? Object.freeze({
                ...execution,
                providerDispatchInvocation: ++providerDispatchInvocation,
              })
            : execution;
          return Reflect.apply(
            operation,
            target,
            [withServerIdentity(input, identityProvider?.()), boundExecution],
          );
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function readProviderDispatchContext(request: IncomingMessage) {
  const rawKey = request.headers?.["idempotency-key"];
  const route = String(request.url ?? "/").split("?", 1)[0] || "/";
  if (rawKey === undefined) return { providerDispatchRoute: route };
  if (
    typeof rawKey !== "string"
    || rawKey.length < 1
    || rawKey.length > 255
    || !/^[\x21-\x7e]+$/u.test(rawKey)
  ) {
    return {
      providerDispatchKeyInvalid: true,
      providerDispatchRoute: route,
    };
  }
  return {
    providerDispatchKeyHash: createHash("sha256").update(rawKey, "utf8").digest("hex"),
    providerDispatchRoute: route,
  };
}

function readTransportContext(request: IncomingMessage) {
  const requestId = request.headers?.["x-request-id"];
  const traceId = request.headers?.["x-trace-id"];
  return {
    ...(typeof requestId === "string" && requestId ? { transportRequestId: requestId } : {}),
    ...(typeof traceId === "string" && traceId ? { transportTraceId: traceId } : {}),
  };
}

// The gateway usage ledger attributes records per tenant from the request's
// enterprise identity. Route handlers build gateway inputs from client bodies,
// so without this stamp every record collapses to the "default" tenant (and a
// client could spoof attribution via a body field). The provider resolves the
// identity lazily at execute time, after authorization has attached it.
function withServerIdentity(input: unknown, identity: unknown): unknown {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return input;
  const record = input as Record<string, unknown>;
  try {
    if (identity && typeof identity === "object") {
      record.enterpriseIdentity = identity;
    } else {
      delete record.enterpriseIdentity;
    }
  } catch {
    // Frozen inputs keep their original attribution; the ledger then falls
    // back to its conservative default rather than trusting client data.
  }
  return record;
}

function createClientDisconnectedError(phase: string): ExecutionAbortError {
  return createExecutionAbortError(
    EXECUTION_ABORT_CODES.CLIENT_DISCONNECTED,
    "Client disconnected before gateway execution completed.",
    {
      category: "cancellation",
      retryable: false,
      statusCode: 499,
      details: { phase },
    },
  );
}
