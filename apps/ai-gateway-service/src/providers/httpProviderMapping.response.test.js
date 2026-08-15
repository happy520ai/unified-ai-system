import { describe, expect, it } from "vitest";
import {
  mapChatCompletionsResponseToProviderResponse,
  mapGatewayRequestToChatCompletions,
} from "./httpProviderMapping.js";

function providerRequest(overrides = {}) {
  return {
    target: { providerId: "test", modelId: "test-model" },
    ...overrides,
  };
}

describe("HTTP provider response mapping", () => {
  it("maps usage, content and latency into a provider response", () => {
    const response = mapChatCompletionsResponseToProviderResponse({
      id: "chatcmpl-1",
      model: "test-model",
      choices: [{ message: { role: "assistant", content: "hi there" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }, {
      providerRequest: providerRequest(),
      latencyMs: 42,
    });

    expect(response.text).toBe("hi there");
    expect(response.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    expect(response.latencyMs).toBe(42);
    expect(response.executionStatus).toBe("success");
    expect(response.message).toEqual({ role: "assistant", content: "hi there" });
  });

  it("falls back to a placeholder on empty content", () => {
    const response = mapChatCompletionsResponseToProviderResponse({
      choices: [{ message: { role: "assistant", content: "" } }],
      usage: {},
    }, { providerRequest: providerRequest() });

    expect(response.text).toBe("[test:test-model] empty response");
  });

  it("uses zero usage when usage is absent", () => {
    const response = mapChatCompletionsResponseToProviderResponse({
      choices: [{ message: { role: "assistant", content: "ok" } }],
    }, { providerRequest: providerRequest() });

    expect(response.usage).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it("parses tool calls with JSON arguments", () => {
    const response = mapChatCompletionsResponseToProviderResponse({
      choices: [{
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "call_1",
            type: "function",
            function: { name: "lookup", arguments: '{"q":"x"}' },
          }],
        },
      }],
      usage: {},
    }, { providerRequest: providerRequest() });

    expect(response.toolCalls).toEqual([{
      id: "call_1",
      type: "function",
      name: "lookup",
      arguments: { q: "x" },
    }]);
  });
});

describe("HTTP provider request mapping — tokens and roles", () => {
  it("maps max_tokens, temperature and filters unsupported roles", () => {
    const body = mapGatewayRequestToChatCompletions({
      target: { providerId: "openai", modelId: "m" },
      request: {
        messages: [
          { role: "system", content: "sys" },
          { role: "user", content: "hi" },
          { role: "bogus", content: "drop me" },
        ],
        options: { maxOutputTokens: 512, temperature: 0.3 },
      },
    });

    expect(body.max_tokens).toBe(512);
    expect(body.temperature).toBe(0.3);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(body.stream).toBe(false);
  });

  it("adds mimo-specific max_completion_tokens and thinking field", () => {
    const body = mapGatewayRequestToChatCompletions({
      target: { providerId: "mimo", modelId: "mimo-1" },
      request: {
        messages: [{ role: "user", content: "hi" }],
        options: { maxOutputTokens: 256 },
      },
    });

    expect(body.max_completion_tokens).toBe(256);
    expect(body.thinking).toEqual({ type: "disabled" });
  });
});
