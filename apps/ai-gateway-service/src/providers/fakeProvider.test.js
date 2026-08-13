import { describe, expect, it } from "vitest";
import { createFakeProvider } from "./fakeProvider.js";

describe("fake provider structured responses", () => {
  it("generates deterministic JSON that follows a response schema", async () => {
    const provider = createFakeProvider({
      providerId: "local-fake-provider",
      modelId: "local-fake-model",
      providerType: "fake",
      capabilities: ["chat"],
      enabled: true,
      fixedLatencyMs: 1,
    });
    const responseFormat = {
      type: "json_schema",
      json_schema: {
        name: "GatewayResult",
        schema: {
          type: "object",
          properties: {
            message: { type: "string" },
            count: { type: "integer" },
            ok: { type: "boolean" },
          },
          required: ["message", "count", "ok"],
        },
      },
    };

    const response = await provider.generate({
      target: { providerId: "local-fake-provider", modelId: "local-fake-model" },
      request: {
        messages: [{ role: "user", content: "Structured output test" }],
        options: { responseFormat: "json" },
        metadata: { openAiCompatibility: { responseFormat } },
      },
    });
    const parsed = JSON.parse(response.text);

    expect(parsed).toEqual({
      message: "[fake:local-fake-provider/local-fake-model] Structured output test",
      count: 1,
      ok: true,
    });
    expect(response.message.content).toBe(response.text);
  });

  it("emits a deterministic MCP health tool call only in certification mode", async () => {
    const provider = createFakeProvider({
      providerId: "local-fake-provider",
      modelId: "local-fake-model",
      providerType: "fake",
      capabilities: ["chat"],
      enabled: true,
      fixedLatencyMs: 1,
    }, {
      certificationToolMode: "mcp-health-certification",
    });
    const request = {
      target: { providerId: "local-fake-provider", modelId: "local-fake-model" },
      request: {
        messages: [{
          role: "user",
          content: "Call gateway_health through unified-ai-system, then stop.",
        }],
        tools: [{ type: "function", function: { name: "use_mcp_tool" } }],
      },
    };
    const chunks = [];
    for await (const chunk of provider.generateStream(request)) chunks.push(chunk);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].raw.finishReason).toBe("tool_calls");
    expect(chunks[0].raw.toolCallsDelta[0].function.name).toBe("use_mcp_tool");
    expect(JSON.parse(chunks[0].raw.toolCallsDelta[0].function.arguments)).toEqual({
      server_name: "unified-ai-system",
      tool_name: "gateway_health",
      arguments: {},
    });
  });
});
