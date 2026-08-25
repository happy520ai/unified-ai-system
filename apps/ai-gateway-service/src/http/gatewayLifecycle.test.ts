import { describe, expect, it } from "vitest";
import { createGatewayLifecycle } from "./gatewayLifecycle.ts";

describe("gateway lifecycle", () => {
  it("transitions monotonically from ready to draining to stopped", () => {
    let timestamp = Date.parse("2026-01-01T00:00:00.000Z");
    const lifecycle = createGatewayLifecycle({ now: () => timestamp });

    expect(lifecycle.snapshot()).toMatchObject({ state: "ready", isReady: true, isLive: true });
    timestamp += 1_000;
    expect(lifecycle.beginDrain("SIGTERM")).toMatchObject({
      state: "draining",
      isReady: false,
      isLive: true,
      reason: "SIGTERM",
    });
    timestamp += 1_000;
    expect(lifecycle.markStopped()).toMatchObject({ state: "stopped", isReady: false, isLive: false });
  });

  it("keeps the first drain reason when shutdown is requested repeatedly", () => {
    const lifecycle = createGatewayLifecycle();
    lifecycle.beginDrain("SIGTERM");
    lifecycle.beginDrain("SIGINT");
    lifecycle.markStopped("forced");

    expect(lifecycle.snapshot().reason).toBe("SIGTERM");
  });
});
