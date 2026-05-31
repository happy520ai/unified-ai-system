import { evaluateTaijiBeidouMainChainHook } from "../../apps/ai-gateway-service/src/gateway/taijiBeidouMainChainHook.js";
import { boundary, loadGuardedProviderBaseline, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const baseline = await loadGuardedProviderBaseline();
const shadow = evaluateTaijiBeidouMainChainHook({ body: { taijiBeidouShadow: true } });
const passed = baseline.phase675682Passed && shadow.action === "shadow" && shadow.providerCallsMade === false;
const evidence = boundary({
  phase: "Phase689",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : baseline.blocker || "main_chain_shadow_trial_failed",
  productionReady: false,
  shadowModeAvailable: true,
  shadowAction: shadow.action,
  shadowProviderCall: false,
  responseReplacementAllowed: false,
  shadowEvidenceRef: phaseEvidencePath(689, "main-chain-shadow-runtime-trial-result.json"),
});

await writeJson(phaseEvidencePath(689, "main-chain-shadow-runtime-trial-result.json"), evidence);
await writePhaseDoc(689, "Main-chain Shadow Runtime Trial", evidence, [
  "## Shadow Trial",
  "",
  "- Shadow mode generated evidence and did not replace the user response.",
  "- Provider call remains false unless a future explicit provider shadow approval is present.",
]);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
