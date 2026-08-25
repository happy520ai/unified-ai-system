import { createGatewayApplication } from "./application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./http/httpServer.js";
import { destroyAllPools } from "./http/connectionPool.js";
import { createPinoLogger } from "./logging/pinoLogger.js";
import { createGatewayShutdownController, readBoundedDuration } from "./http/gatewayShutdown.ts";

const application = createGatewayApplication();
const { host, port } = application.config.aiGatewayService.endpoint;
const server = createGatewayHttpServer(application);
const logger = createPinoLogger({ app: "ai-gateway-service" });
const shutdownTimeoutMs = readBoundedDuration(
  application.runtimeEnv?.AI_GATEWAY_SHUTDOWN_TIMEOUT_MS ?? process.env.AI_GATEWAY_SHUTDOWN_TIMEOUT_MS,
  10_000,
  1_000,
  120_000,
);
const shutdownPropagationMs = Math.min(
  readBoundedDuration(
    application.runtimeEnv?.AI_GATEWAY_SHUTDOWN_PROPAGATION_MS ?? process.env.AI_GATEWAY_SHUTDOWN_PROPAGATION_MS,
    1_000,
    0,
    30_000,
  ),
  Math.max(0, shutdownTimeoutMs - 250),
);
const shutdownController = createGatewayShutdownController({
  server,
  logger,
  destroyPools: destroyAllPools,
  exit: (code) => process.exit(code),
  propagationMs: shutdownPropagationMs,
  timeoutMs: shutdownTimeoutMs,
});

server.listen(port, host, () => {
  logger.info({
    event: "service_ready",
    status: "ready",
    phase: "phase-7a-1-service-entry",
    url: `http://${host}:${port}`,
    routes: [
      "GET /health/check",
      "GET /providers",
      "GET /config/runtime",
      "GET /route/modes",
      "GET /knowledge/health",
      "GET /knowledge/infra/readiness",
      "GET /knowledge/sources",
      "GET /ws/info",
      "WS /ws",
      "POST /prompts/enhance",
      "GET /v1/models",
      "POST /v1/chat/completions",
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

process.once("SIGINT", () => shutdownController.shutdown("SIGINT", 0));
process.once("SIGTERM", () => shutdownController.shutdown("SIGTERM", 0));
process.on("unhandledRejection", (reason) => {
  logger.error({
    event: "unhandled_rejection",
    err: reason instanceof Error ? reason : new Error(String(reason)),
  }, "Unhandled promise rejection.");
  shutdownController.shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (error) => {
  logger.fatal({
    event: "uncaught_exception",
    err: error,
  }, "Uncaught exception.");
  shutdownController.shutdown("uncaughtException", 1);
});
