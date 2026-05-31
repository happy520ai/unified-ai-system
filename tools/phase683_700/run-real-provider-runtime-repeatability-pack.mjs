import { boundary, loadGuardedProviderBaseline, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const baseline = await loadGuardedProviderBaseline();
const evidence = boundary({
  phase: "Phase684",
  completed: baseline.phase675682Passed,
  recommended_sealed: baseline.phase675682Passed,
  blocker: baseline.phase675682Passed ? "repeatability_approval_missing" : baseline.blocker,
  productionReady: false,
  providerId: baseline.providerId,
  modelId: baseline.modelId,
  repeatabilityExecuted: false,
  maxRequestsTotal: 0,
  maxRetries: 0,
  providerCallsMadeByThisPhase: false,
  requestClassifications: [],
  repeatabilityPlanReady: baseline.phase675682Passed,
});

await writeJson(phaseEvidencePath(684, "real-provider-runtime-repeatability-result.json"), evidence);
await writePhaseDoc(684, "Real Provider Runtime Repeatability Pack", evidence, [
  "## Repeatability Policy",
  "",
  "- No extra guarded provider repeatability call was executed because no separate repeatability approval was present.",
  "- This is a plan-ready blocker, not a failed provider result.",
]);
console.log(JSON.stringify(evidence, null, 2));
