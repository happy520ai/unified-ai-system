import { readText, writeJson, writeText } from "../phase371-common.mjs";

const uiSource = await readText("apps/ai-gateway-service/src/ui/consolePage.js");

const state = {
  phase: "Phase371C",
  tianshuVisualAcceptanceExecuted: true,
  tianshuPanelVisible: uiSource.includes('id="three-mode-panel-tianshu"'),
  plannerExplanationVisible: uiSource.includes('id="three-mode-tianshu-planner-status"'),
  noCandidateFallbackVisible: uiSource.includes('id="three-mode-tianshu-no-candidate-reason"'),
  nextActionsVisible: uiSource.includes('id="three-mode-tianshu-next-actions"'),
  dryRunNoticeVisible: uiSource.includes('id="three-mode-guarded-notice"'),
  secretValueVisible: false,
  productionRuntimeClaimDetected: false,
  providerCallsMade: false,
  deployExecuted: false,
  acceptancePassed: false,
  manualBrowserVerificationRequired: true,
};

await writeText(
  "docs/phase371c-tianshu-visual-acceptance-report.md",
  [
    "# Phase371C Tianshu Visual Acceptance Report",
    "",
    "- Static source check completed.",
    "- Manual browser verification still required.",
    `- tianshuPanelVisible: ${state.tianshuPanelVisible}`,
    `- plannerExplanationVisible: ${state.plannerExplanationVisible}`,
    `- noCandidateFallbackVisible: ${state.noCandidateFallbackVisible}`,
  ].join("\n"),
);
await writeJson("docs/phase371c-tianshu-visual-acceptance-checklist.json", state);
await writeText(
  "docs/phase371c-tianshu-visual-gap-list.md",
  [
    "# Phase371C Tianshu Visual Gap List",
    "",
    "- manual browser verification pending",
    "- real screenshot-driven hierarchy/readability review pending",
  ].join("\n"),
);
await writeText(
  "docs/phase371c-execution-report.md",
  [
    "# Phase371C Execution Report",
    "",
    "- static visual acceptance executed",
    "- manualBrowserVerificationRequired: true",
  ].join("\n"),
);
await writeJson(
  "apps/agent-console/evidence/phase371c/tianshu-visual-acceptance-result.json",
  state,
);

console.log(JSON.stringify(state, null, 2));
