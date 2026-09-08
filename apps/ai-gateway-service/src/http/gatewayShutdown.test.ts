import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createGatewayLifecycle } from "./gatewayLifecycle.ts";
import { bindManagedGatewayParent, createGatewayShutdownController, readBoundedDuration } from "./gatewayShutdown.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("gateway shutdown controller", () => {
  it("drains a managed gateway when its owner's IPC connection closes", () => {
    const parent = Object.assign(new EventEmitter(), { connected: true });
    const shutdown = vi.fn(() => true);
    expect(bindManagedGatewayParent(parent, { shutdown })).toBe(true);
    parent.emit("disconnect");
    parent.emit("disconnect");
    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(shutdown).toHaveBeenCalledWith("managed_parent_disconnected", 0);
  });

  it("prevents a managed listener from starting after an early or missing IPC owner", () => {
    for (const connected of [false, undefined]) {
      const parent = Object.assign(new EventEmitter(), { connected });
      const shutdown = vi.fn(() => true);
      expect(bindManagedGatewayParent(parent, { shutdown })).toBe(false);
      expect(shutdown).toHaveBeenCalledTimes(1);
      expect(shutdown).toHaveBeenCalledWith("managed_parent_disconnected", 0);
    }
  });

  it("marks draining, waits for propagation, then closes resources and exits cleanly", async () => {
    vi.useFakeTimers();
    const lifecycle = createGatewayLifecycle();
    let closeCallback: ((error?: Error) => void) | undefined;
    const server = {
      gatewayLifecycle: lifecycle,
      close: vi.fn((callback) => { closeCallback = callback; }),
      closeIdleConnections: vi.fn(),
      closeAllConnections: vi.fn(),
      closeRealtimeConnections: vi.fn(),
      shutdownResources: vi.fn(async () => undefined),
    };
    const logger = { info: vi.fn(), error: vi.fn(), fatal: vi.fn() };
    const destroyPools = vi.fn();
    const exit = vi.fn();
    const controller = createGatewayShutdownController({
      server,
      logger,
      destroyPools,
      exit,
      propagationMs: 1_000,
      timeoutMs: 10_000,
    });

    expect(controller.shutdown("SIGTERM", 0)).toBe(true);
    expect(controller.shutdown("SIGINT", 0)).toBe(false);
    expect(lifecycle.snapshot()).toMatchObject({ state: "draining", reason: "SIGTERM" });
    expect(server.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(server.closeIdleConnections).toHaveBeenCalledTimes(1);
    expect(server.closeRealtimeConnections).toHaveBeenCalledWith(1001, "Gateway shutting down");

    closeCallback?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(server.shutdownResources).toHaveBeenCalledTimes(1);
    expect(destroyPools).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
    expect(server.closeAllConnections).not.toHaveBeenCalled();
  });

  it("skips propagation for fatal errors and force-closes at the deadline", async () => {
    vi.useFakeTimers();
    const server = {
      gatewayLifecycle: createGatewayLifecycle(),
      close: vi.fn(),
      closeIdleConnections: vi.fn(),
      closeAllConnections: vi.fn(),
      closeRealtimeConnections: vi.fn(),
      shutdownResources: vi.fn(async () => undefined),
    };
    const logger = { info: vi.fn(), error: vi.fn(), fatal: vi.fn() };
    const destroyPools = vi.fn();
    const exit = vi.fn();
    const controller = createGatewayShutdownController({
      server,
      logger,
      destroyPools,
      exit,
      propagationMs: 5_000,
      timeoutMs: 10_000,
    });

    controller.shutdown("uncaughtException", 1);
    expect(server.close).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);

    expect(server.closeAllConnections).toHaveBeenCalledTimes(1);
    expect(server.closeRealtimeConnections).toHaveBeenCalledWith(1012, "Gateway forced shutdown");
    expect(destroyPools).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("keeps the force deadline active while resource shutdown is still pending", async () => {
    vi.useFakeTimers();
    let closeCallback: ((error?: Error) => void) | undefined;
    const server = {
      gatewayLifecycle: createGatewayLifecycle(),
      close: vi.fn((callback) => { closeCallback = callback; }),
      closeIdleConnections: vi.fn(),
      closeAllConnections: vi.fn(),
      closeRealtimeConnections: vi.fn(),
      shutdownResources: vi.fn(() => new Promise<void>(() => undefined)),
    };
    const logger = { info: vi.fn(), error: vi.fn(), fatal: vi.fn() };
    const destroyPools = vi.fn();
    const exit = vi.fn();
    const controller = createGatewayShutdownController({
      server,
      logger,
      destroyPools,
      exit,
      propagationMs: 0,
      timeoutMs: 10,
    });

    controller.shutdown("SIGTERM", 0);
    closeCallback?.();
    await Promise.resolve();
    expect(server.shutdownResources).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10);

    expect(server.closeAllConnections).toHaveBeenCalledTimes(1);
    expect(destroyPools).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("bounds configured durations", () => {
    expect(readBoundedDuration("500", 100, 0, 1_000)).toBe(500);
    expect(readBoundedDuration("-1", 100, 0, 1_000)).toBe(0);
    expect(readBoundedDuration("5000", 100, 0, 1_000)).toBe(1_000);
    expect(readBoundedDuration("invalid", 100, 0, 1_000)).toBe(100);
  });
});
