import { describe, expect, it, vi } from "vitest";

import { createGatewayBackedNvidiaClient } from "./gatewayBackedNvidiaClient.ts";

describe("gateway-backed NVIDIA legacy facade", () => {
  it("routes chat through GatewayService and maps the governed result", async () => {
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: true,
        data: {
          message: { role: "assistant", content: "governed NVIDIA result" },
          executionMode: "real",
          usage: { totalTokens: 4 },
        },
        meta: { requestId: "request-1" },
      })),
    };
    const client = createGatewayBackedNvidiaClient(gatewayService);

    const result = await client.chatCompletion({
      modelId: "nvidia/test-model",
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 32,
    });

    expect(gatewayService.execute).toHaveBeenCalledWith(expect.objectContaining({
      providerId: "nvidia",
      modelId: "nvidia/test-model",
      metadata: expect.objectContaining({ source: "phase312a-governed-gateway" }),
    }));
    expect(result).toMatchObject({
      success: true,
      data: { text: "governed NVIDIA result", usage: { totalTokens: 4 } },
      meta: { providerCalled: true, realExternalCall: true, requestId: "request-1" },
    });
  });

  it("blocks non-chat legacy sinks without invoking the gateway", async () => {
    const gatewayService = { execute: vi.fn() };
    const client = createGatewayBackedNvidiaClient(gatewayService);

    await expect(client.embeddings({ modelId: "embed-model", input: "hello" })).resolves.toMatchObject({
      success: false,
      code: "GOVERNED_NON_CHAT_PROVIDER_LANE_UNAVAILABLE",
      meta: { providerCalled: false, realExternalCall: false },
    });
    expect(gatewayService.execute).not.toHaveBeenCalled();
  });
});
