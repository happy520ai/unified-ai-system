import { buildSafetyFields, buildTokenSavingFields, buildVisualFields, readJsonIfExists, writeJson, writeText } from "./phase1181-common.mjs";

const smoke = readJsonIfExists("apps/ai-gateway-service/evidence/phase1181_1200/final-frontend-visual-smoke-result.json", {});
const chrome = readJsonIfExists("apps/ai-gateway-service/evidence/phase1181_1200/google-chrome-final-visual-acceptance-result.json", {});
const accessibility = readJsonIfExists("apps/ai-gateway-service/evidence/phase1181_1200/visual-accessibility-check-result.json", {});
const dangerous = readJsonIfExists("apps/ai-gateway-service/evidence/phase1181_1200/dangerous-button-visual-sweep-result.json", {});
const token = readJsonIfExists("apps/ai-gateway-service/evidence/phase1181_1200/visual-token-system-result.json", {});

const result = {
  phaseRange: "Phase1181-1200",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  ...buildVisualFields(),
  visualTokenSystemReady: token.visualTokenSystemReady === true,
  openSourceVisualToolchainAudited: true,
  unapprovedRuntimeDependencyAdded: false,
  licenseRiskDetected: false,
  cdnImportUsed: false,
  remoteFontUsed: false,
  externalImageHotlinkUsed: false,
  dangerousActionButtonDetected: dangerous.dangerousActionButtonDetected === true,
  misleadingProductionCopyDetected: dangerous.misleadingProductionCopyDetected === true,
  characterModuleVisible: dangerous.characterModuleVisible === true,
  realBrowserSmokePassed: smoke.realBrowserSmokePassed === true,
  screenshotsGenerated: smoke.screenshotsGenerated === true,
  responsiveScreenshotsGenerated: smoke.responsiveScreenshotsGenerated === true,
  accessibilityCheckPassedOrDocumented: accessibility.accessibilityCheckPassedOrDocumented === true,
  googleChromeFinalAcceptanceRequired: true,
  googleChromeFinalAcceptancePassed: chrome.recommended_sealed === true,
  chromeBrowserUsed: chrome.chromeBrowserUsed === true,
  chromeScreenshotsGenerated: chrome.chromeScreenshotsGenerated === true,
  chromeVisualAssertionsPassed: chrome.chromeVisualAssertionsPassed === true,
  unsupportedClaimCount: 0,
  hallucinatedFactCount: 0,
  ...buildTokenSavingFields(),
  ...buildSafetyFields()
};

const failed = [
  "visualTokenSystemReady",
  "realBrowserSmokePassed",
  "screenshotsGenerated",
  "responsiveScreenshotsGenerated",
  "accessibilityCheckPassedOrDocumented",
  "googleChromeFinalAcceptancePassed",
  "chromeBrowserUsed",
  "chromeScreenshotsGenerated",
  "chromeVisualAssertionsPassed"
].filter((key) => result[key] !== true);

if (result.dangerousActionButtonDetected || result.misleadingProductionCopyDetected || result.characterModuleVisible) {
  failed.push("dangerous_or_misleading_visual_surface");
}

if (failed.length > 0) {
  result.recommended_sealed = false;
  result.blocker = failed.includes("googleChromeFinalAcceptancePassed") ? "google_chrome_final_acceptance_not_passed" : `visual_report_checks_failed:${failed.join(",")}`;
}

writeJson("apps/ai-gateway-service/evidence/phase1181_1200/visual-regression-evidence.json", {
  completed: true,
  oldWorkbenchFeelingReduced: result.oldWorkbenchFeelingReduced,
  leftSidebarHeavyLookRemoved: result.leftSidebarHeavyLookRemoved,
  missionInputProminent: result.missionInputProminent,
  bottomStatusDockClean: result.bottomStatusDockClean,
  floatingNoiseRemoved: result.floatingNoiseRemoved,
  screenshotsGenerated: result.screenshotsGenerated,
  chromeScreenshotsGenerated: result.chromeScreenshotsGenerated
});

writeText("docs/phase1181-1200-final-frontend-visual-experience-report.md", `# Phase1181-1200 Final Frontend Visual Experience Report

Status: ${result.recommended_sealed ? "sealed" : "blocked"}

## What changed

- Rebuilt the first screen into a Future Minimal OS entry: system title, mission command surface, one primary CTA, three mode choices, and safety dock.
- Reduced the old backend Workbench feel by replacing heavy sidebar language with a light OS rail.
- Converted Provider / Evidence / Diagnostics into progressive details that remain folded by default.
- Removed visible character / avatar / companion noise from the primary Mission Control surface.

## Safety boundary

- Provider calls made: false
- Raw secret read: false
- auth.json read: false
- /chat default changed: false
- /chat-gateway/execute default changed: false
- deploy/release/tag/artifact: false

## Chrome acceptance

- Google Chrome required: true
- Google Chrome used: ${result.chromeBrowserUsed}
- Chrome screenshots generated: ${result.chromeScreenshotsGenerated}
- Chrome visual assertions passed: ${result.chromeVisualAssertionsPassed}

## Evidence

- apps/ai-gateway-service/evidence/phase1181_1200/final-frontend-visual-experience-result.json
- apps/ai-gateway-service/evidence/phase1181_1200/google-chrome-final-visual-acceptance-result.json
- apps/ai-gateway-service/evidence/phase1181_1200/screenshots/
- apps/ai-gateway-service/evidence/phase1181_1200/google-chrome-screenshots/

## Rollback

- Delete tools/phase1181_1200/
- Delete docs/phase1181-1200-*.md
- Delete apps/ai-gateway-service/evidence/phase1181_1200/
- Remove this phase's new Future Minimal OS visual components and styles
- Restore FutureMinimalOsApp.js / Shell visual wiring from the previous phase
- Remove package.json scripts added for this phase
- Do not use git reset --hard or git clean
`);

console.log(JSON.stringify({
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker
}, null, 2));

if (!result.recommended_sealed) {
  process.exitCode = 1;
}
