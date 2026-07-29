import { createGatewayApplication } from "./application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./http/httpServer.js";
import { destroyAllPools } from "./http/connectionPool.js";
import { createPinoLogger } from "./logging/pinoLogger.js";

const application = createGatewayApplication();
const { host, port } = application.config.aiGatewayService.endpoint;
const server = createGatewayHttpServer(application);
const logger = createPinoLogger({ app: "ai-gateway-service" });
let shuttingDown = false;

server.listen(port, host, () => {
  logger.info({
    event: "service_ready",
    status: "ready",
    phase: "phase-7a-1-service-entry",
    url: `http://${host}:${port}`,
    routes: [
      "GET /health/check",
      "GET /ui",
      "GET /console",
      "GET /providers",
      "GET /config/runtime",
      "GET /route/modes",
      "GET /knowledge/health",
      "GET /knowledge/infra/readiness",
      "GET /knowledge/sources",
      "GET /ws/info",
      "WS /ws",
      "POST /chat",
      "POST /chat/stream",
      "POST /knowledge/load",
      "POST /knowledge/retrieve",
      "POST /route",
    ],
    knowledge: application.knowledgeService.getHealth(),
    knowledgeInfra: application.knowledgeInfra.getReadiness(),
    providerMode: application.config.aiGatewayService.providerMode,
    providers: application.gatewayService.getProviderDescriptors().map((provider) => provider.id),
  }, "AI gateway service is ready.");
});

process.once("SIGINT", () => shutdown("SIGINT", 0));
process.once("SIGTERM", () => shutdown("SIGTERM", 0));
process.on("unhandledRejection", (reason) => {
  logger.error({
    event: "unhandled_rejection",
    err: reason instanceof Error ? reason : new Error(String(reason)),
  }, "Unhandled promise rejection.");
  shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (error) => {
  logger.fatal({
    event: "uncaught_exception",
    err: error,
  }, "Uncaught exception.");
  shutdown("uncaughtException", 1);
});

function shutdown(reason, exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ event: "service_shutdown_started", reason, exitCode });
  const forceTimer = setTimeout(() => {
    logger.fatal({
      event: "service_shutdown_forced",
      reason,
      exitCode,
    }, "Graceful shutdown timed out.");
    process.exit(exitCode || 1);
  }, 10_000);
  forceTimer.unref();

  destroyAllPools();
  server.close((error) => {
    clearTimeout(forceTimer);
    if (error) {
      logger.error({
        event: "service_shutdown_failed",
        err: error,
      }, "HTTP server shutdown failed.");
      process.exit(1);
    }
    logger.info({ event: "service_shutdown_completed", reason, exitCode });
    process.exit(exitCode);
  });
}
