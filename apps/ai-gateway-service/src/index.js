import { createGatewayApplication } from "./application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./http/httpServer.js";
import { destroyAllPools } from "./http/connectionPool.js";

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
  console.log(
    JSON.stringify(
      {
        app: "ai-gateway-service",
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
          "GET /forge/health",
          "GET /forge/goals",
          "POST /forge/goals",
          "POST /workforce/execute",
        ],
        knowledge: application.knowledgeService.getHealth(),
        knowledgeInfra: application.knowledgeInfra.getReadiness(),
        providerMode: application.config.aiGatewayService.providerMode,
        providers: application.gatewayService.getProviderDescriptors().map((provider) => provider.id),
      },
      null,
      2,
    ),
  );
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Global safety net: log and survive unhandled rejections instead of crashing
process.on("unhandledRejection", (reason) => {
  console.error("[ai-gateway-service] Unhandled rejection:", reason?.message || reason);
});

function shutdown() {
  try {
    destroyAllPools();
  } catch (err) { console.error("[index]:", err?.message || err); }
  // Shut down Forge engine (drain running workers, close SQLite)
  try {
    if (application.forgeService?.shutdown) {
      application.forgeService.shutdown();
    }
  } catch (e) {
    console.error("[ai-gateway-service] Forge shutdown error:", e?.message || e);
  }
  // Force exit after 25s if graceful close stalls (e.g. lingering WebSocket clients or Forge workers)
  const forceTimer = setTimeout(() => {
    console.error("[ai-gateway-service] Graceful shutdown timed out, forcing exit.");
    process.exit(1);
  }, 25_000);
  forceTimer.unref();
  server.close(() => {
    clearTimeout(forceTimer);
    process.exit(0);
  });
}
