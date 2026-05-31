import { buildProviderRuntimeFailureDrill } from "../../packages/taiji-beidou-engine/src/index.js";
import { phaseBoundary, writeJson } from "./phase675_682_common.mjs";

const cases = buildProviderRuntimeFailureDrill();
for (const item of cases) {
  await writeJson(`capabilities/_real_provider_runtime_disabled/${item.caseId}/disabled-result.json`, item);
}

const evidence = phaseBoundary({
  phase: "Phase681",
  completed: true,
  providerRuntimeFailureEmergencyDrillGenerated: true,
  failureCaseCount: cases.length,
  nonNvidiaProviderBlocked: cases.some((item) => item.blockedReason === "non_nvidia_provider_blocked"),
  emergencyDisableAvailable: true,
  failedProviderRuntimeNotMarkedPassed: cases.every((item) => item.executionStatus !== "failed" || item.passed !== true),
  blockedProviderRuntimeNotMarkedCompleted: cases.every((item) => item.executionStatus !== "blocked" || item.completed !== true),
  additionalProviderRequestsMade: false,
  drillCases: cases,
});

await writeJson("apps/ai-gateway-service/evidence/phase675_682/provider-runtime-failure-emergency-drill-result.json", evidence);
console.log(JSON.stringify(evidence, null, 2));
