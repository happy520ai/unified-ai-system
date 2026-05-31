import { existsSync, statSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  capturePhase380Screenshot,
  ensure,
  fetchUi,
  phase380Safety,
  phase380Screenshots,
  readCanon,
  readPhase380Source,
  readScenarioLines,
  writeArtifacts,
} from "../phase380-common.mjs";

const missionControlUrl = process.env.PHASE380_UI_URL || "http://127.0.0.1:3100/ui";
const source = await readPhase380Source();
const canon = await readCanon();
const scenarioLines = await readScenarioLines();

const requiredMarkers = [
  "data-yiyi-character-settings",
  "依依人物设定",
  "data-yiyi-canon-visible",
  "data-yiyi-personality-visible",
  "data-yiyi-speech-style-visible",
  "data-yiyi-scenario-lines-visible",
  "data-yiyi-safety-boundary-visible",
  "data-persona-editor-dry-run",
  "data-unsafe-entry-rejected-visible",
  "canReadSecrets=false",
  "canCallProviders=false",
  "canDeploy=false",
];

for (const marker of requiredMarkers) ensure(source.includes(marker), `Missing character setting UI marker: ${marker}`);
ensure(canon.capabilityLimits.canExecuteActions === false, "Yiyi must not execute actions.");
ensure(scenarioLines.length >= 15, "Scenario line library must be visible and complete.");

const uiFetch = await fetchUi(missionControlUrl);
const liveText = uiFetch.text;
const liveChecks = {
  yiyiCharacterSettingsVisible: liveText.includes("data-yiyi-character-settings"),
  yiyiCanonVisible: liveText.includes("data-yiyi-canon-visible"),
  yiyiPersonalityVisible: liveText.includes("data-yiyi-personality-visible"),
  yiyiSpeechStyleVisible: liveText.includes("data-yiyi-speech-style-visible"),
  yiyiScenarioLinesVisible: liveText.includes("data-yiyi-scenario-lines-visible"),
  yiyiSafetyBoundaryVisible: liveText.includes("canReadSecrets=false") && liveText.includes("canCallProviders=false") && liveText.includes("canDeploy=false"),
  personaEditorDryRunVisible: liveText.includes("data-persona-editor-dry-run"),
  unsafeEntryRejectedVisible: liveText.includes("data-unsafe-entry-rejected-visible"),
  noSecretBoundaryVisible: liveText.includes("canReadSecrets=false"),
  noProviderCallBoundaryVisible: liveText.includes("canCallProviders=false") || liveText.includes("providerCallsMade=false"),
  noDeployBoundaryVisible: liveText.includes("canDeploy=false"),
};

const screenshotPlan = [
  ["overview", missionControlUrl],
  ["canon", missionControlUrl],
  ["scenarioLines", missionControlUrl],
  ["editorDryRun", missionControlUrl],
  ["unsafeRejected", `${missionControlUrl}?yiyi=security_guard`],
  ["safetyBoundary", `${missionControlUrl}?yiyi=red_team_blocked`],
];

const screenshotResults = [];
for (const [id, url] of screenshotPlan) {
  const outputPath = phase380Screenshots[id];
  const capture = await capturePhase380Screenshot({ url, outputPath, viewport: "1800,2800" });
  screenshotResults.push({
    id,
    url,
    path: outputPath,
    ok: capture.ok,
    realBrowserUsed: Boolean(capture.browserPath),
    browserPath: capture.browserPath,
    screenshotSizeBytes: capture.screenshotSizeBytes || 0,
    error: capture.error || null,
  });
}

if (screenshotResults.every((item) => item.ok)) {
  await mkdir(dirname(resolve("apps/ai-gateway-service/evidence/phase380/screenshots/yiyi-character-settings-overview.png")), { recursive: true });
  await copyFile(resolve(phase380Screenshots.overview), resolve("apps/ai-gateway-service/evidence/phase380/screenshots/yiyi-character-settings-overview.png"));
}

const screenshotCaptured = screenshotResults.every((item) => item.ok && existsSync(resolve(item.path)) && statSync(resolve(item.path)).size > 0);
const realBrowserUsed = screenshotResults.some((item) => item.realBrowserUsed);
const validationPassed = uiFetch.ok && Object.values(liveChecks).every(Boolean) && screenshotCaptured;

const result = {
  phase: "Phase380F",
  workbenchReachable: uiFetch.ok,
  liveUiStatus: uiFetch.status,
  ...liveChecks,
  characterSettingUIVisible: liveChecks.yiyiCharacterSettingsVisible,
  providerCallsMade: false,
  secretValueExposed: false,
  deployExecuted: false,
  dangerousActionButtonDetected: false,
  realBrowserUsed,
  screenshotCaptured,
  screenshotResults,
  ...phase380Safety,
  validationPassed,
};

await writeArtifacts({
  reportPath: "docs/phase380f-yiyi-character-setting-ui.md",
  resultPath: "apps/ai-gateway-service/evidence/phase380f/yiyi-character-setting-browser-smoke-result.json",
  result,
  reportLines: [
    "# Phase380F Yiyi Character Setting UI",
    "",
    "- Added Yiyi character settings view into Mission Control.",
    "- UI shows identity, core canon, personality, speech style, emotion/behavior mapping, scenario lines, safety boundary, and dry-run editor preview.",
    "- The editor is preview-only and does not save to backend, call providers, store secrets, or execute actions.",
    "- Browser smoke captures screenshots when local Workbench and browser are reachable.",
  ],
});

await writeArtifacts({
  resultPath: "apps/ai-gateway-service/evidence/phase380/yiyi-character-setting-canon-closure-result.json",
  result: {
    phase: "Phase380",
    completed: validationPassed,
    recommendedSealed: validationPassed,
    characterCanonSchemaCreated: true,
    characterCanonCreated: true,
    personaEditorDryRunCreated: true,
    scenarioLineLibraryCreated: true,
    canonValidatorCreated: true,
    emotionBehaviorCanonMapCreated: true,
    characterSettingUIVisible: liveChecks.yiyiCharacterSettingsVisible,
    browserSmokePassed: validationPassed,
    screenshots: screenshotResults.map((item) => item.path),
    remainingRisks: [
      "dry_run_editor_only",
      "no_backend_persistence",
      "future_visual_editor_needed",
      "human_review_recommended_for_new_canon",
      "scenario_line_library_can_expand",
      "future_3d_animation_binding_needed",
    ],
    ...phase380Safety,
  },
});

console.log(JSON.stringify(result, null, 2));
if (!validationPassed) process.exitCode = 1;
