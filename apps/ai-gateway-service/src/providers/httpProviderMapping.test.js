import { describe, expect, it } from "vitest";
import { mapGatewayRequestToChatCompletions } from "./httpProviderMapping.js";

describe("HTTP provider request mapping", () => {
  it("forwards a normalized OpenAI response format", () => {
    const responseFormat = {
      type: "json_schema",
      json_schema: {
        name: "GatewayResult",
        schema: { type: "object", properties: { ok: { type: "boolean" } } },
        strict: true,
      },
    };
    const body = mapGatewayRequestToChatCompletions({
      target: { providerId: "openai", modelId: "test-model" },
      request: {
        messages: [{ role: "user", content: "Return JSON" }],
        options: { responseFormat: "json" },
        metadata: { openAiCompatibility: { responseFormat } },
      },
    });

    expect(body.response_format).toEqual(responseFormat);
  });

  it("forwards tools, tool results, selection, and parallel-call policy", () => {
    const tools = [{
      type: "function",
      function: { name: "lookup", parameters: { type: "object" } },
    }];
    const body = mapGatewayRequestToChatCompletions({
      target: { providerId: "openai", modelId: "test-model" },
      request: {
        messages: [{
          role: "assistant",
          content: "",
          toolCalls: [{
            id: "call_1",
            type: "function",
            function: { name: "lookup", arguments: "{}" },
          }],
        }, {
          role: "tool",
          content: "result",
          toolCallId: "call_1",
        }],
        tools,
        toolChoice: "auto",
        parallelToolCalls: false,
        options: {},
      },
    });

    expect(body.tools).toEqual(tools);
    expect(body.tool_choice).toBe("auto");
    expect(body.parallel_tool_calls).toBe(false);
    expect(body.messages[0].tool_calls[0].id).toBe("call_1");
    expect(body.messages[1].tool_call_id).toBe("call_1");
  });
});
