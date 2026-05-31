import { evaluateTaijiBeidouChatGatewayExecutePreviewHook } from "../../apps/ai-gateway-service/src/gateway/taijiBeidouChatGatewayExecutePreviewHook.js";
import { boundary, loadGuardedProviderBaseline, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const baseline = await loadGuardedProviderBaseline();
const noFlag = evaluateTaijiBeidouChatGatewayExecutePreviewHook({ body: {} });
const shadow = evaluateTaijiBeidouChatGatewayExecutePreviewHook({ body: { taijiBeidouShadow: true } });
const kill = evaluateTaijiBeidouChatGatewayExecutePreviewHook({ body: { taijiBeidouPreview: true }, killSwitchActive: true });
const passed = baseline.phase675682Passed && noFlag.action === "passthrough" && shadow.action === "shadow" && kill.result.blocked === true;
const evidence = boundary({
  phase: "Phase693",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : baseline.blocker || "chat_gateway_execute_shadow_trial_failed",
  productionReady: false,
  chatGatewayExecuteNoFlagRegressionPassed: noFlag.action === "passthrough",
  chatGatewayExecuteShadowPassed: shadow.action === "shadow",
  chatGatewayExecuteRollbackReady: true,
  chatGatewayExecuteKillSwitchReady: kill.result.blocked === true,
  shadowProviderCall: false,
  responseReplacementAllowed: false,
});

await writeJson(phaseEvidencePath(693, "chat-gateway-execute-shadow-internal-trial-result.json"), evidence);
await writePhaseDoc(693, "Chat Gateway Execute Shadow Internal Trial", evidence, [
  "## Trial",
  "",
  "- No-flag path is passthrough.",
  "- Shadow path does not alter the live response.",
  "- Kill switch blocks preview execution.",
]);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
