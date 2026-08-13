export function createProviderRequest({ request, target }) {
  return {
    request,
    target,
    trace: {
      requestId: request.context.requestId,
      traceId: request.context.traceId,
    },
  };
}

export function createProviderResponse({
  text,
  message,
  usage,
  latencyMs,
  executionStatus = "success",
  warnings = [],
  toolCalls,
  raw,
}) {
  return {
    text,
    message,
    usage,
    latencyMs,
    executionStatus,
    warnings,
    ...(Array.isArray(toolCalls) ? { toolCalls } : {}),
    raw,
  };
}
