import { createGatewayChatRequest, createGatewayClient } from "../../../packages/shared-sdk/src/index.js";

const gatewayServiceUrl =
  process.env.AI_GATEWAY_SERVICE_URL ?? "http://127.0.0.1:3100";
const timeoutMs = Number(process.env.AI_GATEWAY_CONSOLE_TIMEOUT_MS ?? 30_000);
const streamEnabled = process.env.AI_GATEWAY_CONSOLE_STREAM === "true";
const phase = streamEnabled ? "phase-8a-streaming-chain" : "phase-7a-2-console-service-chain";
const prompt =
  process.env.AI_GATEWAY_CONSOLE_PROMPT ??
  "Phase 7A-2 agent-console to ai-gateway-service minimal chain ping. Reply with a short confirmation.";

const client = createGatewayClient({
  baseUrl: gatewayServiceUrl,
  timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 30_000,
});

const request = createGatewayChatRequest({
  context: {
    requestId: streamEnabled ? "agent-console-phase-8a-stream-chain" : "agent-console-phase-7a-2-service-chain",
    traceId: streamEnabled ? "phase-8a-console-service-nvidia-stream" : "phase-7a-2-console-service",
  },
  prompt,
  options: {
    temperature: 0,
    maxOutputTokens: 64,
  },
  metadata: {
    caller: "agent-console",
    phase,
  },
});

try {
  const health = await client.health();

  if (streamEnabled) {
    const stream = await runStreamingChat(client, request);

    console.log(
      JSON.stringify(
        {
          app: "agent-console",
          status: stream.doneReceived ? "completed" : "failed",
          phase,
          mode: "stream",
          gatewayServiceUrl,
          health: health.data,
          stream,
          error: null,
        },
        null,
        2,
      ),
    );

    if (!stream.doneReceived) {
      process.exitCode = 1;
    }
  } else {
    const response = await client.chat(request);

    console.log(
      JSON.stringify(
        {
          app: "agent-console",
          status: response.success ? "completed" : "failed",
          phase,
          gatewayServiceUrl,
          health: health.data,
          gateway: response.data,
          error: response.error,
        },
        null,
        2,
      ),
    );

    if (!response.success) {
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(
    JSON.stringify(
      {
        app: "agent-console",
        status: "failed",
        phase,
        gatewayServiceUrl,
        error: summarizeConsoleError(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}

async function runStreamingChat(client, request) {
  const chunks = [];
  let doneEvent = null;

  for await (const event of client.chatStream(request)) {
    if (event.type === "chunk" && event.textDelta) {
      chunks.push(event.textDelta);
    }

    if (event.type === "done") {
      doneEvent = event;
    }
  }

  return {
    chunkCount: chunks.length,
    chunks,
    outputText: doneEvent?.outputText ?? chunks.join(""),
    doneReceived: Boolean(doneEvent),
    selectedProvider: doneEvent?.selectedProvider ?? null,
    selectedModel: doneEvent?.selectedModel ?? null,
    executionMode: doneEvent?.executionMode ?? null,
    executionStatus: doneEvent?.executionStatus ?? null,
  };
}

function summarizeConsoleError(error) {
  if (!error || typeof error !== "object") {
    return {
      message: String(error),
    };
  }

  const responseBody = error.responseBody;

  return {
    message: error instanceof Error ? error.message : String(error),
    statusCode: error.statusCode,
    service: responseBody
      ? {
          success: responseBody.success,
          code: responseBody.code ?? responseBody.error?.code,
          message: responseBody.message ?? responseBody.error?.message,
          error: responseBody.error
            ? {
                code: responseBody.error.code,
                type: responseBody.error.type,
                message: responseBody.error.message,
                retryable: responseBody.error.retryable,
                provider: responseBody.error.provider,
                model: responseBody.error.model,
              }
            : undefined,
        }
      : undefined,
  };
}
