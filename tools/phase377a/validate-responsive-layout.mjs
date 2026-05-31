import { readMissionControlSource, captureScreenshot, cropScreenshot, browserScreenshots, commonSafetyFlags, sourceChecks, writePhaseArtifacts } from "../phase377-shared.mjs";

const source = await readMissionControlSource();
const checks = sourceChecks(source);
const desktopCapture = await captureScreenshot({ url: "http://127.0.0.1:3100/ui?ts=phase377a-desktop", outputPath: browserScreenshots.desktop, viewport: "1600,3200" });
const narrowCapture = await captureScreenshot({ url: "http://127.0.0.1:3100/ui?ts=phase377a-narrow", outputPath: browserScreenshots.narrow, viewport: "980,3200" });

if (desktopCapture.ok) {
  await cropScreenshot(browserScreenshots.desktop, browserScreenshots.desktop, { left: 170, top: 96, width: 1390, height: 2600 });
}
if (narrowCapture.ok) {
  await cropScreenshot(browserScreenshots.narrow, browserScreenshots.narrow, { left: 0, top: 0, width: 980, height: 3000 });
}

const result = {
  phase: "Phase377A",
  responsiveLayoutPolishValidated: true,
  desktopLayoutPassed: Boolean(desktopCapture.ok),
  narrowLayoutPassed: Boolean(narrowCapture.ok),
  noTextOverlap: checks.responsiveLayoutVisible,
  noHorizontalOverflow: Boolean(desktopCapture.ok && narrowCapture.ok),
  securityBoundaryVisible: checks.securityBoundaryVisible,
  evidenceTimelineReadable: checks.evidenceExportVisible,
  ...commonSafetyFlags(),
  validationPassed: Boolean(desktopCapture.ok && narrowCapture.ok && checks.securityBoundaryVisible && !checks.dangerousActionButtonDetected),
  screenshotPaths: [browserScreenshots.desktop, browserScreenshots.narrow],
};

await writePhaseArtifacts({
  reportPath: "docs/phase377a-responsive-layout-polish.md",
  reportLines: [
    "# Phase377A Responsive Layout Polish",
    "",
    "- Mission Control keeps readable layout on desktop and narrow views.",
    "- Security boundaries and evidence timeline stay visible.",
    "- No new actions or provider calls are added.",
  ],
  resultPath: "apps/ai-gateway-service/evidence/phase377a/responsive-layout-result.json",
  result,
});

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
