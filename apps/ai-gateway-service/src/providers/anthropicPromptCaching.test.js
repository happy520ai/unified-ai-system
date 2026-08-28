import { describe, expect, it } from "vitest";
import { mapToAnthropicRequest } from "./anthropicAdapter.js";
import { normalizeAnthropicMessageRequest } from "../http/openAiCompatibilityRoutes.js";

const descriptors = [
  {
    id: "local-fake-provider",
    metadata: { providerType: "fake" },
    models: [{ id: "local-fake-model", enabled: true, capabilities: ["chat"] }],
  },
];

describe("Anthropic prompt caching — normalization", () => {
  it("records message-level and system breakpoints into options", () => {
    const gatewayInput = normalizeAnthropicMessageRequest({
      model: "local-fake-model",
      max_tokens: 64,
      system: [{ type: "text", text: "You are terse.", cache_control: { type: "ephemeral" } }],
      messages: [
        { role: "user", content: [{ type: "text", text: "hello", cache_control: { type: "ephemeral" } }] },
        { role: "assistant", content: "hi" },
      ],
    }, descriptors);

    expect(gatewayInput.options.anthropicCacheControl).toEqual({
      systemBreakpoint: true,
      messageIndexes: [0],
    });
    // system 作为首条 system 消息进入内部序列。
    expect(gatewayInput.messages[0]).toEqual({ role: "system", content: "You are terse." });
  });

  it("omits the cache option when no breakpoints are present", () => {
    const gatewayInput = normalizeAnthropicMessageRequest({
      model: "local-fake-model",
      max_tokens: 64,
      messages: [{ role: "user", content: "plain" }],
    }, descriptors);
    expect(gatewayInput.options.anthropicCacheControl).toBeUndefined();
  });

  it("rejects non-ephemeral cache_control and more than 4 breakpoints", () => {
    expect(() => normalizeAnthropicMessageRequest({
      model: "local-fake-model",
      max_tokens: 64,
      messages: [{
        role: "user",
        content: [{ type: "text", text: "x", cache_control: { type: "1h" } }],
      }],
    }, descriptors)).toThrowError(/ephemeral/);

    expect(() => normalizeAnthropicMessageRequest({
      model: "local-fake-model",
      max_tokens: 64,
      messages: [
        { role: "user", content: [{ type: "text", text: "1", cache_control: { type: "ephemeral" } }] },
        { role: "assistant", content: "a" },
        { role: "user", content: [{ type: "text", text: "2", cache_control: { type: "ephemeral" } }] },
        { role: "assistant", content: "b" },
        { role: "user", content: [{ type: "text", text: "3", cache_control: { type: "ephemeral" } }] },
        { role: "assistant", content: "c" },
        { role: "user", content: [{ type: "text", text: "4", cache_control: { type: "ephemeral" } }] },
        { role: "assistant", content: "d" },
        { role: "user", content: [{ type: "text", text: "5", cache_control: { type: "ephemeral" } }] },
      ],
    }, descriptors)).toThrowError(/at most 4/i);
  });
});

describe("Anthropic prompt caching — wire re-attachment", () => {
  it("re-attaches ephemeral breakpoints to the final block of flagged messages and system", () => {
    const body = mapToAnthropicRequest({
      messages: [
        { role: "system", content: "You are terse." },
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
        { role: "user", content: "and now with tools" },
      ],
      options: {
        maxOutputTokens: 64,
        anthropicCacheControl: {
          systemBreakpoint: true,
          messageIndexes: [0, 2],
        },
      },
    }, "claude-x");

    expect(body.system).toEqual([
      { type: "text", text: "You are terse.", cache_control: { type: "ephemeral" } },
    ]);
    // non-system index 0 = "hello"
    expect(body.messages[0].content).toEqual([
      { type: "text", text: "hello", cache_control: { type: "ephemeral" } },
    ]);
    // non-system index 1 = "hi"(无断点,保持字符串)
    expect(body.messages[1].content).toBe("hi");
    // non-system index 2 = "and now with tools"
    expect(body.messages[2].content).toEqual([
      { type: "text", text: "and now with tools", cache_control: { type: "ephemeral" } },
    ]);
  });

  it("keeps the original wire shape without breakpoints", () => {
    const body = mapToAnthropicRequest({
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hello" },
      ],
      options: { maxOutputTokens: 64 },
    }, "claude-x");
    expect(body.system).toBe("sys");
    expect(body.messages[0].content).toBe("hello");
  });
});
