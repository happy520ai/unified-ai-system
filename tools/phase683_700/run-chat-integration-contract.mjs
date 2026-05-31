import { boundary, loadGuardedProviderBaseline, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const baseline = await loadGuardedProviderBaseline();
const passed = baseline.phase675682Passed;
const contract = {
  route: "/chat",
  defaultBehaviorChange: false,
  layers: ["preview", "shadow", "internal", "canary", "production"],
  rollbackRequired: true,
  killSwitchRequired: true,
  evidenceRequired: true,
  noRawSecret: true,
  noDefaultProviderExtraCall: true,
};
const evidence = boundary({
  phase: "Phase695",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : baseline.blocker,
  productionReady: false,
  chatContractAvailable: true,
  chatDefaultEnabled: false,
  contract,
});

await writeJson(phaseEvidencePath(695, "chat-integration-contract-result.json"), evidence);
await writePhaseDoc(695, "Chat Integration Contract", evidence, [
  "## Contract",
  "",
  "```json",
  JSON.stringify(contract, null, 2),
  "```",
]);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
