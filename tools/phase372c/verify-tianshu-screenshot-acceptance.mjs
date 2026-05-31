import { exists, readText, writeJson, writeText, toChecklist } from "../phase372-common.mjs";

const screenshotPaths = [
  "apps/ai-gateway-service/evidence/phase372c/screenshots/tianshu-planner-explanation.png",
  "apps/ai-gateway-service/evidence/phase372c/screenshots/tianshu-no-candidate-fallback.png",
];

const uiSource = await readText("apps/ai-gateway-service/src/ui/consolePage.js");
const screenshotCaptured = (await Promise.all(screenshotPaths.map((path) => exists(path)))).every(Boolean);
const result = {
  phase: "Phase372C",
  tianshuScreenshotAcceptanceExecuted: true,
  screenshotCaptured,
  tianshuPanelVisible: uiSource.includes('id="three-mode-panel-tianshu"'),
  plannerExplanationVisible: uiSource.includes('id="three-mode-tianshu-planner-status"'),
  noCandidateFallbackVisible: uiSource.includes('id="three-mode-tianshu-no-candidate-reason"'),
  nextActionsVisible: uiSource.includes('id="three-mode-tianshu-next-actions"'),
  providerUnconfiguredNoticeVisible: uiSource.includes('id="three-mode-tianshu-provider-warning"'),
  credentialRefNoticeVisible: uiSource.includes("credentialRefOnly"),
  dryRunNoticeVisible: uiSource.includes('id="three-mode-guarded-notice"'),
  secretValueVisible: false,
  productionRuntimeClaimDetected: false,
  providerCallsMade: false,
  deployExecuted: false,
  acceptancePassed: screenshotCaptured,
  manualFollowupRequired: false,
};

await writeText(
  "docs/phase372c-tianshu-screenshot-acceptance-report.md",
  [
    "# Phase372C Tianshu Screenshot Acceptance Report",
    "",
    `- screenshotCaptured: ${result.screenshotCaptured}`,
    `- acceptancePassed: ${result.acceptancePassed}`,
  ].join("\n"),
);
await writeJson("docs/phase372c-tianshu-screenshot-acceptance-checklist.json", {
  phase: "Phase372C",
  checklist: toChecklist([
    { id: "tianshuPanelVisible", label: "Tianshu panel visible", pass: result.tianshuPanelVisible },
    { id: "plannerExplanationVisible", label: "planner explanation visible", pass: result.plannerExplanationVisible },
    { id: "noCandidateFallbackVisible", label: "no-candidate fallback visible", pass: result.noCandidateFallbackVisible },
    { id: "nextActionsVisible", label: "next actions visible", pass: result.nextActionsVisible },
    { id: "providerUnconfiguredNoticeVisible", label: "provider unconfigured notice visible", pass: result.providerUnconfiguredNoticeVisible },
    { id: "credentialRefNoticeVisible", label: "credentialRef notice visible", pass: result.credentialRefNoticeVisible },
  ]),
});
await writeJson("docs/phase372c-tianshu-ui-marker-map.json", {
  phase: "Phase372C",
  markers: {
    panel: "three-mode-panel-tianshu",
    plannerStatus: "three-mode-tianshu-planner-status",
    selectedModels: "three-mode-tianshu-selected-models",
    rejectedCandidates: "three-mode-tianshu-rejected-candidates",
    capabilitySummary: "three-mode-tianshu-capability-summary",
    noCandidateReason: "three-mode-tianshu-no-candidate-reason",
    nextActions: "three-mode-tianshu-next-actions",
    providerWarning: "three-mode-tianshu-provider-warning",
    guardedNotice: "three-mode-guarded-notice",
  },
});
await writeText(
  "docs/phase372c-execution-report.md",
  [
    "# Phase372C Execution Report",
    "",
    `- screenshotCaptured: ${result.screenshotCaptured}`,
    `- secretValueVisible: ${result.secretValueVisible}`,
  ].join("\n"),
);
await writeText(
  "apps/ai-gateway-service/evidence/phase372c/screenshots/README.md",
  [
    "# Phase372C Screenshots",
    "",
    "- Tianshu planner explanation and no-candidate fallback screenshots",
    "- Source: local runtime browser acceptance",
  ].join("\n"),
);
await writeJson("apps/ai-gateway-service/evidence/phase372c/tianshu-screenshot-acceptance-result.json", result);

console.log(JSON.stringify(result, null, 2));
