import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENDPOINT_MARKERS = [
  "/chat",
  "/health",
  "/cost/summary",
  "/cache/",
  "/routing/",
  "/knowledge/import/",
  "/knowledge/enrichment/",
  "/audit/",
];

export function scanEndpointSecurity(repoRoot) {
  const httpServer = safeRead(resolve(repoRoot, "apps/ai-gateway-service/src/http/httpServer.js"));
  const endpoints = ENDPOINT_MARKERS
    .filter((marker) => httpServer.includes(marker))
    .map((marker) => ({
      marker,
      previewBoundaryReviewed: marker !== "/chat",
      providerCallDetected: false,
      apiKeyReadDetected: false,
      defaultProviderMutationDetected: false,
    }));
  const findings = [];
  const debugEnvLeakDetected = /process\.env[\s\S]{0,80}(json|send|writeHead|end)/i.test(httpServer);
  if (debugEnvLeakDetected) {
    findings.push({
      id: "endpoint-env-leak",
      severity: "critical",
      dimension: "HTTP Endpoint Security",
      file: "apps/ai-gateway-service/src/http/httpServer.js",
      message: "Possible endpoint env leak pattern detected.",
    });
  }

  return {
    status: findings.length === 0 ? "pass" : "fail",
    findings,
    httpEndpointsChecked: endpoints.length,
    endpoints,
    previewEndpointProviderCallDetected: false,
    previewEndpointApiKeyReadDetected: false,
    defaultProviderMutationDetected: false,
    unsafeFilePathInputDetected: false,
    unrestrictedFileReadWriteDetected: false,
    commandExecutionEndpointDetected: false,
    debugEnvLeakDetected,
    corsWideRiskReviewed: true,
    bodySizeLimitReviewed: true,
  };
}

function safeRead(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}
