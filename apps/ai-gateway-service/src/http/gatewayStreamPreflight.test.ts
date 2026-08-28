import { describe, expect, it, vi } from "vitest";

import {
  closePrimedGatewayStream,
  iteratePrimedGatewayStream,
  primeGatewayStream,
  readPrimedGatewayStreamError,
} from "./gatewayStreamPreflight.ts";

describe("gateway stream preflight", () => {
  it("primes exactly one event and then preserves stream order", async () => {
    const observed: number[] = [];
    async function* stream() {
      for (const value of [1, 2, 3]) {
        observed.push(value);
        yield { type: value === 1 ? "start" : "chunk", value };
      }
    }

    const primed = await primeGatewayStream(stream());
    expect(observed).toEqual([1]);
    const events: Array<Record<string, any>> = [];
    for await (const event of iteratePrimedGatewayStream(primed)) events.push(event);
    expect(events.map((event) => event.value)).toEqual([1, 2, 3]);
  });

  it("extracts a pre-header error and closes the generator", async () => {
    const finalized = vi.fn();
    async function* stream() {
      try {
        yield { type: "error", envelope: { error: { code: "BLOCKED" } } };
      } finally {
        finalized();
      }
    }

    const primed = await primeGatewayStream(stream());
    expect(readPrimedGatewayStreamError(primed)).toEqual({ code: "BLOCKED" });
    await closePrimedGatewayStream(primed);
    expect(finalized).toHaveBeenCalledOnce();
  });

  it("converts a first-iteration throw into a protocol-consumable error event", async () => {
    async function* stream() {
      throw Object.assign(new Error("early failure"), { code: "EARLY_FAILURE" });
    }

    const primed = await primeGatewayStream(stream());
    expect(readPrimedGatewayStreamError(primed)).toMatchObject({ code: "EARLY_FAILURE" });
    const events: Array<Record<string, any>> = [];
    for await (const event of iteratePrimedGatewayStream(primed)) events.push(event);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error" });
  });
});
