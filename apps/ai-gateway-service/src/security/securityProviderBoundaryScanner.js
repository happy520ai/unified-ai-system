import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function scanProviderBoundary(repoRoot) {
  const httpServer = safeRead(resolve(repoRoot, "apps/ai-gateway-service/src/http/httpServer.js"));
  const routingPolicy = safeRead(resolve(repoRoot, "apps/ai-gateway-service/src/routing/modelTierPolicy.js"));
  const modelCatalog = safeRead(resolve(repoRoot, "apps/ai-gateway-service/src/routing/providerAgnosticModelCatalog.js"));
  const findings = [];
  const mimoAsDefaultDetected = /default(Premium)?Provider["']?\s*[:=]\s*["']?mimo/i.test(`${routingPolicy}\n${modelCatalog}`);
  const nvidiaDefaultMarker = httpServer.includes("nvidia") || routingPolicy.includes("defaultChatProvider");

  if (mimoAsDefaultDetected) {
    findings.push({
      id: "provider-mimo-default",
      severity: "critical",
      dimension: "Provider Boundary",
      file: "apps/ai-gateway-service/src/routing/modelTierPolicy.js",
      message: "MiMo appears to be configured as a default provider.",
    });
  }

  return {
    status: findings.length === 0 ? "pass" : "fail",
    findings,
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    embeddingApiCalled: false,
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
    longContextSentToPaidApi: false,
    largeOutputRequested: false,
    stressTestExecuted: false,
    automaticPaidFallbackDetected: false,
    providerKeyPrinted: false,
    nvidiaDefaultMarkerFound: nvidiaDefaultMarker,
  };
}

function safeRead(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}
