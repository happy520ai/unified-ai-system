import type { GatewayLifecycle, GatewayLifecycleSnapshot } from "./gatewayLifecycle.ts";

type ShutdownServer = {
  gatewayLifecycle?: GatewayLifecycle;
  close(callback: (error?: Error) => void): void;
  closeIdleConnections?(): void;
  closeAllConnections?(): void;
  shutdownResources?(): Promise<void>;
};

type ShutdownLogger = {
  info(data: unknown, message?: string): void;
  error(data: unknown, message?: string): void;
  fatal(data: unknown, message?: string): void;
};

export type GatewayShutdownOptions = {
  server: ShutdownServer;
  logger: ShutdownLogger;
  destroyPools: () => void;
  exit: (code: number) => void;
  propagationMs: number;
  timeoutMs: number;
};

export type GatewayShutdownController = {
  shutdown(reason: string, exitCode: number): boolean;
  isShuttingDown(): boolean;
};

export function createGatewayShutdownController(options: GatewayShutdownOptions): GatewayShutdownController {
  let shuttingDown = false;

  return {
    shutdown,
    isShuttingDown: () => shuttingDown,
  };

  function shutdown(reason: string, exitCode: number): boolean {
    if (shuttingDown) return false;
    shuttingDown = true;

    const lifecycle: GatewayLifecycleSnapshot | null = options.server.gatewayLifecycle?.beginDrain(reason) ?? null;
    const propagationMs = exitCode === 0 ? options.propagationMs : 0;
    options.logger.info({
      event: "service_shutdown_started",
      reason,
      exitCode,
      propagationMs,
      timeoutMs: options.timeoutMs,
      lifecycle,
    });

    const forceTimer = setTimeout(() => {
      options.logger.fatal({
        event: "service_shutdown_forced",
        reason,
        exitCode,
      }, "Graceful shutdown timed out.");
      options.server.closeAllConnections?.();
      options.destroyPools();
      options.exit(exitCode || 1);
    }, options.timeoutMs);
    forceTimer.unref?.();

    const beginClose = () => {
      options.server.close((error) => {
        void finishShutdown(error, forceTimer, reason, exitCode);
      });
      options.server.closeIdleConnections?.();
    };

    if (propagationMs > 0) {
      const propagationTimer = setTimeout(beginClose, propagationMs);
      propagationTimer.unref?.();
    } else {
      beginClose();
    }
    return true;
  }

  async function finishShutdown(
    error: Error | undefined,
    forceTimer: NodeJS.Timeout,
    reason: string,
    exitCode: number,
  ): Promise<void> {
    clearTimeout(forceTimer);
    if (error) {
      options.logger.error({
        event: "service_shutdown_failed",
        err: error,
      }, "HTTP server shutdown failed.");
      options.destroyPools();
      options.exit(1);
      return;
    }
    try {
      await options.server.shutdownResources?.();
    } catch (resourceError) {
      options.logger.error({
        event: "service_shutdown_resource_failed",
        err: resourceError,
      }, "Gateway resources did not shut down cleanly.");
      options.destroyPools();
      options.exit(1);
      return;
    }
    options.destroyPools();
    options.logger.info({ event: "service_shutdown_completed", reason, exitCode });
    options.exit(exitCode);
  }
}

export function readBoundedDuration(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}
