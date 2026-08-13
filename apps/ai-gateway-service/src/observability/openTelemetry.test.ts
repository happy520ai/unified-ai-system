import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import { createOpenTelemetryRuntime } from "./openTelemetry.js";

describe("OpenTelemetry runtime", () => {
  it("propagates strict W3C context and emits privacy-safe HTTP and GenAI spans", async () => {
    const exporter = new InMemorySpanExporter();
    const runtime = createOpenTelemetryRuntime({
      env: {
        AI_GATEWAY_OTEL_ENABLED: "true",
        AI_GATEWAY_OTEL_SERVICE_NAME: "test-gateway",
        AI_GATEWAY_OTEL_SAMPLE_RATIO: "1",
        NODE_ENV: "test",
      },
      spanExporter: exporter,
    });
    const response = createResponse();
    const request = {
      method: "POST",
      headers: {
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        "user-agent": "otel-test",
      },
    };
    const httpTrace = runtime.startHttpRequest({
      request,
      response,
      url: new URL("http://127.0.0.1:3100/v1/chat/completions"),
    });
    const service = runtime.instrumentGatewayService({
      async execute(input) {
        expect(input.messages[0].content).toBe("private prompt must not be exported");
        return {
          success: true,
          data: {
            id: "response-1",
            selectedProvider: "local-fake-provider",
            selectedModel: "local-fake-model",
            finishReason: "stop",
            usage: { inputTokens: 7, outputTokens: 3 },
            outputText: "private output must not be exported",
          },
          meta: { requestId: "request-1" },
        };
      },
    });

    await httpTrace.run(() => service.execute({
      taskType: "chat",
      model: "local-fake-model",
      messages: [{ role: "user", content: "private prompt must not be exported" }],
      options: { maxOutputTokens: 128, temperature: 0.2 },
    }));
    response.statusCode = 200;
    response.writableEnded = true;
    response.emit("finish");
    await runtime.forceFlush();

    const spans = exporter.getFinishedSpans();
    const httpSpan = spans.find((span) => span.kind === 1);
    const genAiSpan = spans.find((span) => span.attributes["gen_ai.operation.name"] === "chat");
    expect(spans).toHaveLength(2);
    expect(httpSpan.spanContext().traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(httpSpan.parentSpanContext?.spanId).toBe("00f067aa0ba902b7");
    expect(genAiSpan.parentSpanContext?.spanId).toBe(httpSpan.spanContext().spanId);
    expect(genAiSpan.attributes).toMatchObject({
      "gen_ai.request.model": "local-fake-model",
      "gen_ai.response.model": "local-fake-model",
      "gen_ai.provider.name": "local-fake-provider",
      "gen_ai.usage.input_tokens": 7,
      "gen_ai.usage.output_tokens": 3,
    });
    expect(response.headers.traceparent).toMatch(
      /^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/,
    );
    expect(response.headers["x-trace-id"]).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    const exportableFields = spans.map((span) => ({
      name: span.name,
      attributes: span.attributes,
      events: span.events,
      status: span.status,
    }));
    expect(JSON.stringify(exportableFields)).not.toContain("private prompt");
    expect(JSON.stringify(exportableFields)).not.toContain("private output");
    await runtime.shutdown();
  });

  it("ignores invalid all-zero W3C identifiers and creates a new trace", async () => {
    const exporter = new InMemorySpanExporter();
    const runtime = createOpenTelemetryRuntime({
      env: { AI_GATEWAY_OTEL_ENABLED: "true", NODE_ENV: "test" },
      spanExporter: exporter,
      registerGlobal: false,
    });
    const response = createResponse();
    const trace = runtime.startHttpRequest({
      request: {
        method: "GET",
        headers: {
          traceparent: "00-00000000000000000000000000000000-0000000000000000-01",
        },
      },
      response,
      url: new URL("http://127.0.0.1:3100/health/check"),
    });
    response.statusCode = 200;
    response.writableEnded = true;
    response.emit("finish");
    await runtime.forceFlush();

    expect(trace.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(trace.traceId).not.toBe("00000000000000000000000000000000");
    await runtime.shutdown();
  });

  it("rejects credential-bearing OTLP endpoints", () => {
    expect(() => createOpenTelemetryRuntime({
      env: {
        AI_GATEWAY_OTEL_ENABLED: "true",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://user:secret@collector.example/v1/traces",
      },
      registerGlobal: false,
    })).toThrow(/must not contain credentials/);
  });
});

function createResponse() {
  const response = new EventEmitter();
  response.headers = {};
  response.statusCode = 0;
  response.headersSent = false;
  response.writableEnded = false;
  response.setHeader = (name, value) => {
    response.headers[String(name).toLowerCase()] = String(value);
  };
  return response;
}
