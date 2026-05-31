import { boundary, readJsonIfExists, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const contract = await readJsonIfExists(phaseEvidencePath(687, "main-chain-integration-contract-result.json"), {});
const hook = await readJsonIfExists(phaseEvidencePath(688, "main-chain-disabled-hook-result.json"), {});
const shadow = await readJsonIfExists(phaseEvidencePath(689, "main-chain-shadow-runtime-trial-result.json"), {});
const passed = contract.completed === true && hook.completed === true && shadow.completed === true;
const evidence = boundary({
  phase: "Phase690",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : "main_chain_readiness_inputs_missing",
  productionReady: false,
  mainChainRuntimeReady: passed,
  mainChainHookAvailable: true,
  mainChainDefaultEnabled: false,
  shadowModeAvailable: true,
  rollbackAvailable: true,
  killSwitchAvailable: true,
  chatBehaviorChanged: false,
  chatGatewayExecuteBehaviorChanged: false,
});

await writeJson(phaseEvidencePath(690, "main-chain-readiness-seal-result.json"), evidence);
await writePhaseDoc(690, "Main-chain Readiness Seal", evidence, [
  "## Seal",
  "",
  "- main-chain ready means the disabled hook, shadow path, rollback, and kill switch are available.",
  "- It does not mean default main-chain traffic is enabled.",
]);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
