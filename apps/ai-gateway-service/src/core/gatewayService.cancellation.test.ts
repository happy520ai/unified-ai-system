import { describe, expect, it, vi } from "vitest";
import {
  EXECUTION_ABORT_CODES,
  abortableSleep,
  createExecutionAbortError,
} from "@unified-ai-system/shared-utils";
import { GatewayService } from "./gatewayService.js";

function createCandidate(provider: any, rank: number, providerType = "fake") {
  return {
    provider,
    providerType,
    target: { providerId: `provider-${rank}`, modelId: "model" },
    rank,
    providerPriority: rank,
    modelPriority: rank,
  };
}

function createService(primary: any, fallback: any, healthScorer: any, options: any = {}) {
  const providerType = options.providerType ?? "fake";
  const candidates = [
    createCandidate(primary, 1, providerType),
    createCandidate(fallback, 2, providerType),
  ];
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
    runtimeConfig: options.runtimeConfig ?? {
      providerMode: "fake",
      realProviderEnabled: false,
      enabledProviders: ["provider-1", "provider-2"],
      fallbackEnabled: true,
    },
    healthScorer,
    requestLogger: options.requestLogger ?? null,
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

  it("records an attempted real call with unknown cost when cancellation hides usage", async () => {
    const controller = new AbortController();
    const entries: any[] = [];
    const primary = {
      generate: vi.fn(async (providerRequest: any) => {
        await abortableSleep(10_000, providerRequest.execution.signal);
      }),
    };
    const service = createService(primary, { generate: vi.fn() }, null, {
      providerType: "openai",
      runtimeConfig: {
        providerMode: "real",
        realProviderEnabled: true,
        enabledProviders: ["provider-1"],
        fallbackEnabled: false,
      },
      requestLogger: { log: (entry: any) => entries.push(entry) },
    });
    const pending = service.execute(
      { messages: [{ role: "user", content: "cancel billed call" }] },
      { signal: controller.signal },
    );
    const cancellation = createExecutionAbortError(
      EXECUTION_ABORT_CODES.CLIENT_DISCONNECTED,
      "client disconnected",
    );

    await vi.waitFor(() => expect(primary.generate).toHaveBeenCalledTimes(1));
    controller.abort(cancellation);

    await expect(pending).rejects.toBe(cancellation);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(expect.objectContaining({
      provider: "provider-1",
      providerCallAttempted: true,
      billable: true,
      estimatedCostUsd: 0,
      costSource: "unavailable-after-attempt",
      costEstimateAvailable: false,
    }));
  });
});
