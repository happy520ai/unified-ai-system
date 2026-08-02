import { describe, expect, it } from "vitest";
import { normalizeChatBody } from "./chatUtils.js";

const config = {
  aiGatewayService: {
    providerSelection: {
      mode: "fixed",
      defaultProviderId: "local-fake-provider",
      defaultModelId: "local-fake-model",
    },
    providerModels: [],
  },
};

describe("chat prompt enhancement", () => {
  it("preserves the existing chat message when enhancement is absent", () => {
    const body = {
      messages: [{ role: "user", content: "hello gateway" }],
      metadata: { caller: "test" },
    };
    const result = normalizeChatBody(body, config);

    expect(result.messages).toBe(body.messages);
    expect(result.messages[0].content).toBe("hello gateway");
    expect(result.metadata).toEqual({ caller: "test" });
  });

  it("preserves the existing chat message when enhancement is disabled", () => {
    const body = {
      messages: [{ role: "user", content: "hello gateway" }],
      promptEnhancement: { enabled: false, profile: "coding" },
    };
    const result = normalizeChatBody(body, config);

    expect(result.messages[0].content).toBe("hello gateway");
    expect(result.metadata.promptEnhancement).toBeUndefined();
  });

  it("enhances only the latest user message after explicit opt-in", () => {
    const body = {
      messages: [
        { role: "user", content: "Earlier context" },
        { role: "assistant", content: "Earlier answer" },
        { role: "user", content: "Build a Node API with tests" },
      ],
      promptEnhancement: { enabled: true, profile: "coding" },
    };
    const result = normalizeChatBody(body, config);

    expect(result.messages[0].content).toBe("Earlier context");
    expect(result.messages[1].content).toBe("Earlier answer");
    expect(result.messages[2].content).toContain("Build a Node API with tests");
    expect(result.messages[2].content).toContain("# Execution requirements");
    expect(result.metadata.promptEnhancement).toMatchObject({
      applied: true,
      profile: "coding",
      language: "en",
      providerCalled: false,
      originalPreserved: true,
    });
  });

  it("rejects invalid opt-in profiles instead of silently changing behavior", () => {
    expect(() => normalizeChatBody({
      prompt: "hello",
      promptEnhancement: { enabled: true, profile: "unsupported" },
    }, config)).toThrowError(/Unsupported prompt enhancement profile/);
  });
});
