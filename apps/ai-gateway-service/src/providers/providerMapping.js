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
  toolCalls = null,
  usage,
  latencyMs,
  executionStatus = "success",
  warnings = [],
  raw,
}) {
  return {
    text,
    message,
    toolCalls,
    usage,
    latencyMs,
    executionStatus,
    warnings,
    raw,
  };
}
