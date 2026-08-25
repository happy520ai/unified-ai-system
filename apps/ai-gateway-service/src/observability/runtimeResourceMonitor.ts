import { monitorEventLoopDelay, performance } from "node:perf_hooks";

type EventLoopUtilization = {
  active: number;
  idle: number;
  utilization: number;
};

type EventLoopDelayHistogram = {
  count: number | bigint;
  max: number | bigint;
  mean: number;
  disable(): boolean;
  enable(): boolean;
  percentile(percentile: number): number;
};

type RuntimeResourceMonitorOptions = {
  createHistogram?: (resolutionMs: number) => EventLoopDelayHistogram;
  readCpuUsage?: () => NodeJS.CpuUsage;
  readEventLoopUtilization?: (baseline?: EventLoopUtilization) => EventLoopUtilization;
  readMemoryUsage?: () => NodeJS.MemoryUsage;
  resolutionMs?: number;
};

export type RuntimeResourceSnapshot = {
  cpuSeconds: {
    system: number;
    user: number;
  };
  eventLoop: {
    activeSeconds: number;
    delaySeconds: {
      count: number;
      max: number;
      mean: number;
      p50: number;
      p95: number;
      p99: number;
      sum: number;
    };
    idleSeconds: number;
    utilizationRatio: number;
  };
  memoryBytes: {
    arrayBuffers: number;
    external: number;
    heapTotal: number;
    heapUsed: number;
    rss: number;
  };
};

const DEFAULT_RESOLUTION_MS = 20;

export function createRuntimeResourceMonitor(options: RuntimeResourceMonitorOptions = {}) {
  const resolutionMs = clampInteger(options.resolutionMs ?? DEFAULT_RESOLUTION_MS, 1, 1_000);
  const readCpuUsage = options.readCpuUsage ?? (() => process.cpuUsage());
  const readMemoryUsage = options.readMemoryUsage ?? (() => process.memoryUsage());
  const readEventLoopUtilization = options.readEventLoopUtilization
    ?? ((baseline?: EventLoopUtilization) => performance.eventLoopUtilization(baseline));
  const histogram = options.createHistogram?.(resolutionMs)
    ?? monitorEventLoopDelay({ resolution: resolutionMs });
  const baseline = readEventLoopUtilization();
  let closed = false;

  histogram.enable();

  return {
    getSnapshot(): RuntimeResourceSnapshot {
      const memory = readMemoryUsage();
      const cpu = readCpuUsage();
      const utilization = readEventLoopUtilization(baseline);
      const count = toNonNegativeInteger(histogram.count);
      const meanSeconds = count > 0 ? nanosecondsToSeconds(histogram.mean) : 0;

      return {
        cpuSeconds: {
          system: microsecondsToSeconds(cpu.system),
          user: microsecondsToSeconds(cpu.user),
        },
        eventLoop: {
          activeSeconds: millisecondsToSeconds(utilization.active),
          delaySeconds: {
            count,
            max: count > 0 ? nanosecondsToSeconds(histogram.max) : 0,
            mean: meanSeconds,
            p50: count > 0 ? nanosecondsToSeconds(histogram.percentile(50)) : 0,
            p95: count > 0 ? nanosecondsToSeconds(histogram.percentile(95)) : 0,
            p99: count > 0 ? nanosecondsToSeconds(histogram.percentile(99)) : 0,
            sum: meanSeconds * count,
          },
          idleSeconds: millisecondsToSeconds(utilization.idle),
          utilizationRatio: clampNumber(utilization.utilization, 0, 1),
        },
        memoryBytes: {
          arrayBuffers: toNonNegativeNumber(memory.arrayBuffers),
          external: toNonNegativeNumber(memory.external),
          heapTotal: toNonNegativeNumber(memory.heapTotal),
          heapUsed: toNonNegativeNumber(memory.heapUsed),
          rss: toNonNegativeNumber(memory.rss),
        },
      };
    },
    close() {
      if (closed) return;
      closed = true;
      histogram.disable();
    },
    getConfig() {
      return { resolutionMs };
    },
  };
}

function microsecondsToSeconds(value: number): number {
  return toNonNegativeNumber(value) / 1_000_000;
}

function millisecondsToSeconds(value: number): number {
  return toNonNegativeNumber(value) / 1_000;
}

function nanosecondsToSeconds(value: number | bigint): number {
  return toNonNegativeNumber(value) / 1_000_000_000;
}

function toNonNegativeInteger(value: number | bigint): number {
  return Math.trunc(toNonNegativeNumber(value));
}

function toNonNegativeNumber(value: number | bigint | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clampNumber(value, min, max));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
