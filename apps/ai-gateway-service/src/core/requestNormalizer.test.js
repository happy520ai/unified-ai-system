import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeGatewayRequest } from "./requestNormalizer.js";

describe("request-normalizer", () => {
  it("normalizes a valid request", () => {
    const result = normalizeGatewayRequest({
      messages: [{ role: "user", content: "hello" }],
    });
    assert.equal(result.messages.length, 1);
    assert.equal(result.messages[0].role, "user");
    assert.equal(result.messages[0].content, "hello");
    assert.ok(result.context.requestId !== undefined);
    assert.equal(result.taskType, "chat");
  });

  it("throws for missing messages", () => {
    assert.throws(() => normalizeGatewayRequest({}));
  });

  it("throws for empty messages", () => {
    assert.throws(() => normalizeGatewayRequest({ messages: [] }));
  });

  it("throws for invalid message", () => {
    assert.throws(() => normalizeGatewayRequest({ messages: [null] }));
  });

  it("normalizes task type", () => {
    const result = normalizeGatewayRequest({
      messages: [{ role: "user", content: "hello" }],
      taskType: "reasoning",
    });
    assert.equal(result.taskType, "reasoning");
  });

  it("throws for unsupported task type", () => {
    assert.throws(() => normalizeGatewayRequest({
      messages: [{ role: "user", content: "hello" }],
      taskType: "unsupported",
    }));
  });
});
