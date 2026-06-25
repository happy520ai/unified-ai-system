import { createGatewayApplication } from "./application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./http/httpServer.js";
import { destroyAllPools } from "./http/connectionPool.js";
import { createPinoLogger } from "./logging/pinoLogger.js";

const logger = createPinoLogger({ app: "ai-gateway-service" });

// --- Production auth guard ---
if (process.env.NODE_ENV === "production") {
  const authEnabled = process.env.PME_ENTERPRISE_AUTH_ENABLED === "true"
    || !!process.env.PME_AUTH_TOKEN
    || !!process.env.PME_ENTERPRISE_USERS_JSON;
  if (!authEnabled) {
    logger.warn({
      event: "auth_not_configured",
      severity: "critical",
    }, "PRODUCTION WARNING: Enterprise auth is DISABLED. Set PME_ENTERPRISE_AUTH_ENABLED=true and configure users. All requests currently pass as admin.");
  }
  if (!process.env.AUTH_TOKEN_SECRET) {
    logger.warn({
      event: "auth_secret_missing",
      severity: "high",
    }, "PRODUCTION WARNING: AUTH_TOKEN_SECRET not set. JWT tokens will not persist across restarts.");
  }
}

const application = createGatewayApplication();
const { host, port } = application.config.aiGatewayService.endpoint;
const server = createGatewayHttpServer(application);

// --- HTTP timeout hardening ---
// 120s for LLM streaming responses (generous for long generations)
server.requestTimeout = 120_000;
// Headers must arrive within 125s (slightly above requestTimeout per Node.js convention)
server.headersTimeout = 125_000;
// Idle keep-alive connections close after 5s
server.keepAliveTimeout = 5_000;
// Destroy stalled sockets that exceed 2× request timeout
server.on("connection", (socket) => {
  socket.setTimeout(240_000);
  socket.on("timeout", () => socket.destroy());
});

server.listen(port, host, () => {
  logger.info({
    event: "service_ready",
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
      "GET /forge/health",
      "GET /forge/goals",
      "POST /forge/goals",
      "POST /workforce/execute",
    ],
    knowledge: application.knowledgeService.getHealth(),
    knowledgeInfra: application.knowledgeInfra.getReadiness(),
    providerMode: application.config.aiGatewayService.providerMode,
    providers: application.gatewayService.getProviderDescriptors().map((provider) => provider.id),
  }, "ai-gateway-service ready");
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Global safety net: log and survive unhandled rejections instead of crashing
process.on("unhandledRejection", (reason) => {
  logger.error({ event: "unhandled_rejection", err: reason }, "Unhandled rejection");
});

function shutdown() {
  try {
    destroyAllPools();
  } catch (err) { logger.error({ event: "pool_destroy_failed", err }, "Connection pool destroy failed"); }
  // Shut down Forge engine (drain running workers, close SQLite)
  try {
    if (application.forgeService?.shutdown) {
      application.forgeService.shutdown();
    }
  } catch (e) {
    logger.error({ event: "forge_shutdown_failed", err: e }, "Forge shutdown error");
  }
  // Force exit after 25s if graceful close stalls (e.g. lingering WebSocket clients or Forge workers)
  const forceTimer = setTimeout(() => {
    logger.error({ event: "shutdown_timeout" }, "Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 25_000);
  forceTimer.unref();
  server.close(() => {
    clearTimeout(forceTimer);
    process.exit(0);
  });
}
