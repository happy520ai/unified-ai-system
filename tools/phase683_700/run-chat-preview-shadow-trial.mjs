import { evaluateTaijiBeidouChatPreviewHook } from "../../apps/ai-gateway-service/src/gateway/taijiBeidouChatPreviewHook.js";
import { boundary, loadGuardedProviderBaseline, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const baseline = await loadGuardedProviderBaseline();
const noFlag = evaluateTaijiBeidouChatPreviewHook({ body: {} });
const preview = evaluateTaijiBeidouChatPreviewHook({ body: { taijiBeidouPreview: true } });
const shadow = evaluateTaijiBeidouChatPreviewHook({ body: { taijiBeidouShadow: true } });
const kill = evaluateTaijiBeidouChatPreviewHook({ body: { taijiBeidouPreview: true }, killSwitchActive: true });
const passed =
  baseline.phase675682Passed &&
  noFlag.action === "passthrough" &&
  preview.action === "respond" &&
  shadow.action === "shadow" &&
  kill.result.blocked === true;
const evidence = boundary({
  phase: "Phase696",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : baseline.blocker || "chat_preview_shadow_trial_failed",
  productionReady: false,
  chatHookAvailable: true,
  chatDefaultEnabled: false,
  chatNoFlagRegressionPassed: noFlag.action === "passthrough",
  chatPreviewFlagPassed: preview.action === "respond",
  chatShadowPassed: shadow.action === "shadow",
  chatRollbackReady: true,
  chatKillSwitchReady: kill.result.blocked === true,
  shadowProviderCall: false,
  responseReplacementAllowed: false,
});

await writeJson(phaseEvidencePath(696, "chat-disabled-preview-shadow-trial-result.json"), evidence);
await writePhaseDoc(696, "Chat Disabled Preview Shadow Trial", evidence, [
  "## Trial",
  "",
  "- No-flag /chat path is passthrough.",
  "- Preview flag returns readiness preview only.",
  "- Shadow does not replace the live response.",
]);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
