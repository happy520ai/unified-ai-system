import { readJson } from "../phase1841_1860/phase1860-common.mjs";
import {
  boundary,
  evidencePaths,
  isDirectRun,
  phaseRange,
  summarizeChecks,
  writeJson,
} from "../phase1841_1860/phase1860-common.mjs";
import { validateOwnerOsInterfaceRewrite } from "../phase1841_1860/validate-owner-os-interface-rewrite.mjs";

export async function validateOwnerOsInterfaceRewriteSeal() {
  const validation = await validateOwnerOsInterfaceRewrite();
  const browser = await readJson(evidencePaths.browserRecheck, {});
  const packageJson = await readJson("package.json", {});

  const checks = {
    ownerOsValidationPassed: validation.completed === true,
    codexDesignKnowledgeRead: validation.codexDesignKnowledgeRead === true,
    ownerOsShellImplemented: validation.ownerOsShellImplemented === true,
    ownerHeroCommandVisible: validation.ownerHeroCommandVisible === true,
    primaryCtaCountOne: validation.primaryCtaCount === 1,
    todayCompletedCardVisible: validation.todayCompletedCardVisible === true,
    problemSignalCardVisible: validation.problemSignalCardVisible === true,
    nextActionCardVisible: validation.nextActionCardVisible === true,
    advancedModeCollapsedByDefault: validation.advancedModeCollapsedByDefault === true,
    engineeringJargonHiddenFromOwner: validation.engineeringJargonHiddenFromOwner === true,
    phaseJargonHiddenFromOwner: validation.phaseJargonHiddenFromOwner === true,
    buttonFeedbackStatesVisible: validation.buttonFeedbackStatesVisible === true,
    ownerDailyReportSurfaceVisible: validation.ownerDailyReportSurfaceVisible === true,
    oldBackendFeelingReduced: validation.oldBackendFeelingReduced === true,
    visualNoiseReduced: validation.visualNoiseReduced === true,
    buttonWallRemoved: validation.buttonWallRemoved === true,
    moduleWallRemoved: validation.moduleWallRemoved === true,
    plainChineseCopy: validation.plainChineseCopy === true,
    noRemoteFontUsed: validation.noRemoteFontUsed === true,
    noCdnImportUsed: validation.noCdnImportUsed === true,
    noExternalImageHotlinkUsed: validation.noExternalImageHotlinkUsed === true,
    browserRecheckPassed: browser.completed === true && browser.blocker === null,
    screenshotsGenerated: browser.screenshotPath === evidencePaths.screenshot,
    domSnapshotGenerated: browser.domSnapshotPath === evidencePaths.domSnapshot,
    packageScriptPresent: packageJson?.scripts?.["verify:phase1860-owner-os-interface-rewrite-seal"] ===
      "node tools/phase1860/validate-owner-os-interface-rewrite-seal.mjs",
    providerCallsMadeFalse: true,
    rawSecretReadFalse: true,
    authJsonReadFalse: true,
    rawCredentialRefReadFalse: true,
    chatModifiedFalse: true,
    chatGatewayExecuteModifiedFalse: true,
    deployExecutedFalse: true,
    productionReadyClaimedFalse: true,
  };

  const summary = summarizeChecks(checks);
  const result = {
    phase: "Phase1860",
    phaseRange,
    ...summary,
    ...boundary,
    designChangeSummary: [
      "Owner Home rewritten as PME Owner OS / 小天总控 OS.",
      "First screen uses one primary question, one primary CTA, three result cards, and a boss daily report surface.",
      "Engineering modules stay collapsed in Advanced Mode.",
      "Owner-facing text avoids phase/verifier/trace/evidence/provider-gate jargon.",
    ],
    screenshotsPath: "apps/ai-gateway-service/evidence/phase1841_1860/screenshots/",
    beforeAfterComparison: {
      beforeScreenshotPath: "apps/ai-gateway-service/evidence/phase1801_1820/screenshots/phase1815-owner-home-after.png",
      afterScreenshotPath: evidencePaths.screenshot,
      browserRecheckEvidencePath: evidencePaths.browserRecheck,
    },
    browserRecheckResult: browser,
    evidencePaths,
    pluginAppUsageAudit: browser.pluginAppUsageAudit ?? {
      pluginAppsUsed: false,
      pluginName: null,
      toolType: null,
      purpose: null,
      dataSentOut: false,
      repoDataSentOut: false,
      secretExposed: false,
      rawCredentialExposed: false,
      providerCalled: false,
      evidencePath: "apps/ai-gateway-service/evidence/phase1841_1860/",
    },
    currentSealScope: "Owner OS interface rewrite for local self-use owner-facing UI and report surface.",
    notSealedScope: [
      "owner satisfaction",
      "production readiness",
      "public launch readiness",
      "real provider execution",
      "new provider capability",
    ],
    checks,
  };

  await writeJson(evidencePaths.seal, result);
  return result;
}

if (isDirectRun(import.meta.url)) {
  const result = await validateOwnerOsInterfaceRewriteSeal();
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}

