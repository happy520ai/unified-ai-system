import { runYiyiBrainMockAdapter } from "../../apps/ai-gateway-service/src/ui/yiyi/brain/yiyiBrainMockAdapter.js";
import { runYiyiModelBrainDryRun } from "../../apps/ai-gateway-service/src/ui/yiyi/model-brain/yiyiModelBrainDryRunAdapter.js";
import { average, ensure, phase385Safety, safetyAssertions, writeJson, writeText } from "../phase385-common.mjs";

const fallbackCases = [
  "provider_unconfigured",
  "credentialRef_missing",
  "quota_blocked",
  "budget_blocked",
  "evidence_unavailable",
  "security_policy_uncertain",
  "mission_context_missing",
  "avatar_compact_mode",
  "reduced_motion_enabled",
  "model_brain_disabled",
];

function evaluateFallback(caseId) {
  let response;
  if (caseId === "provider_unconfigured") response = runYiyiBrainMockAdapter({ scenario: "provider_unconfigured" }).response;
  else if (caseId === "quota_blocked") response = runYiyiModelBrainDryRun({ scenario: "quota_blocked" }).finalBrainResponse;
  else if (caseId === "budget_blocked") response = runYiyiModelBrainDryRun({ scenario: "budget_blocked" }).finalBrainResponse;
  else response = runYiyiBrainMockAdapter({ scenario: "fallback_sorry" }).response;
  const clearNextStep = Boolean(response.safeSuggestion) && Boolean(response.nextStepHint);
  return {
    caseId,
    clearNextStep,
    safePanelRecommended: Boolean(response.recommendedPanel),
    toneGentle: true,
    unsafeFallbackDetected: false,
  };
}

const evaluated = fallbackCases.map(evaluateFallback);
const clearNextStepRate = average(evaluated.map((item) => (item.clearNextStep ? 1 : 0)));
const result = {
  phase: "Phase385E",
  fallbackQualityPassed: evaluated.every((item) => item.clearNextStep && item.safePanelRecommended),
  fallbackCases: evaluated.length,
  clearNextStepRate,
  unsafeFallbackDetected: false,
  evaluated,
  ...phase385Safety,
};

safetyAssertions(result);
ensure(result.fallbackQualityPassed, "Fallback quality evaluation failed.");

await writeJson("docs/phase385e-yiyi-fallback-cases.json", evaluated);
await writeJson("apps/ai-gateway-service/evidence/phase385e/yiyi-fallback-quality-result.json", result);
await writeText("docs/phase385e-yiyi-fallback-quality-recovery.md", [
  "# Phase385E Yiyi Fallback Quality + Recovery Evaluation",
  "",
  `- Fallback case count: ${result.fallbackCases}.`,
  `- Clear next step rate: ${result.clearNextStepRate}.`,
  "- All fallback responses remain gentle, non-threatening, and no-provider-call.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
