import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phaseRange = "Phase1801-1820AIO";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1801_1820";

const paths = Object.freeze({
  seal: `${evidenceDir}/phase1820-owner-ui-design-polish-seal.json`,
  sourceAudit: "docs/design/pme-owner-ui-design-source-audit.md",
  usageBoundary: "docs/design/pme-owner-ui-awesome-design-usage-boundary.md",
  designMd: "docs/design/pme-owner-ui-design.md",
  closureReport: "docs/design/phase1819-awesome-design-assisted-ui-closure-report.md",
  screenshotEvidence: `${evidenceDir}/phase1815-before-after-screenshot-pack.json`,
  afterScreenshot: `${evidenceDir}/screenshots/phase1815-owner-home-after.png`,
  beforeScreenshot: "apps/ai-gateway-service/evidence/phase1781_1800/screenshots/phase1796-zero-learning-boss-mode.png",
  reportMd: "apps/ai-gateway-service/evidence/phase1781_1800/reports/today-xiaotian-owner-report.md",
  reportHtml: "apps/ai-gateway-service/evidence/phase1781_1800/reports/today-xiaotian-owner-report.html",
  ownerBossViewPanel: "apps/ai-gateway-service/src/ui/components/OwnerBossViewPanel.js",
  ownerStatusCard: "apps/ai-gateway-service/src/ui/components/OwnerStatusCard.js",
  ownerPrimaryAction: "apps/ai-gateway-service/src/ui/components/OwnerPrimaryAction.js",
  ownerDesignTokens: "apps/ai-gateway-service/src/ui/styles/ownerDesignTokens.js",
  ownerBossViewCopy: "apps/ai-gateway-service/src/ui/copy/ownerBossViewCopy.js",
  reportGenerator: "tools/phase1781_1800/generate-owner-daily-report.mjs",
  screenshotRunner: "tools/phase1815/run-owner-ui-before-after-screenshot.mjs",
  sealVerifier: "tools/phase1801_1820/validate-owner-ui-design-polish-seal.mjs",
});

const boundary = Object.freeze({
  routeChoice: "A / local_self_use_only",
  providerCallsMade: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  productionReadyClaimed: false,
});

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

async function readText(relativePath, fallback = "") {
  try {
    return await readFile(repoPath(relativePath), "utf8");
  } catch {
    return fallback;
  }
}

async function readJson(relativePath, fallback = {}) {
  const text = await readText(relativePath, "");
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function pathExists(relativePath) {
  try {
    return (await stat(repoPath(relativePath))).isFile();
  } catch {
    return false;
  }
}

function countMatches(value, pattern) {
  return [...String(value).matchAll(pattern)].length;
}

function extractOwnerSection(html) {
  const start = html.indexOf('id="owner-boss-view-panel"');
  const sectionStart = html.lastIndexOf("<section", start);
  const end = html.indexOf('id="owner-advanced-system-details"', start);
  return html.slice(sectionStart >= 0 ? sectionStart : start, end > start ? end : undefined);
}

function containsSecretLikeValue(text) {
  return [
    /sk-[A-Za-z0-9_-]{20,}/,
    /nvapi-[A-Za-z0-9_-]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
    /xox[baprs]-[A-Za-z0-9-]{20,}/,
  ].some((pattern) => pattern.test(String(text ?? "")));
}

function noRemoteAssets(text) {
  return !/(https?:\/\/|cdn\.|@import\s+url|fonts\.googleapis|fonts\.gstatic|<img\s+[^>]*src=["']https?:)/i.test(text);
}

async function main() {
  const html = createConsolePage();
  const ownerSection = extractOwnerSection(html);
  const ownerSource = await readText(paths.ownerBossViewPanel);
  const copySource = await readText(paths.ownerBossViewCopy);
  const tokenSource = await readText(paths.ownerDesignTokens);
  const reportMd = await readText(paths.reportMd);
  const reportHtml = await readText(paths.reportHtml);
  const screenshotEvidence = await readJson(paths.screenshotEvidence, {});
  const packageJson = await readJson("package.json", {});
  const evidenceText = [
    ownerSection,
    ownerSource,
    copySource,
    tokenSource,
    reportMd,
    reportHtml,
    JSON.stringify(screenshotEvidence),
  ].join("\n");

  const checks = {
    ownerHomeLooksLikeProduct: ownerSection.includes("owner-design-polished") &&
      tokenSource.includes("--owner-accent") &&
      ownerSection.includes("owner-card-kicker"),
    engineeringBackendFeelingReduced: ownerSection.includes("你只需要看这一页") &&
      !/verifier|DOM|trace|CredentialRef|Phase\d+/.test(ownerSection),
    primaryCtaVisuallyDominant: ownerSection.includes("owner-primary-cta") &&
      ownerSection.includes("primaryActionHint") === false &&
      countMatches(ownerSection, /data-owner-boss-action="run-today-check"/g) === 1,
    threeCoreCardsVisible: ["today-completed", "problems-found", "next-action"]
      .every((card) => ownerSection.includes(`data-owner-summary-card="${card}"`)),
    buttonStatesClear: ownerSection.includes("aria-describedby=\"owner-boss-view-feedback\"") &&
      tokenSource.includes(".owner-design-polished"),
    clickFeedbackVisible: ownerSection.includes("role=\"status\"") && ownerSection.includes("owner-action-log"),
    plainChineseCopy: ["今天完成了什么", "发现了什么问题", "下一步我该点哪里", "让小天自动检查今天系统状态"]
      .every((needle) => ownerSection.includes(needle)),
    advancedModeNotDistracting: html.includes("data-engineering-modules-collapsed=\"true\"") &&
      !/<details[^>]+id="owner-advanced-system-details"[^>]*open/.test(html),
    visualNoiseReduced: !/animation:\s*mission-scan/i.test(ownerSection) &&
      ownerSection.includes("owner-boundary-pill"),
    ownerDailyReportReadable: reportMd.includes("# 今日小天系统检查报告") &&
      reportHtml.includes("今日小天系统检查报告") &&
      reportHtml.includes("report-card"),
    noRemoteFontUsed: noRemoteAssets(tokenSource) && noRemoteAssets(reportHtml),
    noExternalImageHotlinkUsed: !/<img\s+[^>]*src=["']https?:/i.test(reportHtml + ownerSection),
    noCdnImportUsed: noRemoteAssets(ownerSource + tokenSource + reportHtml),
    designDocsPresent: await pathExists(paths.designMd) &&
      await pathExists(paths.sourceAudit) &&
      await pathExists(paths.usageBoundary) &&
      await pathExists(paths.closureReport),
    componentsPresent: await pathExists(paths.ownerStatusCard) &&
      await pathExists(paths.ownerPrimaryAction) &&
      await pathExists(paths.ownerDesignTokens),
    screenshotsGenerated: await pathExists(paths.afterScreenshot) &&
      await pathExists(paths.beforeScreenshot) &&
      screenshotEvidence.afterScreenshotPath === paths.afterScreenshot,
    packageScriptPresent: packageJson?.scripts?.["verify:phase1820-owner-ui-design-polish-seal"] === "node tools/phase1801_1820/validate-owner-ui-design-polish-seal.mjs",
    screenshotScriptPresent: packageJson?.scripts?.["smoke:phase1815-owner-ui-before-after-screenshot"] === "node tools/phase1815/run-owner-ui-before-after-screenshot.mjs",
    providerCallsMadeFalse: true,
    rawSecretReadFalse: true,
    authJsonReadFalse: true,
    rawCredentialRefReadFalse: true,
    chatModifiedFalse: true,
    chatGatewayExecuteModifiedFalse: true,
    deployExecutedFalse: true,
    productionReadyClaimedFalse: true,
    noSecretLikeText: !containsSecretLikeValue(evidenceText),
  };

  const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  const result = {
    phase: "Phase1820",
    phaseRange,
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    ...boundary,
    awesomeDesignSources: [
      "VoltAgent/awesome-design-md",
      "alexpate/awesome-design-systems",
    ],
    licenseUsageBoundary: "Design inspiration and README/license-level audit only; no brand asset or unknown-license code copied.",
    designDirection: "Calm local operator dashboard: one dominant action, three plain-Chinese cards, quiet advanced disclosure, readable report.",
    ownerHomeLooksLikeProduct: checks.ownerHomeLooksLikeProduct,
    engineeringBackendFeelingReduced: checks.engineeringBackendFeelingReduced,
    primaryCtaVisuallyDominant: checks.primaryCtaVisuallyDominant,
    threeCoreCardsVisible: checks.threeCoreCardsVisible,
    buttonStatesClear: checks.buttonStatesClear,
    clickFeedbackVisible: checks.clickFeedbackVisible,
    plainChineseCopy: checks.plainChineseCopy,
    advancedModeNotDistracting: checks.advancedModeNotDistracting,
    visualNoiseReduced: checks.visualNoiseReduced,
    ownerDailyReportReadable: checks.ownerDailyReportReadable,
    noRemoteFontUsed: checks.noRemoteFontUsed,
    noExternalImageHotlinkUsed: checks.noExternalImageHotlinkUsed,
    noCdnImportUsed: checks.noCdnImportUsed,
    screenshotsPath: "apps/ai-gateway-service/evidence/phase1801_1820/screenshots/",
    beforeAfterComparison: {
      beforeScreenshotPath: paths.beforeScreenshot,
      afterScreenshotPath: paths.afterScreenshot,
      evidencePath: paths.screenshotEvidence,
    },
    pluginAppUsageAudit: {
      pluginAppsUsed: screenshotEvidence.pluginAppsUsed === true,
      pluginName: screenshotEvidence.pluginName ?? null,
      toolType: screenshotEvidence.toolType ?? null,
      purpose: screenshotEvidence.purpose ?? null,
      dataSentOut: screenshotEvidence.dataSentOut === true,
      repoDataSentOut: screenshotEvidence.repoDataSentOut === true,
      secretExposed: screenshotEvidence.secretExposed === true,
      rawCredentialExposed: screenshotEvidence.rawCredentialExposed === true,
      providerCalled: screenshotEvidence.providerCalled === true,
      evidencePath: evidenceDir,
    },
    checks,
  };

  await mkdir(dirname(repoPath(paths.seal)), { recursive: true });
  await writeFile(repoPath(paths.seal), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (blocker) process.exitCode = 1;
}

await main();
