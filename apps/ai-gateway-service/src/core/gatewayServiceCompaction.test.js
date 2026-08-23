import { describe, expect, it } from "vitest";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { GatewayService } from "./gatewayService.js";

function buildService(chatContextCompaction) {
  const registry = new ProviderRegistry();
  registry.register(createFakeProvider({
    providerId: "local-fake-provider",
    modelId: "local-fake-model",
    providerType: "fake",
    capabilities: ["chat"],
    enabled: true,
    fixedLatencyMs: 1,
  }));
  return new GatewayService({
    providerRegistry: registry,
    runtimeConfig: {
      providerMode: "fake",
      realProviderEnabled: false,
      fallbackEnabled: false,
      ...(chatContextCompaction ? { chatContextCompaction } : {}),
    },
  });
}

function buildLongHistory(turns) {
  const messages = [{ role: "system", content: "You are a concise assistant." }];
  for (let index = 0; index < turns; index += 1) {
    messages.push({ role: "user", content: `Question number ${index} about topic ${index}` });
    messages.push({ role: "assistant", content: `Answer number ${index} with some detail` });
  }
  messages.push({ role: "user", content: "Summarize what we discussed." });
  return messages;
}

describe("GatewayService chat context compaction", () => {
  it("leaves ordinary conversations untouched by default config absence", async () => {
    const service = buildService();
    const messages = buildLongHistory(5);
    const result = await service.execute({ messages });
    expect(result.success).toBe(true);
    expect(result.data.warnings ?? []).toEqual([]);
  });

  it("compacts long histories over the message threshold and reports a warning", async () => {
    const service = buildService({
      thresholdMessages: 20,
      maxContextTokens: 0,
      keepRecentTurns: 4,
    });
    const messages = buildLongHistory(15);
    const result = await service.execute({ messages });

    expect(result.success).toBe(true);
    const warnings = result.data.warnings ?? [];
    const warning = warnings.find((item) => item.code === "context_compacted");
    expect(warning).toBeTruthy();
    expect(warning.details).toMatchObject({
      originalCount: messages.length,
      summarizedTurns: expect.any(Number),
    });
    expect(warning.details.resultCount).toBeLessThan(messages.length);
    expect(warning.details.retainedSignals).toContain("recent turns verbatim");
  });

  it("compacts by token budget even under the message threshold", async () => {
    const service = buildService({
      thresholdMessages: 0,
      maxContextTokens: 300,
      keepRecentTurns: 3,
    });
    const messages = buildLongHistory(30);
    const result = await service.execute({ messages });

    expect(result.success).toBe(true);
    expect(result.data.warnings.some((warning) => warning.code === "context_compacted")).toBe(true);
  });

  it("never blocks chat when compaction is disabled with zero thresholds", async () => {
    const service = buildService({
      thresholdMessages: 0,
      maxContextTokens: 0,
      keepRecentTurns: 5,
    });
    const messages = buildLongHistory(40);
    const result = await service.execute({ messages });
    expect(result.success).toBe(true);
    expect(result.data.warnings ?? []).toEqual([]);
  });

  it("keeps the system instruction and recent turns verbatim after compaction", async () => {
    const service = buildService({
      thresholdMessages: 12,
      maxContextTokens: 0,
      keepRecentTurns: 2,
    });
    const messages = buildLongHistory(8);
    const result = await service.execute({ messages });

    expect(result.success).toBe(true);
    const warning = result.data.warnings.find((item) => item.code === "context_compacted");
    // system + summary + (Q7, A7) + trailing "Summarize" user turn = 5
    expect(warning.details.resultCount).toBe(5);
  });
});
