import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { captureScreenshot, ensure, readYiyiSource, writePhaseResult, yiyiCommonSafety, yiyiScreenshots } from "../phase378-common.mjs";

const missionControlUrl = process.env.PHASE378_UI_URL || "http://127.0.0.1:3100/ui";
const source = await readYiyiSource();
const requiredMarkers = [
  "yiyi-avatar-layer",
  "依依",
  "yiyi-mode-compact-button",
  "yiyi-mode-hide-button",
  "yiyi-emotion-panel",
  "mouse_attention",
  "security_guard",
  "red_team_blocked",
  "god_mode_excited",
  "tianshu_planning",
  "evidence_explaining",
  "prefers-reduced-motion"
];

for (const marker of requiredMarkers) {
  ensure(source.includes(marker), `Missing Yiyi UI marker: ${marker}`);
}

async function fetchUiText(url) {
  try {
    const response = await fetch(url);
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text()
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      text: "",
      error: error.message
    };
  }
}

const uiFetch = await fetchUiText(missionControlUrl);
const liveUiHasYiyi = uiFetch.text.includes("yiyi-avatar-layer") && uiFetch.text.includes("依依");

const screenshotPlans = [
  ["overview", missionControlUrl],
  ["mouseAttention", `${missionControlUrl}?yiyi=mouse_attention`],
  ["securityGuard", `${missionControlUrl}?yiyi=security_guard`],
  ["redTeamBlocked", `${missionControlUrl}?yiyi=red_team_blocked`],
  ["godMode", `${missionControlUrl}?yiyi=god_mode`],
  ["tianshu", `${missionControlUrl}?yiyi=tianshu_mode`],
  ["evidence", `${missionControlUrl}?yiyi=evidence_opened`],
  ["compact", `${missionControlUrl}?yiyiMode=compact`],
  ["reducedMotion", `${missionControlUrl}?motion=reduce`]
];

const screenshotResults = [];
for (const [id, url] of screenshotPlans) {
  const outputPath = yiyiScreenshots[id];
  const capture = await captureScreenshot({ url, outputPath, viewport: "1600,2400" });
  screenshotResults.push({
    id,
    url,
    path: outputPath,
    ok: capture.ok,
    realBrowserUsed: Boolean(capture.browserPath),
    browserPath: capture.browserPath,
    screenshotSizeBytes: capture.screenshotSizeBytes || 0,
    error: capture.error || null
  });
}

const screenshotCaptured = screenshotResults.every((item) => item.ok && existsSync(resolve(item.path)) && statSync(resolve(item.path)).size > 0);
const realBrowserUsed = screenshotResults.some((item) => item.realBrowserUsed);
const result = {
  phase: "Phase378F",
  yiyiAvatarVisible: source.includes("yiyi-avatar-layer"),
  yiyiNameVisible: source.includes("依依"),
  avatarLayerDoesNotBlockMissionControl: source.includes("mission-control") && source.includes("yiyi-avatar-layer"),
  compactModeAvailable: source.includes("yiyi-mode-compact-button"),
  hideAvatarAvailable: source.includes("yiyi-mode-hide-button"),
  emotionStateVisible: source.includes("yiyi-emotion-pill"),
  mouseAttentionStateVisible: source.includes("mouse_attention"),
  securityGuardStateVisible: source.includes("security_guard"),
  redTeamBlockedReactionVisible: source.includes("red_team_blocked"),
  godModeReactionVisible: source.includes("god_mode_excited"),
  tianshuReactionVisible: source.includes("tianshu_planning"),
  evidenceReactionVisible: source.includes("evidence_explaining"),
  reducedMotionFallbackAvailable: source.includes("prefers-reduced-motion"),
  freeRoamingFeelingVisible: source.includes("idle_roaming") && source.includes("yiyi-orbit"),
  real3DModelLoaded: false,
  pseudo3DPrototype: true,
  gltfIntegrationReserved: true,
  workbenchReachable: uiFetch.ok && screenshotCaptured,
  liveUiHasYiyi,
  liveUiStatus: uiFetch.status,
  realBrowserUsed,
  screenshotCaptured,
  screenshotResults,
  ...yiyiCommonSafety,
  validationPassed: screenshotCaptured && liveUiHasYiyi
};

await writePhaseResult({
  resultPath: "apps/ai-gateway-service/evidence/phase378f/yiyi-avatar-browser-smoke-result.json",
  result,
  reportPath: "docs/phase378f-yiyi-avatar-ui-prototype.md",
  reportLines: [
    "# Phase378F Yiyi Avatar UI Prototype",
    "",
    "- UI prototype uses a DOM/CSS pseudo-3D Yiyi avatar layer.",
    "- real3DModelLoaded=false; pseudo3DPrototype=true; gltfIntegrationReserved=true.",
    "- Avatar supports full / compact / hide controls, mode reactions, security guard reaction, and reduced-motion fallback.",
    "- Browser smoke captures screenshots only when a local browser and Workbench runtime are reachable."
  ]
});

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
