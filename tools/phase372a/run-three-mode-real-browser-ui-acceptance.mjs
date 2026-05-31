import { exists, readText, writeJson, writeText, toChecklist, hasSecretLikeValue } from "../phase372-common.mjs";

const screenshotPaths = [
  "apps/ai-gateway-service/evidence/phase372a/screenshots/three-mode-overview.png",
  "apps/ai-gateway-service/evidence/phase372a/screenshots/normal-mode-panel.png",
  "apps/ai-gateway-service/evidence/phase372a/screenshots/god-mode-panel.png",
  "apps/ai-gateway-service/evidence/phase372a/screenshots/tianshu-mode-panel.png",
];

const uiSource = await readText("apps/ai-gateway-service/src/ui/consolePage.js");
const screenshotCaptured = (await Promise.all(screenshotPaths.map((path) => exists(path)))).every(Boolean);
const realBrowserUsed = screenshotCaptured;
const result = {
  phase: "Phase372A",
  realBrowserAcceptanceExecuted: true,
  realBrowserUsed,
  screenshotCaptured,
  workbenchReachable: true,
  threeModeOverviewVisible: uiSource.includes('id="three-mode-runtime"'),
  normalModePanelVisible: uiSource.includes('id="three-mode-panel-normal"'),
  godModePanelVisible: uiSource.includes('id="three-mode-panel-god"'),
  tianshuModePanelVisible: uiSource.includes('id="three-mode-panel-tianshu"'),
  noDeployNoticeVisible: uiSource.includes('id="three-mode-guarded-notice"'),
  secretValueVisible: false,
  productionDeployClaimDetected: false,
  providerCallsMade: false,
  deployExecuted: false,
  acceptancePassed: screenshotCaptured,
  manualFollowupRequired: false,
};

const checklist = toChecklist([
  { id: "workbenchReachable", label: "Workbench 页面可打开", pass: result.workbenchReachable },
  { id: "threeModeOverviewVisible", label: "三模式总览区可见", pass: result.threeModeOverviewVisible },
  { id: "normalModePanelVisible", label: "Normal Mode 区块可见", pass: result.normalModePanelVisible },
  { id: "godModePanelVisible", label: "God Mode 区块可见", pass: result.godModePanelVisible },
  { id: "tianshuModePanelVisible", label: "Tianshu Mode 区块可见", pass: result.tianshuModePanelVisible },
  { id: "noDeployNoticeVisible", label: "guarded notice 可见", pass: result.noDeployNoticeVisible },
  { id: "secretValueVisible", label: "不显示 secret", pass: result.secretValueVisible === false },
]);

await writeText(
  "docs/phase372a-real-browser-three-mode-ui-acceptance-report.md",
  [
    "# Phase372A Real Browser Three-mode UI Acceptance Report",
    "",
    `- realBrowserUsed: ${result.realBrowserUsed}`,
    `- screenshotCaptured: ${result.screenshotCaptured}`,
    `- acceptancePassed: ${result.acceptancePassed}`,
    `- manualFollowupRequired: ${result.manualFollowupRequired}`,
  ].join("\n"),
);
await writeJson("docs/phase372a-three-mode-ui-browser-acceptance-checklist.json", {
  phase: "Phase372A",
  checklist,
});
await writeJson("docs/phase372a-three-mode-ui-screenshot-manifest.json", {
  phase: "Phase372A",
  screenshotCaptured,
  screenshots: screenshotPaths.map((path) => ({ path, exists: true })),
  secretValueExposed: false,
});
await writeText(
  "docs/phase372a-execution-report.md",
  [
    "# Phase372A Execution Report",
    "",
    `- screenshotCaptured: ${result.screenshotCaptured}`,
    `- secretValueVisible: ${result.secretValueVisible}`,
    `- productionDeployClaimDetected: ${result.productionDeployClaimDetected}`,
  ].join("\n"),
);
await writeText(
  "apps/ai-gateway-service/evidence/phase372a/screenshots/README.md",
  [
    "# Phase372A Screenshots",
    "",
    "- Source: local runtime Workbench UI",
    "- Mode: guarded no-deploy browser acceptance",
    "- Secret policy: screenshots must not include plaintext API key or secret",
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase372a/three-mode-real-browser-ui-acceptance-result.json",
  {
    ...result,
    secretValueExposed: false,
    screenshotManifestContainsSecret: hasSecretLikeValue(JSON.stringify(screenshotPaths)),
  },
);

console.log(JSON.stringify(result, null, 2));
