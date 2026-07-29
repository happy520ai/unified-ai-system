import { describe, it, expect } from "vitest";
import { normalizeGatewayRequest } from "./requestNormalizer.js";

describe("request-normalizer", () => {
  it("normalizes a valid request", () => {
    const result = normalizeGatewayRequest({
      messages: [{ role: "user", content: "hello" }],
    });
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content).toBe("hello");
    expect(result.context.requestId).toBeDefined();
    expect(result.taskType).toBe("chat");
  });

  it("throws for missing messages", () => {
    expect(() => normalizeGatewayRequest({})).toThrow();
  });

  it("throws for empty messages", () => {
    expect(() => normalizeGatewayRequest({ messages: [] })).toThrow();
  });

  it("throws for invalid message", () => {
    expect(() => normalizeGatewayRequest({ messages: [null] })).toThrow();
  });

  it("normalizes task type", () => {
    const result = normalizeGatewayRequest({
      messages: [{ role: "user", content: "hello" }],
      taskType: "reasoning",
    });
    expect(result.taskType).toBe("reasoning");
  });

  it("throws for unsupported task type", () => {
    expect(() => normalizeGatewayRequest({
      messages: [{ role: "user", content: "hello" }],
      taskType: "unsupported",
    })).toThrow();
  });
});
