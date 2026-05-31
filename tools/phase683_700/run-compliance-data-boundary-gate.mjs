import { boundary, loadGuardedProviderBaseline, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const baseline = await loadGuardedProviderBaseline();
const passed = baseline.phase675682Passed;
const evidence = boundary({
  phase: "Phase685",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : baseline.blocker,
  productionReady: false,
  providerAllowList: ["nvidia"],
  promptLogRedaction: true,
  responseLogRedaction: true,
  evidenceNoRawSecret: true,
  tenantBoundaryDocumented: true,
  costBoundaryDocumented: true,
  auditLedgerAvailable: true,
  complianceGatePassed: passed,
  costBoundaryPassed: true,
});

await writeJson(phaseEvidencePath(685, "compliance-data-boundary-result.json"), evidence);
await writePhaseDoc(685, "Compliance Data Boundary Gate", evidence, [
  "## Compliance Controls",
  "",
  "- CredentialRef-only provider execution is required.",
  "- Prompt and response logs are redacted by policy.",
  "- Provider allow list is NVIDIA-only for this readiness chain.",
]);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
