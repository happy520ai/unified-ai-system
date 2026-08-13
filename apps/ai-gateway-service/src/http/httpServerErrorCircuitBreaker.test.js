import { describe, it, expect } from "vitest";
import { createGatewayErrorCircuitBreaker } from "./httpServer.js";

describe("createGatewayErrorCircuitBreaker", () => {
  it("opens after repeated failures and recovers after reset timeout", () => {
    let now = 1_000;
    const nowForTest = () => now;

    const circuit = createGatewayErrorCircuitBreaker({
      failureThreshold: 2,
      successThreshold: 2,
      resetTimeoutMs: 10_000,
      halfOpenMaxCalls: 2,
      now: nowForTest,
    });

    expect(circuit.canProcessRequest()).toBe(true);
    expect(circuit.getStateSnapshot().state).toBe("closed");

    expect(circuit.getStateSnapshot()).toMatchObject({ state: "closed", consecutiveFailures: 0 });

    circuit.recordFailure();
    expect(circuit.getStateSnapshot().state).toBe("closed");

    circuit.recordFailure();
    expect(circuit.getStateSnapshot().state).toBe("open");
    expect(circuit.getStateSnapshot().consecutiveFailures).toBe(2);

    expect(circuit.canProcessRequest()).toBe(false);
    expect(circuit.getStateSnapshot().state).toBe("open");

    now += 11_000;
    expect(circuit.canProcessRequest()).toBe(true);
    expect(circuit.getStateSnapshot().state).toBe("half-open");
  });

  it("limits half-open probing to half-open max calls", () => {
    let now = 10;
    const circuit = createGatewayErrorCircuitBreaker({
      failureThreshold: 1,
      successThreshold: 2,
      resetTimeoutMs: 100,
      halfOpenMaxCalls: 2,
      now: () => now,
    });

    circuit.recordFailure();
    expect(circuit.canProcessRequest()).toBe(false);

    now += 200;
    expect(circuit.canProcessRequest()).toBe(true);
    expect(circuit.canProcessRequest()).toBe(true);
    expect(circuit.canProcessRequest()).toBe(false);
    expect(circuit.getStateSnapshot().state).toBe("half-open");
  });

  it("recovers to closed only after enough success probes and keeps failure count growing while closed", () => {
    let now = 20;
    const nowForTest = () => now;
    const circuit = createGatewayErrorCircuitBreaker({
      failureThreshold: 1,
      successThreshold: 2,
      resetTimeoutMs: 100,
      halfOpenMaxCalls: 2,
      now: nowForTest,
    });

    circuit.recordFailure();
    expect(circuit.getStateSnapshot().state).toBe("open");

    now += 200;
    expect(circuit.canProcessRequest()).toBe(true);
    expect(circuit.getStateSnapshot().state).toBe("half-open");

    circuit.recordSuccess();
    expect(circuit.getStateSnapshot().state).toBe("half-open");
    expect(circuit.getStateSnapshot().halfOpenSuccesses).toBe(1);

    expect(circuit.canProcessRequest()).toBe(true);
    circuit.recordSuccess();
    expect(circuit.getStateSnapshot().state).toBe("closed");
    expect(circuit.getStateSnapshot().halfOpenSuccesses).toBe(0);
    expect(circuit.getStateSnapshot().consecutiveFailures).toBe(0);
  });
});
