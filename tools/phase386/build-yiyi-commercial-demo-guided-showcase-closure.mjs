import {
  assertPhase386SafetyFlags,
  ensure,
  fileInfo,
  makeResult,
  phase386Safety,
  phase386ScreenshotNames,
  readJson,
  writeJson,
  writeText,
} from "../phase386-common.mjs";

const requiredResultPaths = [
  "apps/ai-gateway-service/evidence/phase386a/yiyi-demo-showcase-contract-result.json",
  "apps/ai-gateway-service/evidence/phase386b/yiyi-guided-showcase-ui-result.json",
  "apps/ai-gateway-service/evidence/phase386c/yiyi-demo-scenario-pack-result.json",
  "apps/ai-gateway-service/evidence/phase386d/yiyi-demo-script-package-result.json",
  "apps/ai-gateway-service/evidence/phase386e/yiyi-demo-evidence-package-result.json",
  "apps/ai-gateway-service/evidence/phase386f/yiyi-guided-showcase-browser-smoke-result.json",
];

const subResults = [];
for (const path of requiredResultPaths) {
  const info = fileInfo(path);
  ensure(info.exists && info.sizeBytes > 20, `Missing Phase386 sub-result: ${path}`);
  const result = await readJson(path);
  ensure(result.validationsPassed === true, `Sub-result did not pass validations: ${path}`);
  subResults.push({ path, phase: result.phase, validationsPassed: result.validationsPassed });
}

const browserSmoke = await readJson("apps/ai-gateway-service/evidence/phase386f/yiyi-guided-showcase-browser-smoke-result.json");
ensure(browserSmoke.browserSmokePassed === true, "Browser smoke must pass.");

const result = makeResult({
  phase: "Phase386",
  title: "Yiyi Commercial Demo Package + Guided Showcase",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phaseType: "commercial_demo_guided_showcase",
  riskLevel: "low",
  validationsPassed: true,
  guidedShowcaseCreated: true,
  demoScenarioPackCreated: true,
  demoScriptsGenerated: true,
  demoEvidencePackageGenerated: true,
  browserSmokePassed: true,
  screenshotsCaptured: true,
  screenshotNames: phase386ScreenshotNames,
  modelBrainEnabledByDefault: false,
  noProductionGAClaim: true,
  noRealProviderClaim: true,
  noRealBillingClaim: true,
  phase384StillRequiresAuthorization: true,
  validationSubResults: subResults,
  ...phase386Safety,
  safety: { ...phase386Safety },
  remainingRisks: [
    "still_dry_run_demo",
    "real_provider_test_not_executed",
    "manual_recording_review_recommended",
    "sales_script_polish_recommended",
    "cross_browser_qa_pending",
    "mobile_demo_adaptation_pending",
  ],
  nextRecommendedPhases: [
    {
      phase: "Phase387",
      title: "Yiyi Commercial Visual Polish + Cross-browser QA",
      riskLevel: "low",
      requiresHumanApproval: false,
    },
    {
      phase: "Phase384",
      title: "Yiyi Guarded Real Provider Test Authorization Gate",
      riskLevel: "high",
      requiresHumanApproval: true,
    },
  ],
});
assertPhase386SafetyFlags(result);

await writeText(
  "docs/phase386-yiyi-commercial-demo-guided-showcase-closure.md",
  [
    "# Phase386 Yiyi Commercial Demo Guided Showcase Closure",
    "",
    "Phase386 packages Yiyi and Mission Control into a guided commercial demo.",
    "",
    "Completed:",
    "- Demo Narrative + Showcase Contract.",
    "- Guided Showcase UI Flow.",
    "- Demo Scenario Pack.",
    "- Commercial Demo Scripts + Recording Guide.",
    "- Local Demo Evidence Package.",
    "- Browser smoke and screenshot evidence slots.",
    "",
    "Safety boundary:",
    "- providerCallsMade=false.",
    "- nonNvidiaProviderCallsMade=false.",
    "- rawSecretAccessed=false.",
    "- secretValueExposed=false.",
    "- deployExecuted=false.",
    "- releaseExecuted=false.",
    "- tagCreated=false.",
    "- artifactUploaded=false.",
    "- billingExecuted=false.",
    "- invoiceGenerated=false.",
    "- productionGaClaimed=false.",
    "- workspaceCleanClaimed=false.",
    "",
    "Recommended next phase: Phase387 Yiyi Commercial Visual Polish + Cross-browser QA.",
    "Phase384 remains high-risk and requires explicit human authorization.",
  ].join("\n"),
);
await writeJson("apps/ai-gateway-service/evidence/phase386/yiyi-commercial-demo-guided-showcase-closure-result.json", result);

console.log(JSON.stringify(result, null, 2));
