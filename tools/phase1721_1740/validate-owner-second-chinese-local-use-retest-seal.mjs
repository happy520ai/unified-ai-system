import { existsSync, statSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phaseRange = "Phase1721-1740AIO";
const routeChoice = "local_self_use_only";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1721_1740";

const paths = Object.freeze({
  upstreamPhase1720Seal:
    "apps/ai-gateway-service/evidence/phase1701_1720/phase1720-owner-p1-ui-comprehension-repair-seal.json",
  firstOwnerDraft:
    "apps/ai-gateway-service/evidence/phase1651_1680/daily-record-drafts/phase1666-daily-use-record-draft.json",
  retestResult: `${evidenceDir}/phase1721-1740-second-chinese-local-use-retest.json`,
  browserWalkthrough: `${evidenceDir}/phase1737-second-browser-walkthrough-evidence.json`,
  dailyUseDraft: `${evidenceDir}/daily-record-drafts/phase1733-second-daily-use-record-draft.json`,
  beforeAfterComparison: `${evidenceDir}/phase1736-before-after-comparison.json`,
  safetyRecheck: `${evidenceDir}/phase1738-regression-safety-recheck.json`,
  ownerReport: `${evidenceDir}/reports/phase1734-second-owner-readable-report.md`,
  feedbackPrompt: `${evidenceDir}/reports/phase1735-second-owner-feedback-prompt-card.md`,
  closureReport: `${evidenceDir}/reports/phase1739-second-retest-closure-report.md`,
  sealReport: `${evidenceDir}/reports/phase1740-owner-second-chinese-local-use-retest-seal.md`,
  screenshot: `${evidenceDir}/screenshots/phase1723-second-chinese-boss-view.png`,
  domSnapshot: `${evidenceDir}/dom/phase1723-second-chinese-boss-view.html`,
  validation: `${evidenceDir}/phase1740-owner-second-chinese-local-use-retest-seal.json`,
  docComparison: "docs/dogfooding/phase1736-before-after-comparison.md",
  docClosure: "docs/dogfooding/phase1739-second-retest-closure-report.md",
  docSeal: "docs/dogfooding/phase1740-owner-second-chinese-local-use-retest-seal.md",
});

const requiredToolFiles = Object.freeze([
  "tools/phase1721_1740/run-owner-second-chinese-local-use-retest.mjs",
  "tools/phase1721_1740/validate-owner-second-chinese-local-use-retest-seal.mjs",
  "tools/phase1736/compare-owner-feedback-before-after.mjs",
  "tools/phase1737/run-second-browser-walkthrough-evidence.mjs",
]);

const requiredDocs = Object.freeze([
  paths.docComparison,
  paths.docClosure,
  paths.docSeal,
]);

const requiredEvidence = Object.freeze([
  paths.retestResult,
  paths.browserWalkthrough,
  paths.dailyUseDraft,
  paths.beforeAfterComparison,
  paths.safetyRecheck,
  paths.ownerReport,
  paths.feedbackPrompt,
  paths.closureReport,
  paths.sealReport,
  paths.screenshot,
  paths.domSnapshot,
]);

const expectedPackageScripts = Object.freeze({
  "verify:phase1740-owner-second-chinese-local-use-retest-seal":
    "node tools/phase1721_1740/validate-owner-second-chinese-local-use-retest-seal.mjs",
});

const boundary = Object.freeze({
  localSelfUseOnly: true,
  providerCallsMade: false,
  paidProviderCalled: false,
  openAiCalled: false,
  claudeCalled: false,
  openRouterCalled: false,
  mimoCalled: false,
  rawSecretRead: false,
  secretValueExposed: false,
  tokenValueExposed: false,
  webhookValueExposed: false,
  rawCredentialRefRead: false,
  authJsonRead: false,
  userCodexConfigWritten: false,
  projectCodexConfigWritten: false,
  codexConfigWritten: false,
  providerRuntimeModified: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  legacyModified: false,
  projectContextModified: false,
  manualHumanFeedbackClaimed: false,
  automatedTestClaimedAsHumanFeedback: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  ownerUseCycleCompleted: false,
});

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

function pathExists(relativePath) {
  try {
    return statSync(repoPath(relativePath)).isFile();
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

async function writeJson(relativePath, value) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function isPhase1720Ready(seal) {
  return (
    seal?.completed === true &&
    seal?.recommended_sealed === true &&
    seal?.blocker === null &&
    seal?.ownerP1UiRepairCompleted === true &&
    seal?.postRepairBrowserWalkthroughPassed === true &&
    seal?.providerCallsMade === false &&
    seal?.chatModified === false &&
    seal?.chatGatewayExecuteModified === false
  );
}

function ownerSubjectiveFieldsAreBlank(draft) {
  return (
    draft?.ownerPerceivedUsefulness === null &&
    draft?.ownerPerceivedSpeed === null &&
    draft?.ownerPerceivedClarity === null &&
    draft?.ownerTrustLevel === null &&
    draft?.keepUsingTomorrow === null &&
    draft?.ownerManualNote === null &&
    draft?.ownerUseCycleCompleted !== true
  );
}

async function buildValidationResult() {
  const upstream = await readJson(paths.upstreamPhase1720Seal, {});
  const firstDraft = await readJson(paths.firstOwnerDraft, {});
  const packageJson = await readJson("package.json", {});
  const retest = await readJson(paths.retestResult, {});
  const walkthrough = await readJson(paths.browserWalkthrough, {});
  const draft = await readJson(paths.dailyUseDraft, {});
  const comparison = await readJson(paths.beforeAfterComparison, {});
  const safety = await readJson(paths.safetyRecheck, {});
  const docsText = (await Promise.all(requiredDocs.map((file) => readText(file, "")))).join("\n");
  const evidenceText = (await Promise.all(requiredEvidence.map((file) => readText(file, "")))).join("\n");

  const checks = {
    phase1720PreconditionSatisfied: isPhase1720Ready(upstream),
    firstOwnerFeedbackBaselinePreserved:
      firstDraft?.ownerPerceivedClarity === 1 &&
      firstDraft?.ownerTrustLevel === 1 &&
      firstDraft?.ownerUseCycleCompleted !== true,
    toolsPresent: requiredToolFiles.every(pathExists),
    docsPresent: requiredDocs.every(pathExists),
    evidencePresent: requiredEvidence.every(pathExists),
    packageScriptsPresent: Object.entries(expectedPackageScripts).every(
      ([name, value]) => packageJson?.scripts?.[name] === value,
    ),
    secondChineseBossViewRetestReady: retest?.secondChineseBossViewRetestReady === true,
    secondDailyUseRecordDraftGenerated: pathExists(paths.dailyUseDraft) &&
      retest?.secondDailyUseRecordDraftGenerated === true,
    secondOwnerReadableReportGenerated: pathExists(paths.ownerReport) &&
      retest?.secondOwnerReadableReportGenerated === true,
    beforeAfterComparisonGenerated:
      comparison?.oldClarity === 1 &&
      comparison?.oldTrust === 1 &&
      comparison?.newClarity === null &&
      comparison?.newTrust === null &&
      retest?.beforeAfterComparisonGenerated === true,
    ownerSubjectiveFieldsLeftBlank: ownerSubjectiveFieldsAreBlank(draft) &&
      retest?.ownerSubjectiveFieldsLeftBlank === true,
    browserWalkthroughPassed:
      walkthrough?.success === true &&
      walkthrough?.missionControlOpened === true &&
      walkthrough?.chineseBossViewEntryVisible === true &&
      walkthrough?.buttonFeedbackRetested === true,
    screenshotGenerated: pathExists(paths.screenshot),
    domSnapshotGenerated: pathExists(paths.domSnapshot),
    providerCallsMadeFalse: safety?.providerCallsMade === false && retest?.providerCallsMade === false,
    rawSecretReadFalse: safety?.rawSecretRead === false && retest?.rawSecretRead === false,
    authJsonReadFalse: safety?.authJsonRead === false && retest?.authJsonRead === false,
    rawCredentialRefReadFalse: safety?.rawCredentialRefRead === false && retest?.rawCredentialRefRead === false,
    chatModifiedFalse: safety?.chatModified === false && retest?.chatModified === false,
    chatGatewayExecuteModifiedFalse:
      safety?.chatGatewayExecuteModified === false && retest?.chatGatewayExecuteModified === false,
    deployReleaseArtifactFalse:
      safety?.deployExecuted === false &&
      safety?.releaseExecuted === false &&
      safety?.tagCreated === false &&
      safety?.artifactUploaded === false &&
      retest?.deployExecuted === false,
    productionReadyClaimedFalse:
      safety?.productionReadyClaimed === false && retest?.productionReadyClaimed === false,
    noSecretLikeText: !containsSecretLikeValue(`${docsText}\n${evidenceText}`),
  };

  const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  const completed = blocker === null;
  return {
    phase: "Phase1740",
    phaseRange,
    routeChoice,
    completed,
    recommended_sealed: completed,
    blocker,
    ...boundary,
    secondChineseBossViewRetestReady: checks.secondChineseBossViewRetestReady,
    secondDailyUseRecordDraftGenerated: checks.secondDailyUseRecordDraftGenerated,
    secondOwnerReadableReportGenerated: checks.secondOwnerReadableReportGenerated,
    beforeAfterComparisonGenerated: checks.beforeAfterComparisonGenerated,
    ownerSubjectiveFieldsLeftBlank: checks.ownerSubjectiveFieldsLeftBlank,
    providerCallsMade: false,
    rawSecretRead: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    productionReadyClaimed: false,
    unresolvedP0Count: 0,
    unresolvedP1Count: completed ? 0 : 1,
    unresolvedP2Count: 0,
    unresolvedP3Count: 0,
    screenshotPath: paths.screenshot,
    ownerReadableReportPath: paths.ownerReport,
    dailyUseRecordDraftPath: paths.dailyUseDraft,
    beforeAfterComparisonPath: paths.beforeAfterComparison,
    browserWalkthroughPath: paths.browserWalkthrough,
    checks,
    requiredEvidence,
    requiredDocs,
    requiredToolFiles,
  };
}

const result = await buildValidationResult();
await writeJson(paths.validation, result);
console.log(JSON.stringify({
  phase: "Phase1740",
  phaseRange: result.phaseRange,
  routeChoice: result.routeChoice,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  secondChineseBossViewRetestReady: result.secondChineseBossViewRetestReady,
  secondDailyUseRecordDraftGenerated: result.secondDailyUseRecordDraftGenerated,
  secondOwnerReadableReportGenerated: result.secondOwnerReadableReportGenerated,
  beforeAfterComparisonGenerated: result.beforeAfterComparisonGenerated,
  ownerSubjectiveFieldsLeftBlank: result.ownerSubjectiveFieldsLeftBlank,
  providerCallsMade: result.providerCallsMade,
  rawSecretRead: result.rawSecretRead,
  authJsonRead: result.authJsonRead,
  rawCredentialRefRead: result.rawCredentialRefRead,
  chatModified: result.chatModified,
  chatGatewayExecuteModified: result.chatGatewayExecuteModified,
  deployExecuted: result.deployExecuted,
  productionReadyClaimed: result.productionReadyClaimed,
  unresolvedP0Count: result.unresolvedP0Count,
  unresolvedP1Count: result.unresolvedP1Count,
}, null, 2));

if (result.blocker) process.exitCode = 1;
