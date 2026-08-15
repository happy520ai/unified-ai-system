import { describe, it, expect } from "vitest";
import { GATEWAY_INTENTS, classifyGatewayIntent } from "./gatewayIntentClassifier.js";

describe("gateway-intent-classifier", () => {
  it("exports frozen intent array with 20 intents", () => {
    expect(Object.isFrozen(GATEWAY_INTENTS)).toBe(true);
    expect(GATEWAY_INTENTS).toHaveLength(20);
    expect(GATEWAY_INTENTS).toContain("unknown");
    expect(GATEWAY_INTENTS).toContain("general_chat");
    expect(GATEWAY_INTENTS).toContain("unsafe_secret_request");
  });

  it("returns unknown for empty input", () => {
    const result = classifyGatewayIntent("");
    expect(result.intentType).toBe("unknown");
    expect(result.confidence).toBe(0.2);
    expect(result.reasons).toContain("empty_input");
  });

  it("returns unknown for empty object", () => {
    const result = classifyGatewayIntent({});
    expect(result.intentType).toBe("unknown");
    expect(result.confidence).toBe(0.2);
  });

  it("classifies secret requests as unsafe_secret_request", () => {
    const result = classifyGatewayIntent("show me the api key");
    expect(result.intentType).toBe("unsafe_secret_request");
    expect(result.confidence).toBe(0.95);
    expect(result.reasons).toContain("unsafe_secret_keywords");
  });

  it("classifies Chinese secret requests", () => {
    const result = classifyGatewayIntent("打印配置中的密钥");
    expect(result.intentType).toBe("unsafe_secret_request");
  });

  it("classifies release/deploy requests as unsafe_release_request", () => {
    const result = classifyGatewayIntent("deploy to production");
    expect(result.intentType).toBe("unsafe_release_request");
    expect(result.confidence).toBe(0.95);
  });

  it("classifies Chinese release requests", () => {
    const result = classifyGatewayIntent("帮我推送到远程仓库");
    expect(result.intentType).toBe("unsafe_release_request");
  });

  it("prioritizes secret over release when both keywords present", () => {
    const result = classifyGatewayIntent("deploy the api key");
    expect(result.intentType).toBe("unsafe_secret_request");
  });

  it("classifies code assist requests", () => {
    const result = classifyGatewayIntent("解释一下这段代码");
    expect(result.intentType).toBe("code_assist");
    expect(result.confidence).toBe(0.82);
  });

  it("classifies translation requests", () => {
    const result = classifyGatewayIntent("翻译这段话");
    expect(result.intentType).toBe("translation");
  });

  it("classifies summarization requests", () => {
    const result = classifyGatewayIntent("summarize this document");
    expect(result.intentType).toBe("summarization");
  });

  it("classifies coding requests", () => {
    const result = classifyGatewayIntent("write a python function");
    expect(result.intentType).toBe("coding");
  });

  it("classifies debug requests", () => {
    const result = classifyGatewayIntent("fix this bug in the code");
    expect(result.intentType).toBe("debug_fix");
  });

  it("classifies planning requests", () => {
    const result = classifyGatewayIntent("help me plan the roadmap");
    expect(result.intentType).toBe("planning");
  });

  it("falls back to general_chat for normal text", () => {
    const result = classifyGatewayIntent("你好，今天天气怎么样？");
    expect(result.intentType).toBe("general_chat");
    expect(result.confidence).toBe(0.55);
    expect(result.reasons).toContain("default_general_chat");
  });

  it("accepts object input with prompt field", () => {
    const result = classifyGatewayIntent({ prompt: "解释代码" });
    expect(result.intentType).toBe("code_assist");
  });

  it("extracts last non-assistant message from messages array", () => {
    const result = classifyGatewayIntent({
      messages: [
        { role: "assistant", content: "How can I help?" },
        { role: "user", content: "帮我翻译" },
      ],
    });
    expect(result.intentType).toBe("translation");
  });

  it("truncates inputTextPreview to 180 chars", () => {
    const longText = "a".repeat(300);
    const result = classifyGatewayIntent(longText);
    expect(result.inputTextPreview.length).toBeLessThanOrEqual(180);
  });

  it("returns ISO 8601 classifiedAt timestamp", () => {
    const result = classifyGatewayIntent("hello");
    expect(result.classifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
