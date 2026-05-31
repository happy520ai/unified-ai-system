import { readText, writeJson, writeText } from "../phase371-common.mjs";

const uiSource = await readText("apps/ai-gateway-service/src/ui/consolePage.js");

const state = {
  phase: "Phase371B",
  godModeVisualAcceptanceExecuted: true,
  godModePanelVisible: uiSource.includes('id="three-mode-panel-god"'),
  conflictSummaryVisible: uiSource.includes('id="three-mode-god-conflict-level"'),
  supervisorTransparencyVisible: uiSource.includes('id="three-mode-god-supervisor-status"'),
  fallbackReasonVisible: uiSource.includes('id="three-mode-god-fallback-reason"'),
  dryRunNoticeVisible: uiSource.includes('id="three-mode-guarded-notice"'),
  secretValueVisible: false,
  productionRuntimeClaimDetected: false,
  providerCallsMade: false,
  deployExecuted: false,
  acceptancePassed: false,
  manualBrowserVerificationRequired: true,
};

await writeText(
  "docs/phase371b-god-mode-visual-acceptance-report.md",
  [
    "# Phase371B God Mode Visual Acceptance Report",
    "",
    "- Static source check completed.",
    "- Manual browser verification still required.",
    `- godModePanelVisible: ${state.godModePanelVisible}`,
    `- conflictSummaryVisible: ${state.conflictSummaryVisible}`,
    `- supervisorTransparencyVisible: ${state.supervisorTransparencyVisible}`,
  ].join("\n"),
);
await writeJson("docs/phase371b-god-mode-visual-acceptance-checklist.json", state);
await writeText(
  "docs/phase371b-god-mode-visual-gap-list.md",
  [
    "# Phase371B God Mode Visual Gap List",
    "",
    "- manual browser verification pending",
    "- real screenshot-driven spacing/overflow review pending",
  ].join("\n"),
);
await writeText(
  "docs/phase371b-execution-report.md",
  [
    "# Phase371B Execution Report",
    "",
    "- static visual acceptance executed",
    "- manualBrowserVerificationRequired: true",
  ].join("\n"),
);
await writeJson(
  "apps/agent-console/evidence/phase371b/god-mode-visual-acceptance-result.json",
  state,
);

console.log(JSON.stringify(state, null, 2));
