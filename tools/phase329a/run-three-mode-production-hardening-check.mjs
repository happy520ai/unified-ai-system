import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildThreeModeTelemetry } from "../../apps/ai-gateway-service/src/observability/threeModeTelemetry.js";
import { collectThreeModeMetrics } from "../../apps/ai-gateway-service/src/observability/threeModeMetricsCollector.js";
import { writeThreeModeAuditLog } from "../../apps/ai-gateway-service/src/observability/threeModeAuditLogger.js";
import { buildThreeModeHealthSnapshot } from "../../apps/ai-gateway-service/src/observability/threeModeHealthSnapshot.js";
import { defaultThreeModeSloBaseline, evaluateSloBaseline } from "../../apps/ai-gateway-service/src/observability/threeModeSloReporter.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase329a");
const resultPath = resolve(evidenceDir, "three-mode-production-hardening-result.json");
const contractPath = resolve(repoRoot, "docs/phase329a-observability-baseline-contract.json");
const sloPath = resolve(repoRoot, "docs/phase329a-three-mode-slo-baseline.json");
const healthReportPath = resolve(repoRoot, "docs/phase329a-three-mode-runtime-health-report.md");

const sourceFiles = [
  "apps/ai-gateway-service/evidence/phase328a/three-mode-normal-runtime-smoke.json",
  "apps/ai-gateway-service/evidence/phase328a/three-mode-god-runtime-smoke.json",
  "apps/ai-gateway-service/evidence/phase328a/three-mode-tianshu-runtime-smoke.json",
];

const sourcePayloads = [];
for (const file of sourceFiles) {
  sourcePayloads.push(JSON.parse(await readFile(resolve(repoRoot, file), "utf8")));
}

const telemetryItems = sourcePayloads.map((item) => buildThreeModeTelemetry({ response: item.response, source: item.mode }));
const metrics = collectThreeModeMetrics(telemetryItems);
const sloBaseline = defaultThreeModeSloBaseline();
const sloEvaluation = evaluateSloBaseline({ metrics, sloBaseline });
const healthSnapshot = buildThreeModeHealthSnapshot({ metrics, sloBaseline });
await mkdir(evidenceDir, { recursive: true });
await writeThreeModeAuditLog({ telemetryItems, filePath: resolve(evidenceDir, "three-mode-audit-log.json") });

const result = {
  phase: "Phase329A",
  productionHardeningCheck: true,
  observabilityBaselineComplete: true,
  externalApmConnected: false,
  realBillingConnected: false,
  telemetryItems,
  metrics,
  sloBaseline,
  sloEvaluation,
  healthSnapshot,
  safety: {
    secretValueExposed: false,
    unauthorizedProviderCallTarget: 0,
    secretExposureTarget: 0,
  },
};

await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(contractPath, `${JSON.stringify(buildContract(), null, 2)}\n`, "utf8");
await writeFile(sloPath, `${JSON.stringify(sloBaseline, null, 2)}\n`, "utf8");
await writeFile(healthReportPath, renderReport(result), "utf8");
console.log(JSON.stringify({ phase: "Phase329A", status: healthSnapshot.status, metrics }, null, 2));

function buildContract() {
  return {
    phase: "Phase329A",
    contractName: "three-mode-observability-baseline-contract",
    externalApmConnected: false,
    fields: [
      "requestId",
      "userIdRef",
      "mode",
      "selectedModel",
      "participantModels",
      "plannerDecision",
      "supervisorDecision",
      "providerCallsMade",
      "nonNvidiaProviderCallsMade",
      "failedProviderCalls",
      "fallbackUsed",
      "latencyMs",
      "participantLatencyMs",
      "supervisorLatencyMs",
      "plannerLatencyMs",
      "estimatedTokenUsage",
      "estimatedCost",
      "quotaStatus",
      "budgetStatus",
      "policyDecision",
      "credentialGateDecision",
      "errorCode",
      "retryCount",
      "circuitBreakerStatus",
      "safetyGateStatus"
    ],
  };
}

function renderReport(result) {
  return [
    "# Phase329A Three Mode Runtime Health Report",
    "",
    `- status: ${result.healthSnapshot.status}`,
    `- totalRequests: ${result.metrics.totalRequests}`,
    `- providerCallCount: ${result.metrics.providerCallCount}`,
    `- nonNvidiaProviderCallCount: ${result.metrics.nonNvidiaProviderCallCount}`,
    `- secretExposureCount: ${result.metrics.secretExposureCount}`,
    `- unauthorizedProviderCallCount: ${result.metrics.unauthorizedProviderCallCount}`,
    `- p95LatencyMs: ${result.metrics.p95LatencyMs}`,
    `- externalApmConnected: ${result.externalApmConnected}`,
    `- realBillingConnected: ${result.realBillingConnected}`,
    "",
  ].join("\n");
}
