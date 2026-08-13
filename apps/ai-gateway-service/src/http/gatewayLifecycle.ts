export type GatewayLifecycleState = "ready" | "draining" | "stopped";

export type GatewayLifecycleSnapshot = {
  state: GatewayLifecycleState;
  isReady: boolean;
  isLive: boolean;
  reason: string | null;
  transitionedAt: string;
  drainingAt: string | null;
  stoppedAt: string | null;
};

export type GatewayLifecycle = {
  beginDrain(reason?: string): GatewayLifecycleSnapshot;
  markStopped(reason?: string): GatewayLifecycleSnapshot;
  snapshot(): GatewayLifecycleSnapshot;
};

export function createGatewayLifecycle(options: { now?: () => number } = {}): GatewayLifecycle {
  const now = options.now ?? Date.now;
  const readyAt = now();
  let state: GatewayLifecycleState = "ready";
  let reason: string | null = null;
  let transitionedAt = readyAt;
  let drainingAt: number | null = null;
  let stoppedAt: number | null = null;

  return {
    beginDrain(nextReason = "shutdown") {
      if (state === "ready") {
        state = "draining";
        reason = normalizeReason(nextReason);
        transitionedAt = now();
        drainingAt = transitionedAt;
      }
      return snapshot();
    },

    markStopped(nextReason = "shutdown") {
      if (state !== "stopped") {
        state = "stopped";
        reason ??= normalizeReason(nextReason);
        transitionedAt = now();
        drainingAt ??= transitionedAt;
        stoppedAt = transitionedAt;
      }
      return snapshot();
    },

    snapshot,
  };

  function snapshot(): GatewayLifecycleSnapshot {
    return {
      state,
      isReady: state === "ready",
      isLive: state !== "stopped",
      reason,
      transitionedAt: new Date(transitionedAt).toISOString(),
      drainingAt: drainingAt === null ? null : new Date(drainingAt).toISOString(),
      stoppedAt: stoppedAt === null ? null : new Date(stoppedAt).toISOString(),
    };
  }
}

function normalizeReason(value: string): string {
  const normalized = String(value || "shutdown").trim();
  return normalized.slice(0, 128) || "shutdown";
}
