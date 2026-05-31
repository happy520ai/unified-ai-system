import {
  ensure,
  fileInfo,
  makePhase387Result,
  phase387QaMatrix,
  phase387Safety,
  readText,
  writeJson,
  writeText,
} from "../phase387-common.mjs";
import { captureWithHeadlessBrowser } from "../phase376-shared.mjs";

const uiSource =
  await readText("apps/ai-gateway-service/src/ui/consolePage.js") +
  await readText("apps/ai-gateway-service/src/ui/components/YiyiGuidedShowcasePanel.js") +
  await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js") +
  await readText("apps/ai-gateway-service/src/ui/components/YiyiBrainPanel.js");

for (const marker of phase387QaMatrix.requiredMarkers) {
  ensure(uiSource.includes(marker), `Missing required marker: ${marker}`);
}
for (const forbidden of ["Deploy Now", "Release Now", "Call Provider Now", "Read Secret", "Generate Invoice", "Bypass Approval"]) {
  ensure(!uiSource.includes(forbidden), `Forbidden action copy detected: ${forbidden}`);
}

const screenshotPath = "apps/ai-gateway-service/evidence/phase387/screenshots/yiyi-phase387-overview-desktop.png";
const capture = await captureWithHeadlessBrowser({
  url: "http://127.0.0.1:3100/ui",
  outputPath: screenshotPath,
  viewport: "1680,3200",
});
ensure(capture.ok, `Phase387 desktop capture failed: ${capture.error || "unknown"}`);

await writeJson("docs/phase387a-yiyi-visual-polish-cross-browser-qa-matrix.json", phase387QaMatrix);
await writeText(
  "docs/phase387a-yiyi-visual-polish-cross-browser-qa.md",
  [
    "# Phase387A Yiyi Visual Polish + Cross-browser QA",
    "",
    "Phase387 focuses on low-risk visual polish and cross-browser QA preparation only.",
    "",
    "Scope:",
    "- guided showcase readability and presentation quality",
    "- desktop/tablet/mobile viewport checklist",
    "- Chrome/Edge local review matrix",
    "- no provider call, no secret, no deploy",
    "",
    `Desktop smoke screenshot: ${screenshotPath}`,
  ].join("\n"),
);

const screenshotInfo = fileInfo(screenshotPath);
const result = makePhase387Result({
  phase: "Phase387A",
  visualPolishQaCreated: true,
  crossBrowserQaPrepared: true,
  desktopSmokeScreenshotCaptured: screenshotInfo.exists && screenshotInfo.sizeBytes > 0,
  viewportTargets: phase387QaMatrix.viewportTargets,
  ...phase387Safety,
});

await writeJson("apps/ai-gateway-service/evidence/phase387a/yiyi-visual-polish-cross-browser-qa-result.json", result);
console.log(JSON.stringify(result, null, 2));
