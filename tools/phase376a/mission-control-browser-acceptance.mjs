import { readText } from "../phase373-common.mjs";
import { captureWithHeadlessBrowser, commonSafetyFlags, cropScreenshot, missionControlUrl, sourceChecks, writePhaseDocs } from "../phase376-shared.mjs";

const screenshotDir = "apps/ai-gateway-service/evidence/phase376a/screenshots";
const overviewPath = `${screenshotDir}/mission-control-overview.png`;
const url = `${missionControlUrl}?ts=phase376a`;
const source = await readText("apps/ai-gateway-service/src/ui/consolePage.js")
  + await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
const checks = sourceChecks(source);
const capture = await captureWithHeadlessBrowser({ url, outputPath: overviewPath, viewport: "1600,2600" });

const crops = [
  ["top-system-radar.png", { left: 240, top: 102, width: 1320, height: 560 }],
  ["god-mode-arena.png", { left: 260, top: 468, width: 990, height: 76 }],
  ["tianshu-flight-path.png", { left: 260, top: 538, width: 990, height: 98 }],
  ["security-shield.png", { left: 1266, top: 211, width: 282, height: 436 }],
  ["red-team-playground.png", { left: 254, top: 659, width: 1293, height: 98 }],
  ["evidence-timeline.png", { left: 255, top: 766, width: 1290, height: 57 }],
  ["provider-credentialref-only.png", { left: 973, top: 101, width: 575, height: 95 }],
  ["dry-run-boundary.png", { left: 974, top: 159, width: 241, height: 35 }],
  ["blocked-action-boundary.png", { left: 1231, top: 418, width: 291, height: 156 }],
];
if (capture.ok) {
  for (const [name, box] of crops) {
    await cropScreenshot(overviewPath, `${screenshotDir}/${name}`, box);
  }
}

const result = {
  phase: "Phase376A",
  workbenchReachable: capture.ok,
  realBrowserUsed: capture.ok,
  screenshotCaptured: capture.ok,
  screenshotPaths: capture.ok
    ? [overviewPath, ...crops.map(([name]) => `${screenshotDir}/${name}`)]
    : [],
  browserPath: capture.browserPath,
  browserError: capture.ok ? null : capture.error,
  ...checks,
  ...commonSafetyFlags(),
  providerCallsMade: false,
  deployExecuted: false,
  acceptancePassed: capture.ok
    && checks.missionControlVisible
    && checks.topSystemRadarVisible
    && checks.normalModeVisible
    && checks.godModeArenaVisible
    && checks.tianshuFlightPathVisible
    && checks.securityShieldVisible
    && checks.redTeamPlaygroundVisible
    && checks.evidenceTimelineVisible
    && checks.credentialRefOnlyVisible
    && checks.dryRunBoundaryVisible
    && checks.noProviderCallVisible
    && !checks.secretValueVisible
    && !checks.dangerousActionButtonDetected
    && !checks.productionDeployClaimDetected,
};

await writePhaseDocs({
  resultPath: "apps/ai-gateway-service/evidence/phase376a/mission-control-browser-acceptance-result.json",
  result,
  reportPath: "docs/phase376a-real-browser-screenshot-acceptance.md",
  reportLines: [
    "# Phase376A Real Browser Screenshot Acceptance",
    "",
    `- workbenchReachable: ${result.workbenchReachable}`,
    `- realBrowserUsed: ${result.realBrowserUsed}`,
    `- screenshotCaptured: ${result.screenshotCaptured}`,
    `- missionControlVisible: ${result.missionControlVisible}`,
    `- dangerousActionButtonDetected: ${result.dangerousActionButtonDetected}`,
    `- productionDeployClaimDetected: ${result.productionDeployClaimDetected}`,
    `- browserPath: ${result.browserPath || "missing"}`,
    `- browserError: ${result.browserError || "none"}`,
    "",
    "Screenshots:",
    ...result.screenshotPaths.map((path) => `- ${path}`),
  ],
});

console.log(JSON.stringify(result, null, 2));
if (!result.acceptancePassed) process.exitCode = 1;
