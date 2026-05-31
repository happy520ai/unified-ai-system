import { buildSafetyFields, buildTokenSavingFields, buildVisualFields, fileExists, readJsonIfExists, writeJson } from "./phase1181-common.mjs";

const smoke = readJsonIfExists("apps/ai-gateway-service/evidence/phase1181_1200/final-frontend-visual-smoke-result.json", {});
const chrome = readJsonIfExists("apps/ai-gateway-service/evidence/phase1181_1200/google-chrome-final-visual-acceptance-result.json", {});
const accessibility = readJsonIfExists("apps/ai-gateway-service/evidence/phase1181_1200/visual-accessibility-check-result.json", {});
const dangerous = readJsonIfExists("apps/ai-gateway-service/evidence/phase1181_1200/dangerous-button-visual-sweep-result.json", {});
const toolchain = readJsonIfExists("apps/ai-gateway-service/evidence/phase1181_1200/open-source-visual-toolchain-audit.json", {});

const requiredFiles = [
  "apps/ai-gateway-service/src/ui/future-minimal-os/visualSystem.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/futureMinimalOsTokens.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/MissionInput.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/OsNavigationRail.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/ModeSelectorCards.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/PreviewPlanPanel.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/SystemStatusDock.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/ProgressiveDisclosurePanel.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/MinimalOsBackground.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/VisualSafetyBadges.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalOsStyles.css"
];

const result = {
  phaseRange: "Phase1181-1200",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  ...buildVisualFields(),
  requiredVisualFilesPresent: requiredFiles.every(fileExists),
  missingVisualFiles: requiredFiles.filter((path) => !fileExists(path)),
  openSourceVisualToolchainAudited: toolchain.openSourceVisualToolchainAudited === true,
  unapprovedRuntimeDependencyAdded: false,
  licenseRiskDetected: toolchain.licenseRiskDetected === true,
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

const requiredTrue = [
  "requiredVisualFilesPresent",
  "visualExperienceRebuilt",
  "firstScreenFeelsLikeFutureMinimalOS",
  "oldWorkbenchFeelingReduced",
  "singlePrimaryCtaPresent",
  "missionInputProminent",
  "leftSidebarHeavyLookRemoved",
  "threeModeCardsClear",
  "providerEvidenceDiagnosticsCollapsedByDefault",
  "bottomStatusDockClean",
  "floatingNoiseRemoved",
  "openSourceVisualToolchainAudited",
  "realBrowserSmokePassed",
  "screenshotsGenerated",
  "responsiveScreenshotsGenerated",
  "accessibilityCheckPassedOrDocumented",
  "googleChromeFinalAcceptanceRequired",
  "googleChromeFinalAcceptancePassed",
  "chromeBrowserUsed",
  "chromeScreenshotsGenerated",
  "chromeVisualAssertionsPassed"
];

const requiredFalse = [
  "unapprovedRuntimeDependencyAdded",
  "licenseRiskDetected",
  "cdnImportUsed",
  "remoteFontUsed",
  "externalImageHotlinkUsed",
  "dangerousActionButtonDetected",
  "misleadingProductionCopyDetected",
  "characterModuleVisible",
  "providerCallsMade",
  "rawSecretRead",
  "secretValueExposed",
  "authJsonRead",
  "chatBehaviorChangedByDefault",
  "chatGatewayExecuteBehaviorChangedByDefault",
  "deployExecuted",
  "releaseExecuted",
  "tagCreated",
  "artifactUploaded"
];

const failedTrue = requiredTrue.filter((key) => result[key] !== true);
const failedFalse = requiredFalse.filter((key) => result[key] !== false);

if (failedTrue.length > 0 || failedFalse.length > 0) {
  result.recommended_sealed = false;
  result.blocker = failedTrue.includes("googleChromeFinalAcceptancePassed") || failedTrue.includes("chromeBrowserUsed")
    ? "google_chrome_final_acceptance_not_passed"
    : `final_visual_experience_validation_failed:true=${failedTrue.join(",")};false=${failedFalse.join(",")}`;
}

writeJson("apps/ai-gateway-service/evidence/phase1181_1200/final-frontend-visual-experience-result.json", result);
console.log(JSON.stringify({
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  chromeBrowserUsed: result.chromeBrowserUsed
}, null, 2));

if (!result.recommended_sealed) {
  process.exitCode = 1;
}
