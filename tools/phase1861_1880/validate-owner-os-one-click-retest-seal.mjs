import {
  boundary,
  containsSecretLikeValue,
  evidencePaths,
  isDirectRun,
  launcherPaths,
  phaseRange,
  readJson,
  readText,
  repoPath,
  summarizeChecks,
  upstreamPaths,
  writeJson,
} from "./phase1880-common.mjs";
import { existsSync } from "node:fs";

export async function validateOwnerOsOneClickRetestSeal() {
  const retest = await readJson(evidencePaths.retest, {});
  const packageJson = await readJson("package.json", {});
  const reportHtml = await readText(upstreamPaths.phase1800ReportHtml);
  const evidenceText = [
    JSON.stringify(retest),
    await readText(evidencePaths.closureReport),
    reportHtml,
  ].join("\n");

  const checks = {
    phaseRangeCorrect: retest.phaseRange === phaseRange,
    completedTrue: retest.completed === true,
    recommendedSealedTrue: retest.recommended_sealed === true,
    blockerNull: retest.blocker === null,
    launcherExists: retest.launcherExists === true &&
      existsSync(repoPath(launcherPaths.cmd)) &&
      existsSync(repoPath(launcherPaths.powershell)),
    ownerOsOpened: retest.ownerOsOpened === true,
    primaryCtaClicked: retest.primaryCtaClicked === true,
    threeResultCardsVisible: retest.threeResultCardsVisible === true,
    advancedModeCollapsed: retest.advancedModeCollapsed === true,
    bossDailyReportOpened: retest.bossDailyReportOpened === true &&
      reportHtml.includes("今日小天老板日报"),
    engineeringJargonLeakDetectedFalse: retest.engineeringJargonLeakDetected === false,
    nextStepVisible: retest.nextStepVisible === true,
    buttonFeedbackVisible: retest.buttonFeedbackVisible === true,
    screenshotsGenerated: retest.screenshotsGenerated === true &&
      existsSync(repoPath(evidencePaths.screenshot)),
    domSnapshotGenerated: retest.domSnapshotGenerated === true &&
      existsSync(repoPath(evidencePaths.domSnapshot)),
    automatedUsabilityAssessmentGenerated: retest.automatedUsabilityAssessmentGenerated === true &&
      existsSync(repoPath(evidencePaths.retest)),
    minimalRepairExecutedFalse: retest.minimalRepairExecuted === false,
    providerCallsMadeFalse: retest.providerCallsMade === false,
    rawSecretReadFalse: retest.rawSecretRead === false,
    authJsonReadFalse: retest.authJsonRead === false,
    rawCredentialRefReadFalse: retest.rawCredentialRefRead === false,
    chatModifiedFalse: retest.chatModified === false,
    chatGatewayExecuteModifiedFalse: retest.chatGatewayExecuteModified === false,
    deployExecutedFalse: retest.deployExecuted === false,
    productionReadyClaimedFalse: retest.productionReadyClaimed === false,
    noOwnerSatisfactionClaimed: retest.ownerSatisfactionImprovedClaimed === false,
    noManualHumanFeedbackClaimed: retest.manualHumanFeedbackClaimed === false,
    packageScriptPresent: packageJson?.scripts?.["verify:phase1880-owner-os-one-click-retest-seal"] ===
      "node tools/phase1861_1880/validate-owner-os-one-click-retest-seal.mjs" &&
      packageJson?.scripts?.["smoke:phase1861-1880-owner-os-one-click-retest"] ===
      "node tools/phase1861_1880/run-owner-os-one-click-retest.mjs && node tools/phase1861_1880/validate-owner-os-one-click-retest-seal.mjs",
    pluginAuditRecorded: retest.pluginAppUsageAudit?.pluginAppsUsed === true &&
      retest.pluginAppUsageAudit?.dataSentOut === false &&
      retest.pluginAppUsageAudit?.secretExposed === false &&
      retest.pluginAppUsageAudit?.rawCredentialExposed === false &&
      retest.pluginAppUsageAudit?.providerCalled === false,
    noSecretLikeText: !containsSecretLikeValue(evidenceText),
  };

  const summary = summarizeChecks(checks);
  const result = {
    phase: "Phase1880",
    phaseRange,
    ...summary,
    ...boundary,
    launcherExists: checks.launcherExists,
    ownerOsOpened: checks.ownerOsOpened,
    primaryCtaClicked: checks.primaryCtaClicked,
    threeResultCardsVisible: checks.threeResultCardsVisible,
    advancedModeCollapsed: checks.advancedModeCollapsed,
    bossDailyReportOpened: checks.bossDailyReportOpened,
    engineeringJargonLeakDetected: retest.engineeringJargonLeakDetected === true,
    nextStepVisible: checks.nextStepVisible,
    buttonFeedbackVisible: checks.buttonFeedbackVisible,
    screenshotsPath: evidencePaths.screenshot,
    reportPath: upstreamPaths.phase1800ReportHtml,
    automatedUsabilityAssessmentPath: evidencePaths.retest,
    minimalRepairExecuted: retest.minimalRepairExecuted === true,
    currentSealScope: "Owner OS one-click retest automation and automated usability assessment only.",
    notSealedScope: [
      "owner satisfaction improvement",
      "production readiness",
      "public launch readiness",
      "real provider execution",
      "new UI functionality",
    ],
    pluginAppUsageAudit: retest.pluginAppUsageAudit ?? {
      pluginAppsUsed: false,
      pluginName: null,
      toolType: null,
      purpose: null,
      dataSentOut: false,
      repoDataSentOut: false,
      secretExposed: false,
      rawCredentialExposed: false,
      providerCalled: false,
      evidencePath: "apps/ai-gateway-service/evidence/phase1861_1880",
    },
    checks,
  };

  await writeJson(evidencePaths.seal, result);
  return result;
}

if (isDirectRun(import.meta.url)) {
  const result = await validateOwnerOsOneClickRetestSeal();
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}

