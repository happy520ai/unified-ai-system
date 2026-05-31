import { boundary, loadGuardedProviderBaseline, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const baseline = await loadGuardedProviderBaseline();
const passed = baseline.phase675682Passed;
const contract = {
  mainChainHookEnabled: false,
  mode: "preview|shadow|internal|canary|production",
  providerRuntimeAllowed: false,
  credentialRefOnly: true,
  rollbackRequired: true,
  killSwitchRequired: true,
};
const evidence = boundary({
  phase: "Phase687",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : baseline.blocker,
  productionReady: false,
  mainChainContractAvailable: true,
  mainChainDefaultEnabled: false,
  contract,
});

await writeJson(phaseEvidencePath(687, "main-chain-integration-contract-result.json"), evidence);
await writePhaseDoc(687, "Main-chain Integration Contract", evidence, [
  "## Contract",
  "",
  "```json",
  JSON.stringify(contract, null, 2),
  "```",
]);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
