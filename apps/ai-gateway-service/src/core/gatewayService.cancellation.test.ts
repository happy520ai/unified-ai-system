import { describe, expect, it, vi } from "vitest";
import {
  EXECUTION_ABORT_CODES,
  abortableSleep,
  createExecutionAbortError,
} from "@unified-ai-system/shared-utils";
import { GatewayService } from "./gatewayService.js";

function createCandidate(provider: any, rank: number) {
  return {
    provider,
    providerType: "fake",
    target: { providerId: `provider-${rank}`, modelId: "model" },
    rank,
    providerPriority: rank,
    modelPriority: rank,
  };
}

function createService(primary: any, fallback: any, healthScorer: any) {
  const candidates = [createCandidate(primary, 1), createCandidate(fallback, 2)];
  return new GatewayService({
    providerRegistry: {
      select: () => ({
        selected: candidates[0],
        candidates,
        fallbackChain: candidates.map((candidate) => candidate.target),
        reasons: [],
        warnings: [],
        metadata: { mode: "test", policy: "test" },
      }),
    },
    runtimeConfig: {
      providerMode: "fake",
      realProviderEnabled: false,
      enabledProviders: ["provider-1", "provider-2"],
      fallbackEnabled: true,
    },
    healthScorer,
  });
}

describe("GatewayService execution cancellation", () => {
  it("propagates cancellation without fallback or health-failure pollution", async () => {
    const controller = new AbortController();
    const primary = {
      generate: vi.fn(async (providerRequest: any) => {
        await abortableSleep(10_000, providerRequest.execution.signal);
      }),
    };
    const fallback = { generate: vi.fn() };
    const healthScorer = { recordSuccess: vi.fn(), recordFailure: vi.fn() };
    const service = createService(primary, fallback, healthScorer);
    const pending = service.execute(
      { messages: [{ role: "user", content: "cancel me" }] },
      { signal: controller.signal },
    );
    const cancellation = createExecutionAbortError(
      EXECUTION_ABORT_CODES.CLIENT_DISCONNECTED,
      "client disconnected",
    );

    controller.abort(cancellation);

    await expect(pending).rejects.toBe(cancellation);
    expect(primary.generate).toHaveBeenCalledTimes(1);
    expect(fallback.generate).not.toHaveBeenCalled();
    expect(healthScorer.recordFailure).not.toHaveBeenCalled();
  });
});
