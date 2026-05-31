import { createGatewayApplication } from "./application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./http/httpServer.js";

const application = createGatewayApplication();
const { host, port } = application.config.aiGatewayService.endpoint;
const server = createGatewayHttpServer(application);

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

function shutdown() {
  try {
    const { destroyAllPools } = require("./http/connectionPool.js");
    destroyAllPools();
  } catch {}
  server.close(() => {
    process.exit(0);
  });
}
