import { boundary, readJsonIfExists, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const contract = await readJsonIfExists(phaseEvidencePath(691, "chat-gateway-execute-contract-result.json"), {});
const hook = await readJsonIfExists(phaseEvidencePath(692, "chat-gateway-execute-disabled-preview-hook-result.json"), {});
const trial = await readJsonIfExists(phaseEvidencePath(693, "chat-gateway-execute-shadow-internal-trial-result.json"), {});
const passed = contract.completed === true && hook.completed === true && trial.completed === true;
const evidence = boundary({
  phase: "Phase694",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : "chat_gateway_execute_integration_inputs_missing",
  productionReady: false,
  chatGatewayExecuteIntegrated: passed,
  chatGatewayExecuteDefaultEnabled: false,
  chatGatewayExecuteNoFlagRegressionPassed: hook.chatGatewayExecuteNoFlagRegressionPassed === true && trial.chatGatewayExecuteNoFlagRegressionPassed === true,
  chatGatewayExecutePreviewFlagPassed: hook.chatGatewayExecutePreviewFlagPassed === true,
  chatGatewayExecuteShadowPassed: trial.chatGatewayExecuteShadowPassed === true,
  chatGatewayExecuteRollbackReady: trial.chatGatewayExecuteRollbackReady === true,
  chatGatewayExecuteKillSwitchReady: trial.chatGatewayExecuteKillSwitchReady === true,
});

await writeJson(phaseEvidencePath(694, "chat-gateway-execute-integration-seal-result.json"), evidence);
await writePhaseDoc(694, "Chat Gateway Execute Integration Seal", evidence);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
