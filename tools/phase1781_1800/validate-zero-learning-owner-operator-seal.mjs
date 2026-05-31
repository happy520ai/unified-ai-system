import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const phaseRange = "Phase1781-1800AIO";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1781_1800";

const paths = Object.freeze({
  cmdLauncher: "run-xiaotian-daily-check.cmd",
  powershellLauncher: "run-xiaotian-daily-check.ps1",
  runner: "tools/phase1781_1800/run-zero-learning-owner-operator.mjs",
  reportGenerator: "tools/phase1781_1800/generate-owner-daily-report.mjs",
  sealVerifier: "tools/phase1781_1800/validate-zero-learning-owner-operator-seal.mjs",
  reportOpener: "tools/phase1790/open-owner-daily-report.mjs",
  guide: "docs/local-self-use/zero-learning-owner-mode-guide.md",
  feedbackClassification: "docs/dogfooding/phase1782-owner-feedback-failure-classification.md",
  closureReport: "docs/dogfooding/phase1799-zero-learning-closure-report.md",
  sealReportDoc: "docs/dogfooding/phase1800-desktop-one-click-operator-seal.md",
  seal: `${evidenceDir}/phase1800-desktop-one-click-operator-seal.json`,
  operatorResult: `${evidenceDir}/phase1781-1800-zero-learning-owner-operator.json`,
  runLog: `${evidenceDir}/logs/phase1781-1800-zero-learning-run.log`,
  browserTrace: `${evidenceDir}/logs/phase1794-browser-operation-trace.json`,
  reportMd: `${evidenceDir}/reports/today-xiaotian-owner-report.md`,
  reportHtml: `${evidenceDir}/reports/today-xiaotian-owner-report.html`,
  screenshot: `${evidenceDir}/screenshots/phase1796-zero-learning-boss-mode.png`,
});

const expectedPackageScripts = Object.freeze({
  "smoke:phase1781-1800-zero-learning-owner-operator":
    "node tools/phase1781_1800/run-zero-learning-owner-operator.mjs && node tools/phase1781_1800/validate-zero-learning-owner-operator-seal.mjs",
  "verify:phase1800-desktop-one-click-operator-seal":
    "node tools/phase1781_1800/validate-zero-learning-owner-operator-seal.mjs",
});

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

async function pathExists(relativePath) {
  try {
    const item = await stat(repoPath(relativePath));
    return item.isFile();
  } catch {
    return false;
  }
}

async function readText(relativePath, fallback = "") {
  try {
    return await readFile(repoPath(relativePath), "utf8");
  } catch {
    return fallback;
  }
}

async function readJson(relativePath, fallback = null) {
  const text = await readText(relativePath, "");
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
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

function hasChineseOwnerReportShape(text) {
  const titleOk = [
    "今日小天系统检查报告",
    "今日小天老板日报",
  ].some((needle) => text.includes(needle));
  const providerBoundaryOk = [
    "有没有调用 Provider",
    "没有调用 Provider",
    "有没有调用真实模型",
    "没有调用真实模型",
    "没有调用",
  ].some((needle) => text.includes(needle));

  return titleOk && providerBoundaryOk && [
    "一、今天完成了什么",
    "二、发现了什么问题",
    "三、下一步我该做什么",
    "四、高级信息",
  ].every((needle) => text.includes(needle));
}

async function main() {
  const packageJson = await readJson("package.json", {});
  const seal = await readJson(paths.seal, {});
  const operatorResult = await readJson(paths.operatorResult, {});
  const browserTrace = await readJson(paths.browserTrace, {});
  const reportMd = await readText(paths.reportMd, "");
  const reportHtml = await readText(paths.reportHtml, "");
  const runLog = await readText(paths.runLog, "");
  const allText = [JSON.stringify(seal), JSON.stringify(operatorResult), JSON.stringify(browserTrace), reportMd, reportHtml, runLog].join("\n");

  const requiredFiles = [
    paths.cmdLauncher,
    paths.powershellLauncher,
    paths.runner,
    paths.reportGenerator,
    paths.sealVerifier,
    paths.reportOpener,
    paths.guide,
    paths.feedbackClassification,
    paths.closureReport,
    paths.sealReportDoc,
    paths.seal,
    paths.operatorResult,
    paths.runLog,
    paths.browserTrace,
    paths.reportMd,
    paths.reportHtml,
    paths.screenshot,
  ];

  const fileChecks = Object.fromEntries(
    await Promise.all(requiredFiles.map(async (file) => [file, await pathExists(file)])),
  );

  const packageChecks = Object.fromEntries(
    Object.entries(expectedPackageScripts).map(([name, command]) => [
      name,
      packageJson?.scripts?.[name] === command,
    ]),
  );

  const checks = {
    phaseRangeCorrect: seal.phaseRange === phaseRange,
    completedTrue: seal.completed === true,
    recommendedSealedTrue: seal.recommended_sealed === true,
    blockerNull: seal.blocker === null,
    zeroLearningModeImplemented: seal.zeroLearningModeImplemented === true,
    desktopCmdLauncherCreated: seal.desktopCmdLauncherCreated === true,
    powershellLauncherCreated: seal.powershellLauncherCreated === true,
    ownerCanStartWithoutUsingWebUi: seal.ownerCanStartWithoutUsingWebUi === true,
    localServiceAutoDetectedOrStarted: seal.localServiceAutoDetectedOrStarted === true,
    browserOperatorAutoRun: seal.browserOperatorAutoRun === true,
    bossModeAutoClicked: seal.bossModeAutoClicked === true,
    ownerDailyReportGenerated: seal.ownerDailyReportGenerated === true,
    ownerDailyReportAutoOpened: seal.ownerDailyReportAutoOpened === true,
    ownerReadableChineseReport: seal.ownerReadableChineseReport === true && hasChineseOwnerReportShape(reportMd),
    failureMessageOwnerReadable: seal.failureMessageOwnerReadable === true,
    screenshotsGenerated: seal.screenshotsGenerated === true && fileChecks[paths.screenshot],
    logsGenerated: seal.logsGenerated === true && fileChecks[paths.runLog] && fileChecks[paths.browserTrace],
    providerCallsMadeFalse: seal.providerCallsMade === false,
    rawSecretReadFalse: seal.rawSecretRead === false,
    authJsonReadFalse: seal.authJsonRead === false,
    rawCredentialRefReadFalse: seal.rawCredentialRefRead === false,
    chatModifiedFalse: seal.chatModified === false,
    chatGatewayExecuteModifiedFalse: seal.chatGatewayExecuteModified === false,
    deployExecutedFalse: seal.deployExecuted === false,
    productionReadyClaimedFalse: seal.productionReadyClaimed === false,
    ownerUseCycleCompletedFalse: seal.ownerUseCycleCompleted === false,
    pluginAuditRecorded: seal.pluginAppsUsed === true &&
      seal.pluginName === "Chrome/Edge local headless browser via CDP" &&
      seal.dataSentOut === false &&
      seal.secretExposed === false &&
      seal.providerCalled === false &&
      seal.evidencePath === evidenceDir,
    operatorResultMatchesSeal: operatorResult.completed === true &&
      operatorResult.providerCallsMade === false &&
      operatorResult.reportPath === paths.reportMd,
    browserTraceLocalOnly: browserTrace.localOnly === true &&
      browserTrace.providerCallsMade === false &&
      Array.isArray(browserTrace.clickedActionList) &&
      browserTrace.clickedActionList.includes("run-today-check"),
    reportHtmlGenerated: reportHtml.includes("<!doctype html>") &&
      ["今日小天系统检查报告", "今日小天老板日报"].some((title) => reportHtml.includes(title)),
    noSecretLikeText: !containsSecretLikeValue(allText),
    ...Object.fromEntries(Object.entries(fileChecks).map(([file, passed]) => [`file:${file}`, passed])),
    ...Object.fromEntries(Object.entries(packageChecks).map(([script, passed]) => [`script:${script}`, passed])),
  };

  const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  const summary = {
    phase: "Phase1800",
    phaseRange,
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    zeroLearningModeImplemented: checks.zeroLearningModeImplemented,
    desktopCmdLauncherCreated: checks.desktopCmdLauncherCreated,
    powershellLauncherCreated: checks.powershellLauncherCreated,
    ownerCanStartWithoutUsingWebUi: checks.ownerCanStartWithoutUsingWebUi,
    ownerDailyReportGenerated: checks.ownerDailyReportGenerated,
    ownerDailyReportAutoOpened: checks.ownerDailyReportAutoOpened,
    reportPath: paths.reportMd,
    logPath: paths.runLog,
    screenshotPath: paths.screenshot,
    checks,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (blocker) process.exitCode = 1;
}

await main();
