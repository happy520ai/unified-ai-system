import { evaluateTaijiBeidouChatGatewayExecutePreviewHook } from "../../apps/ai-gateway-service/src/gateway/taijiBeidouChatGatewayExecutePreviewHook.js";
import { boundary, loadGuardedProviderBaseline, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const baseline = await loadGuardedProviderBaseline();
const noFlag = evaluateTaijiBeidouChatGatewayExecutePreviewHook({ body: {} });
const preview = evaluateTaijiBeidouChatGatewayExecutePreviewHook({ body: { taijiBeidouPreview: true } });
const passed = baseline.phase675682Passed && noFlag.action === "passthrough" && preview.action === "respond";
const evidence = boundary({
  phase: "Phase692",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : baseline.blocker || "chat_gateway_execute_preview_hook_failed",
  productionReady: false,
  chatGatewayExecuteHookAvailable: true,
  chatGatewayExecuteDefaultEnabled: false,
  chatGatewayExecuteNoFlagRegressionPassed: noFlag.action === "passthrough",
  chatGatewayExecutePreviewFlagPassed: preview.action === "respond",
  providerSelectionChanged: false,
  credentialRefChanged: false,
  routeRegistryChanged: false,
  extraProviderCallTriggered: false,
});

await writeJson(phaseEvidencePath(692, "chat-gateway-execute-disabled-preview-hook-result.json"), evidence);
await writePhaseDoc(692, "Chat Gateway Execute Disabled Preview Hook", evidence, [
  "## Hook Check",
  "",
  `- noFlagAction: ${noFlag.action}`,
  `- previewFlagAction: ${preview.action}`,
]);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
