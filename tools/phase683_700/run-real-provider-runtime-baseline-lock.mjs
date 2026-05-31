import { boundary, loadGuardedProviderBaseline, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const baseline = await loadGuardedProviderBaseline();
const evidence = boundary({
  phase: "Phase683",
  completed: baseline.phase675682Passed,
  recommended_sealed: baseline.phase675682Passed,
  blocker: baseline.blocker,
  productionReady: false,
  guardedRealProviderRuntimeV0Passed: baseline.phase675682Passed,
  phase675682Passed: baseline.phase675682Passed,
  providerId: baseline.providerId,
  modelId: baseline.modelId,
  capabilityId: baseline.capabilityId,
  requestAttemptCount: Number(baseline.final.requestAttemptCount || baseline.oneShot.requestAttemptCount || 0),
  responseClassification: baseline.final.responseClassification || baseline.oneShot.responseClassification || "unknown",
  evidenceRef: "apps/ai-gateway-service/evidence/phase675_682/guarded-real-provider-runtime-one-shot-result.json",
  rollbackRef: baseline.ledger.rollbackRef || baseline.oneShot.rollbackRef || null,
  emergencyDisableRef: baseline.ledger.emergencyDisableRef || "capabilities/_real_provider_runtime_disabled/",
});

await writeJson(phaseEvidencePath(683, "real-provider-runtime-baseline-lock-result.json"), evidence);
await writePhaseDoc(683, "Real Provider Runtime Baseline Lock", evidence, [
  "## Locked Baseline",
  "",
  `- providerId: ${evidence.providerId}`,
  `- modelId: ${evidence.modelId}`,
  `- responseClassification: ${evidence.responseClassification}`,
  `- evidenceRef: ${evidence.evidenceRef}`,
]);
console.log(JSON.stringify(evidence, null, 2));

if (!baseline.phase675682Passed) process.exitCode = 1;
