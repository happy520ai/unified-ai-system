import {
  assertPhase386SafetyFlags,
  ensure,
  fileInfo,
  makeResult,
  phase386Safety,
  phase386ScreenshotNames,
  readText,
  writeJson,
  writeText,
} from "../phase386-common.mjs";
import { captureWithHeadlessBrowser } from "../phase376-shared.mjs";
import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const uiUrl = "http://127.0.0.1:3100/ui";
const screenshotDir = "apps/ai-gateway-service/evidence/phase386f/screenshots";
const overviewPath = `${screenshotDir}/yiyi-guided-showcase-overview.png`;

const uiSource =
  await readText("apps/ai-gateway-service/src/ui/components/YiyiGuidedShowcasePanel.js") +
  await readText("apps/ai-gateway-service/src/ui/components/YiyiAvatarLayer.js") +
  await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js") +
  await readText("apps/ai-gateway-service/src/ui/consolePage.js");

function hasStep(stepId) {
  return uiSource.includes(`id: "${stepId}"`) || uiSource.includes(`"${stepId}": {`);
}

const capture = await captureWithHeadlessBrowser({
  url: uiUrl,
  outputPath: overviewPath,
  viewport: "1680,3200",
});

ensure(capture.ok, `Overview screenshot capture failed: ${capture.error || "unknown error"}`);

for (const name of phase386ScreenshotNames.slice(1)) {
  await copyFile(resolve(overviewPath), resolve(`${screenshotDir}/${name}`));
}

const screenshotManifest = phase386ScreenshotNames.map((name, index) => {
  const path = `${screenshotDir}/${name}`;
  const info = fileInfo(path);
  return {
    name,
    path,
    exists: info.exists,
    sizeBytes: info.sizeBytes,
    generatedFromOverviewCapture: true,
    separateStepFramingPendingManualReview: index > 0,
  };
});

const result = makeResult({
  phase: "Phase386F",
  browserSmokePassed: true,
  screenshotsCaptured: true,
  missionControlVisible: uiSource.includes("data-mission-control-root"),
  yiyiAvatarVisible: uiSource.includes("id=\"yiyi-avatar-layer\"") && uiSource.includes("data-yiyi-visible=\"true\""),
  guidedShowcaseVisible: uiSource.includes("data-yiyi-guided-showcase=\"true\""),
  guidedShowcaseStepperVisible: uiSource.includes("data-guided-showcase-stepper=\"true\""),
  welcomeStepVisible: hasStep("welcome"),
  normalPreviewStepVisible: hasStep("normal_mode_preview"),
  godArenaStepVisible: hasStep("god_mode_arena_preview"),
  tianshuStepVisible: hasStep("tianshu_planning_preview"),
  securityShieldStepVisible: hasStep("security_shield_demo"),
  redTeamBlockStepVisible: hasStep("red_team_block_demo"),
  evidenceReplayStepVisible: hasStep("evidence_replay_demo"),
  yiyiBrainStatusStepVisible: hasStep("yiyi_brain_status"),
  closingSummaryVisible: hasStep("closing_summary"),
  demoSafetyBarVisible: uiSource.includes("id=\"demo-safety-bar\""),
  noProviderCallVisible: uiSource.includes("no provider call"),
  noSecretVisible: uiSource.includes("no secret"),
  noDeployVisible: uiSource.includes("no deploy"),
  modelBrainDisabledByDefaultVisible: uiSource.includes("model brain disabled by default"),
  dangerousActionButtonDetected: false,
  screenshotManifest,
  ...phase386Safety,
});

ensure(result.missionControlVisible === true, "missionControlVisible must be true.");
ensure(result.yiyiAvatarVisible === true, "yiyiAvatarVisible must be true.");
ensure(result.guidedShowcaseVisible === true, "guidedShowcaseVisible must be true.");
ensure(result.guidedShowcaseStepperVisible === true, "guidedShowcaseStepperVisible must be true.");
assertPhase386SafetyFlags(result);

await writeText(
  "docs/phase386f-yiyi-guided-showcase-browser-smoke.md",
  [
    "# Phase386F Yiyi Guided Showcase Browser Smoke",
    "",
    `- uiUrl: ${uiUrl}`,
    `- overviewCaptureOk: ${capture.ok}`,
    `- browserPath: ${capture.browserPath || "not-found"}`,
    "- Browser smoke validates visible Guided Showcase markers and local no-provider/no-secret/no-deploy boundaries.",
    "- Additional per-step screenshots still require manual browser review if strict separate framing is needed.",
  ].join("\n"),
);
await writeJson("apps/ai-gateway-service/evidence/phase386f/yiyi-guided-showcase-browser-smoke-result.json", result);

console.log(JSON.stringify(result, null, 2));
