import type { IncomingMessage, ServerResponse } from "node:http";
import {
  EXECUTION_ABORT_CODES,
  createExecutionAbortError,
  type ExecutionAbortError,
} from "@unified-ai-system/shared-utils";

export interface GatewayExecutionContext {
  signal: AbortSignal;
  timeoutMs: number;
  deadlineAt: number;
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
): TService {
  return new Proxy(gatewayService, {
    get(target, property, receiver) {
      if (property === "execute" || property === "executeStream") {
        const operation = Reflect.get(target, property, receiver);
        return (input: unknown) => operation.call(target, input, execution);
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
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
