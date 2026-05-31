import { evaluateTaijiBeidouMainChainHook } from "../../apps/ai-gateway-service/src/gateway/taijiBeidouMainChainHook.js";
import { boundary, loadGuardedProviderBaseline, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const baseline = await loadGuardedProviderBaseline();
const noFlag = evaluateTaijiBeidouMainChainHook({ body: {} });
const preview = evaluateTaijiBeidouMainChainHook({ body: { taijiBeidouPreview: true } });
const passed = baseline.phase675682Passed && noFlag.action === "passthrough" && preview.action === "preview";
const evidence = boundary({
  phase: "Phase688",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : baseline.blocker || "main_chain_disabled_hook_check_failed",
  productionReady: false,
  mainChainHookAvailable: true,
  mainChainDefaultEnabled: false,
  noFlagAction: noFlag.action,
  previewFlagAction: preview.action,
  providerCallsMade: false,
  responseReplacementAllowed: false,
  chatBehaviorChangedByDefault: false,
  chatGatewayExecuteBehaviorChangedByDefault: false,
});

await writeJson(phaseEvidencePath(688, "main-chain-disabled-hook-result.json"), evidence);
await writePhaseDoc(688, "Main-chain Disabled-by-default Hook", evidence, [
  "## Hook Result",
  "",
  `- noFlagAction: ${evidence.noFlagAction}`,
  `- previewFlagAction: ${evidence.previewFlagAction}`,
]);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
