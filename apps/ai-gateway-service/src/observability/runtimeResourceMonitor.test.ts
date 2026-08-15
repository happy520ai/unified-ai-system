import { describe, expect, it, vi } from "vitest";
import { createRuntimeResourceMonitor } from "./runtimeResourceMonitor.ts";

describe("runtimeResourceMonitor", () => {
  it("reports process resources in Prometheus base units", () => {
    const enable = vi.fn(() => true);
    const disable = vi.fn(() => true);
    const histogram = {
      count: 10,
      max: 80_000_000,
      mean: 20_000_000,
      enable,
      disable,
      percentile: (value: number) => ({ 50: 10_000_000, 95: 40_000_000, 99: 70_000_000 }[value] ?? 0),
    };
    let utilizationRead = 0;
    const monitor = createRuntimeResourceMonitor({
      resolutionMs: 25,
      createHistogram: () => histogram,
      readCpuUsage: () => ({ user: 2_500_000, system: 750_000 }),
      readEventLoopUtilization: () => {
        utilizationRead += 1;
        return utilizationRead === 1
          ? { active: 0, idle: 0, utilization: 0 }
          : { active: 250, idle: 750, utilization: 0.25 };
      },
      readMemoryUsage: () => ({
        arrayBuffers: 512,
        external: 1_024,
        heapTotal: 4_096,
        heapUsed: 2_048,
        rss: 8_192,
      }),
    });

    expect(enable).toHaveBeenCalledOnce();
    expect(monitor.getConfig()).toEqual({ resolutionMs: 25 });
    expect(monitor.getSnapshot()).toEqual({
      cpuSeconds: { system: 0.75, user: 2.5 },
      eventLoop: {
        activeSeconds: 0.25,
        delaySeconds: {
          count: 10,
          max: 0.08,
          mean: 0.02,
          p50: 0.01,
          p95: 0.04,
          p99: 0.07,
          sum: 0.2,
        },
        idleSeconds: 0.75,
        utilizationRatio: 0.25,
      },
      memoryBytes: {
        arrayBuffers: 512,
        external: 1_024,
        heapTotal: 4_096,
        heapUsed: 2_048,
        rss: 8_192,
      },
    });

    monitor.close();
    monitor.close();
    expect(disable).toHaveBeenCalledOnce();
  });

  it("reports zero delay before the histogram has samples", () => {
    const monitor = createRuntimeResourceMonitor({
      createHistogram: () => ({
        count: 0,
        max: 0,
        mean: Number.NaN,
        enable: () => true,
        disable: () => true,
        percentile: () => 511,
      }),
      readCpuUsage: () => ({ user: 0, system: 0 }),
      readEventLoopUtilization: () => ({ active: 0, idle: 0, utilization: 2 }),
      readMemoryUsage: () => ({
        arrayBuffers: 0,
        external: 0,
        heapTotal: 0,
        heapUsed: 0,
        rss: 0,
      }),
    });

    expect(monitor.getSnapshot().eventLoop).toMatchObject({
      delaySeconds: { count: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0, sum: 0 },
      utilizationRatio: 1,
    });
    monitor.close();
  });
});
