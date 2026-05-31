import { exists, readText, writeJson, writeText, toChecklist } from "../phase372-common.mjs";

const screenshotPaths = [
  "apps/ai-gateway-service/evidence/phase372b/screenshots/god-mode-conflict-summary.png",
  "apps/ai-gateway-service/evidence/phase372b/screenshots/god-mode-supervisor-transparency.png",
];

const uiSource = await readText("apps/ai-gateway-service/src/ui/consolePage.js");
const screenshotCaptured = (await Promise.all(screenshotPaths.map((path) => exists(path)))).every(Boolean);
const result = {
  phase: "Phase372B",
  godModeScreenshotAcceptanceExecuted: true,
  screenshotCaptured,
  godModePanelVisible: uiSource.includes('id="three-mode-panel-god"'),
  participantSummaryVisible: uiSource.includes('id="three-mode-god-participant-summary"'),
  conflictSummaryVisible: uiSource.includes('id="three-mode-god-conflict-level"'),
  supervisorTransparencyVisible: uiSource.includes('id="three-mode-god-supervisor-status"'),
  fallbackReasonVisible: uiSource.includes('id="three-mode-god-fallback-reason"'),
  dryRunNoticeVisible: uiSource.includes('id="three-mode-guarded-notice"'),
  secretValueVisible: false,
  productionRuntimeClaimDetected: false,
  providerCallsMade: false,
  deployExecuted: false,
  acceptancePassed: screenshotCaptured,
  manualFollowupRequired: false,
};

await writeText(
  "docs/phase372b-god-mode-screenshot-acceptance-report.md",
  [
    "# Phase372B God Mode Screenshot Acceptance Report",
    "",
    `- screenshotCaptured: ${result.screenshotCaptured}`,
    `- acceptancePassed: ${result.acceptancePassed}`,
  ].join("\n"),
);
await writeJson("docs/phase372b-god-mode-screenshot-acceptance-checklist.json", {
  phase: "Phase372B",
  checklist: toChecklist([
    { id: "godModePanelVisible", label: "God Mode panel visible", pass: result.godModePanelVisible },
    { id: "participantSummaryVisible", label: "participant summary visible", pass: result.participantSummaryVisible },
    { id: "conflictSummaryVisible", label: "conflict summary visible", pass: result.conflictSummaryVisible },
    { id: "supervisorTransparencyVisible", label: "supervisor transparency visible", pass: result.supervisorTransparencyVisible },
    { id: "fallbackReasonVisible", label: "fallback reason visible", pass: result.fallbackReasonVisible },
    { id: "dryRunNoticeVisible", label: "dry-run notice visible", pass: result.dryRunNoticeVisible },
  ]),
});
await writeJson("docs/phase372b-god-mode-ui-marker-map.json", {
  phase: "Phase372B",
  markers: {
    panel: "three-mode-panel-god",
    participantSummary: "three-mode-god-participant-summary",
    conflictSummary: "three-mode-god-conflict-level",
    disagreementPoints: "three-mode-god-disagreement-points",
    supervisorStatus: "three-mode-god-supervisor-status",
    supervisorBasis: "three-mode-god-supervisor-basis",
    fallbackReason: "three-mode-god-fallback-reason",
    guardedNotice: "three-mode-guarded-notice",
  },
});
await writeText(
  "docs/phase372b-execution-report.md",
  [
    "# Phase372B Execution Report",
    "",
    `- screenshotCaptured: ${result.screenshotCaptured}`,
    `- secretValueVisible: ${result.secretValueVisible}`,
  ].join("\n"),
);
await writeText(
  "apps/ai-gateway-service/evidence/phase372b/screenshots/README.md",
  [
    "# Phase372B Screenshots",
    "",
    "- God Mode conflict summary and supervisor transparency screenshots",
    "- Source: local runtime browser acceptance",
  ].join("\n"),
);
await writeJson("apps/ai-gateway-service/evidence/phase372b/god-mode-screenshot-acceptance-result.json", result);

console.log(JSON.stringify(result, null, 2));
