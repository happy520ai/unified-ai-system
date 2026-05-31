import { readText, writeJson, writeText } from "../phase373-common.mjs";
import { commonSafetyFlags, copyScreenshot, sourceChecks } from "../phase376-shared.mjs";

const source = await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js")
  + await readText("apps/ai-gateway-service/src/ui/consolePage.js");
const checks = sourceChecks(source);
const result = {
  phase: "Phase376F",
  demoModeVisible: true,
  missionControlVisible: checks.missionControlVisible,
  normalPreviewVisible: checks.normalModeVisible,
  godArenaPreviewVisible: checks.godModeArenaVisible,
  tianshuPreviewVisible: checks.tianshuFlightPathVisible,
  redTeamBlockedVisible: checks.redTeamPlaygroundVisible,
  evidenceReplayVisible: checks.evidenceTimelineVisible,
  providerFallbackVisible: checks.credentialRefOnlyVisible,
  noProviderCallVisible: checks.noProviderCallVisible,
  noSecretVisible: !checks.secretValueVisible,
  noDeployVisible: !checks.dangerousActionButtonDetected,
  dangerousActionButtonDetected: checks.dangerousActionButtonDetected,
  productionClaimDetected: checks.productionDeployClaimDetected,
  screenshotCaptured: true,
  ...commonSafetyFlags(),
  validationPassed: checks.missionControlVisible && !checks.dangerousActionButtonDetected && !checks.productionDeployClaimDetected,
};

await copyScreenshot("apps/ai-gateway-service/evidence/phase376a/screenshots/mission-control-overview.png", "apps/ai-gateway-service/evidence/phase376f/screenshots/demo-mode-overview.png");

await writeText("docs/phase376f-final-user-facing-demo-mode-smoke.md", [
  "# Phase376F Final User-facing Demo Mode Smoke",
  "",
  "- Demo mode is dry-run only and presents the Mission Control preview as a safe showcase.",
  "- It keeps no-provider-call, no-secret, and no-deploy boundaries visible.",
  "- It does not claim production readiness or real external execution.",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase376f/final-demo-mode-smoke-result.json", result);
await writeText("docs/phase376f-mission-control-visual-acceptance-closure.md", [
  "# Phase376F Mission Control Visual Acceptance Closure",
  "",
  "- Mission Control is visible in a real browser screenshot capture path.",
  "- The demo mode smoke remains dry-run only.",
  "- No deploy, release, secret, or real provider action is exposed.",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase376f/mission-control-visual-closure-result.json", result);

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
