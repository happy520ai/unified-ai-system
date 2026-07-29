import { describe, expect, it } from "vitest";
import { extractProviderErrorMessage } from "./httpProviderErrorHelpers.js";
import { createOpenAIAdapter, OpenAIAdapter } from "./openAiAdapter.js";

describe("OpenAI adapter", () => {
  it("uses the unified HTTP provider adapter surface", () => {
    const adapter = createOpenAIAdapter({
      modelId: "test-model",
      dryRun: true,
    });

    expect(adapter).toBeInstanceOf(OpenAIAdapter);
    expect(adapter.descriptor.id).toBe("openai");
    expect(typeof adapter.generate).toBe("function");
    expect(typeof adapter.generateStream).toBe("function");
  });

  it("redacts API keys and bearer tokens in provider messages", () => {
    const message = extractProviderErrorMessage({
      error: {
        message: "failed sk-example123 and Bearer token-example456",
      },
    }, 500);

    expect(message).not.toContain("example123");
    expect(message).not.toContain("example456");
    expect(message.match(/\[REDACTED\]/g)).toHaveLength(2);
  });
});
