import { boundary, readJsonIfExists, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const contract = await readJsonIfExists(phaseEvidencePath(695, "chat-integration-contract-result.json"), {});
const trial = await readJsonIfExists(phaseEvidencePath(696, "chat-disabled-preview-shadow-trial-result.json"), {});
const passed = contract.completed === true && trial.completed === true;
const evidence = boundary({
  phase: "Phase697",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : "chat_integration_inputs_missing",
  productionReady: false,
  chatIntegrated: passed,
  chatDefaultEnabled: false,
  chatNoFlagRegressionPassed: trial.chatNoFlagRegressionPassed === true,
  chatPreviewFlagPassed: trial.chatPreviewFlagPassed === true,
  chatShadowPassed: trial.chatShadowPassed === true,
  chatRollbackReady: trial.chatRollbackReady === true,
  chatKillSwitchReady: trial.chatKillSwitchReady === true,
});

await writeJson(phaseEvidencePath(697, "chat-integration-seal-result.json"), evidence);
await writePhaseDoc(697, "Chat Integration Seal", evidence);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
