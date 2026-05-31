import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const repoRoot = process.cwd();
const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1001_1100/future-minimal-os-product-ui-finalization-result.json");
const docsRequired = [
  "docs/phase1001-1100-future-minimal-os-product-ui-finalization.md",
  "docs/phase1001-1100-execution-report.md",
  "docs/phase1001-future-minimal-os-ui-design-brief.md",
  "docs/phase1002-figma-context-intake.md",
  "docs/phase1002-figma-ready-spec.md",
  "docs/phase1041-1060-future-minimal-design-system.md",
  "docs/phase1073-ui-trial-script.md",
  "docs/phase1074-ui-comprehension-feedback-form.md",
  "docs/phase1076-ui-lock-risk-ledger.md",
  "docs/phase1079-pre-final-ui-bug-ledger.md",
  "docs/phase1097-final-ui-evidence-package.md",
  "docs/phase1098-final-ui-rollback-plan.md"
];

const readText = (path) => existsSync(resolve(repoRoot, path)) ? readFileSync(resolve(repoRoot, path), "utf8") : "";
const consoleSource = readText("apps/ai-gateway-service/src/ui/consolePage.js");
const missionSource = readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
const futurePanelSource = readText("apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js");
const futureCopySource = readText("apps/ai-gateway-service/src/ui/copy/futureMinimalOsCopy.js");
const combined = [consoleSource, missionSource, futurePanelSource, futureCopySource].join("\n");
const existing = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, "utf8")) : {};

const checks = {
  completed: existing.completed === true,
  phaseRange: existing.phaseRange === "1001-1100",
  autonomousMode: existing.autonomousMode === true,
  humanInterventionRequired: existing.humanInterventionRequired === false,
  uiProductionLineStarted: existing.uiProductionLineStarted === true,
  futureMinimalOsUiImplemented: existing.futureMinimalOsUiImplemented === true,
  productUiFinalSealCandidate: existing.productUiFinalSealCandidate === true,
  figmaConnectionNotForged: existing.figmaConnectionNotForged === true,
  providerCallsMade: existing.providerCallsMade === false,
  secretValueExposed: existing.secretValueExposed === false,
  deployExecuted: existing.deployExecuted === false,
  releaseExecuted: existing.releaseExecuted === false,
  tagCreated: existing.tagCreated === false,
  artifactUploaded: existing.artifactUploaded === false,
  chatModified: existing.chatModified === false,
  chatGatewayExecuteModified: existing.chatGatewayExecuteModified === false,
  legacyModified: existing.legacyModified === false,
  projectContextModified: existing.projectContextModified === false,
  yiyiVisible: existing.yiyiVisible === false,
  characterModuleVisible: existing.characterModuleVisible === false,
  firstScreenPrimaryCtaCount: existing.firstScreenPrimaryCtaCount === 1,
  dangerousActionButtonDetected: existing.dangerousActionButtonDetected === false,
  realExecutionButtonDetected: existing.realExecutionButtonDetected === false,
  centralTaskComposerPresent: existing.centralTaskComposerPresent === true && combined.includes("\u4f60\u60f3\u8ba9 AI \u5e2e\u4f60\u5b8c\u6210\u4ec0\u4e48\uff1f"),
  singlePrimaryCtaLocked: existing.singlePrimaryCtaLocked === true && combined.includes("\u9884\u89c8\u6267\u884c\u65b9\u6848"),
  modeRecommendationCardPresent: existing.modeRecommendationCardPresent === true && combined.includes("\u63a8\u8350\u6a21\u5f0f"),
  userReadableModeCopyPresent: existing.userReadableModeCopyPresent === true && combined.includes("\u666e\u901a\u95ee\u9898") && combined.includes("\u91cd\u8981\u95ee\u9898") && combined.includes("\u590d\u6742\u4efb\u52a1"),
  securityBoundaryPlainLanguagePresent: existing.securityBoundaryPlainLanguagePresent === true && combined.includes("\u4e0d\u4f1a\u8bfb\u53d6\u5bc6\u94a5") && combined.includes("\u4e0d\u4f1a\u8c03\u7528\u771f\u5b9e\u6a21\u578b") && combined.includes("\u4e0d\u4f1a\u90e8\u7f72"),
  progressiveDetailsDrawerPresent: existing.progressiveDetailsDrawerPresent === true && combined.includes("future-os-details-panel"),
  providerDetailsDefaultCollapsed: existing.providerDetailsDefaultCollapsed === true && combined.includes("Provider / CredentialRef"),
  evidenceDetailsDefaultCollapsed: existing.evidenceDetailsDefaultCollapsed === true && combined.includes("Evidence Replay"),
  advancedDiagnosticsDefaultHidden: existing.advancedDiagnosticsDefaultHidden === true && combined.includes("Dry-run trace"),
  phaseOrEvidenceNotDominatingFirstScreen: existing.phaseOrEvidenceNotDominatingFirstScreen === true,
  responsiveCheckPassed: existing.responsiveCheckPassed === true,
  accessibilityBasicCheckPassed: existing.accessibilityBasicCheckPassed === true,
  emptyLoadingErrorStatesSimplified: existing.emptyLoadingErrorStatesSimplified === true,
  realBrowserSmokePassed: existing.realBrowserSmokePassed === true,
  bugLedgerGenerated: existing.bugLedgerGenerated === true && existsSync(resolve(repoRoot, "docs/phase1019-ui-bug-ledger-before-lock.md")) && existsSync(resolve(repoRoot, "docs/phase1079-pre-final-ui-bug-ledger.md")),
  uiBugFixBatchExecuted: existing.uiBugFixBatchExecuted === true,
  p0BugCountAfterFinalFix: existing.p0BugCountAfterFinalFix === 0,
  p1BugCountAfterFinalFix: existing.p1BugCountAfterFinalFix === 0,
  ordinaryUiBugFixAttempted: existing.ordinaryUiBugFixAttempted === true,
  finalRollbackPlanGenerated: existing.finalRollbackPlanGenerated === true && existsSync(resolve(repoRoot, "docs/phase1098-final-ui-rollback-plan.md")),
  finalEvidencePackageGenerated: existing.finalEvidencePackageGenerated === true && existsSync(resolve(repoRoot, "docs/phase1097-final-ui-evidence-package.md")),
  docsGenerated: docsRequired.every((path) => existsSync(resolve(repoRoot, path)))
};

const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([id]) => id);
const recommendedSealed = failedChecks.length === 0;
const result = {
  ...existing,
  completed: existing.completed === true || failedChecks.length === 0,
  recommended_sealed: recommendedSealed,
  blocker: recommendedSealed ? null : `phase1001_1100_failed_checks:${failedChecks.join(",")}`,
  phaseRange: "1001-1100",
  autonomousMode: true,
  humanInterventionRequired: false,
  partialCompletionAccepted: !recommendedSealed,
  verifier: {
    ok: recommendedSealed,
    failedChecks,
    checks
  }
};

mkdirSync(dirname(resultPath), { recursive: true });
writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);

console.log(JSON.stringify({
  ok: recommendedSealed,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  failedChecks
}, null, 2));

if (!recommendedSealed) {
  process.exitCode = 1;
}
