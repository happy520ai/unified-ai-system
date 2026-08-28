import { describe, expect, it, vi } from "vitest";

import { executeNormalMode } from "./normalModeExecutor.js";

describe("three-mode provider governance", () => {
  it("routes normal-mode NVIDIA execution through the supplied GatewayService", async () => {
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: true,
        data: {
          message: { role: "assistant", content: "governed normal-mode answer" },
          executionMode: "real",
          usage: { totalTokens: 3 },
        },
        meta: { requestId: "three-mode-1" },
      })),
    };
    const selectedRecord = {
      providerId: "nvidia",
      modelId: "nvidia/normal-model",
      selectable: true,
    };
    const gate = {
      getSelectableRecord: vi.fn(() => selectedRecord),
      assertProviderAllowed: vi.fn(),
    };

    const result = await executeNormalMode({
      request: {
        input: { content: "perform a governed task" },
        modelSelection: { selectedModelId: selectedRecord.modelId },
      },
      application: { gatewayService },
      gate,
      auditTrace: {},
    });

    expect(result).toMatchObject({
      success: true,
      finalAnswer: "governed normal-mode answer",
      auditTrace: { providerCallsMade: true },
    });
    expect(gatewayService.execute).toHaveBeenCalledWith(expect.objectContaining({
      providerId: "nvidia",
      modelId: "nvidia/normal-model",
      metadata: expect.objectContaining({ source: "phase312a-governed-gateway" }),
    }));
  });
});
