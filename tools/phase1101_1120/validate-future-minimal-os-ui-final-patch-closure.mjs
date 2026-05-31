import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { renderFutureMinimalOsPanel } from "../../apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js";

const repoRoot = process.cwd();
const resultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1101_1120/future-minimal-os-ui-final-patch-closure-result.json");
const requiredDocs = [
  "docs/phase1101-1120-future-minimal-os-ui-final-patch-closure.md",
  "docs/phase1101-1120-execution-report.md",
  "docs/phase1101-phase1100-result-intake.md",
  "docs/phase1101-final-patch-blocker-classifier.md",
  "docs/phase1102-failed-verifier-patch-plan.md",
  "docs/phase1117-final-ui-bug-ledger-closure.md",
  "docs/phase1118-final-patch-evidence-package.md",
  "docs/phase1118-final-patch-rollback-plan.md"
];

const readText = (path) => {
  const abs = resolve(repoRoot, path);
  return existsSync(abs) ? readFileSync(abs, "utf8") : "";
};

const countMatches = (text, pattern) => (text.match(pattern) || []).length;

const normalize = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const buttonLabels = (html) => Array.from(html.matchAll(/<button\b[\s\S]*?<\/button>/gi))
  .map((match) => normalize(match[0]));

const buttonTextIncludesAny = (html, terms) => buttonLabels(html)
  .some((label) => terms.some((term) => label.toLowerCase().includes(term.toLowerCase())));

const sourcePaths = [
  "apps/ai-gateway-service/src/ui/consolePage.js",
  "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js",
  "apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js",
  "apps/ai-gateway-service/src/ui/copy/futureMinimalOsCopy.js"
];

const source = sourcePaths.map(readText).join("\n");
const renderedFuturePanel = renderFutureMinimalOsPanel();
const result = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, "utf8")) : {
  completed: false,
  recommended_sealed: false,
  blocker: "phase1101_1120_result_missing",
  phaseRange: "1101-1120",
  finalPatchMode: true,
  humanInterventionRequired: false,
  productUiFinalPatchSealed: false,
  partialCompletionAccepted: true,
  unresolvedItems: ["missing final evidence result"]
};

const dangerousButtonTerms = [
  "真实执行",
  "调用模型",
  "部署",
  "发布",
  "发送生产",
  "执行已批准动作",
  "创建发票",
  "Deploy",
  "Release",
  "Push to Production",
  "Call Provider",
  "Generate Invoice"
];

const checks = {
  completed: result.completed === true,
  phaseRange: result.phaseRange === "1101-1120",
  finalPatchMode: result.finalPatchMode === true,
  humanInterventionRequired: result.humanInterventionRequired === false,
  phase1100ResultIntakeAttempted: result.phase1100ResultIntakeAttempted === true,
  failedVerifierTriageCompleted: result.failedVerifierTriageCompleted === true,
  firstScreenNoiseFinalPatched: result.firstScreenNoiseFinalPatched === true,
  singlePrimaryCtaLocked: result.singlePrimaryCtaLocked === true && countMatches(renderedFuturePanel, /data-primary-cta="true"/g) === 1,
  deadButtonDetected: result.deadButtonDetected === false,
  centralTaskComposerPresent: result.centralTaskComposerPresent === true && renderedFuturePanel.includes("future-os-task-input") && source.includes("你想让 AI 帮你完成什么？"),
  modeRecommendationCardPresent: result.modeRecommendationCardPresent === true && renderedFuturePanel.includes("data-mode-recommendation-card"),
  userReadableModeCopyPresent: result.userReadableModeCopyPresent === true &&
    source.includes("普通模式：直接问一个模型，适合简单问题。") &&
    source.includes("上帝模式：多个模型互相检查，适合重要答案。") &&
    source.includes("天枢模式：你只说任务，系统帮你选模型和流程。"),
  securityBoundaryPlainLanguagePresent: result.securityBoundaryPlainLanguagePresent === true &&
    source.includes("本次不会读取你的密钥") &&
    source.includes("本次不会真实调用模型") &&
    source.includes("本次不会部署任何内容") &&
    source.includes("你可以先查看执行方案"),
  providerMisunderstandingRiskCleared: result.providerMisunderstandingRiskCleared === true &&
    source.includes("密钥引用，不展示密钥本身") &&
    source.includes("配置详情仅用于说明，不代表真实调用已发生"),
  evidenceMisunderstandingRiskCleared: result.evidenceMisunderstandingRiskCleared === true &&
    source.includes("不代表真实执行已经发生"),
  progressiveDetailsDrawerPresent: result.progressiveDetailsDrawerPresent === true && renderedFuturePanel.includes("future-os-details-panel"),
  providerDetailsDefaultCollapsed: result.providerDetailsDefaultCollapsed === true && /<details>\s*<summary>Provider \/ CredentialRef<\/summary>/.test(renderedFuturePanel),
  evidenceDetailsDefaultCollapsed: result.evidenceDetailsDefaultCollapsed === true && /<details>\s*<summary>Evidence Replay<\/summary>/.test(renderedFuturePanel),
  advancedDiagnosticsDefaultHidden: result.advancedDiagnosticsDefaultHidden === true && renderedFuturePanel.includes('id="future-os-details-panel"') && renderedFuturePanel.includes("hidden"),
  responsiveCheckPassed: result.responsiveCheckPassed === true,
  accessibilityBasicCheckPassed: result.accessibilityBasicCheckPassed === true &&
    renderedFuturePanel.includes("aria-expanded=\"false\"") &&
    renderedFuturePanel.includes("aria-controls=\"future-os-details-panel\""),
  emptyLoadingErrorStatesSimplified: result.emptyLoadingErrorStatesSimplified === true && source.includes("请先输入你想完成的任务。"),
  visualNoiseFinalReduced: result.visualNoiseFinalReduced === true,
  yiyiVisible: result.yiyiVisible === false,
  characterModuleVisible: result.characterModuleVisible === false,
  providerCallsMade: result.providerCallsMade === false,
  secretValueExposed: result.secretValueExposed === false,
  deployExecuted: result.deployExecuted === false,
  releaseExecuted: result.releaseExecuted === false,
  tagCreated: result.tagCreated === false,
  artifactUploaded: result.artifactUploaded === false,
  chatModified: result.chatModified === false,
  chatGatewayExecuteModified: result.chatGatewayExecuteModified === false,
  legacyModified: result.legacyModified === false,
  projectContextModified: result.projectContextModified === false,
  realBrowserSmokePassed: result.realBrowserSmokePassed === true,
  finalBugLedgerClosed: result.finalBugLedgerClosed === true,
  p0Remaining: result.p0Remaining === 0,
  p1Remaining: result.p1Remaining === 0,
  finalEvidencePackageGenerated: result.finalEvidencePackageGenerated === true && existsSync(resolve(repoRoot, "docs/phase1118-final-patch-evidence-package.md")),
  finalRollbackPlanGenerated: result.finalRollbackPlanGenerated === true && existsSync(resolve(repoRoot, "docs/phase1118-final-patch-rollback-plan.md")),
  finalVerificationBatchPassed: result.finalVerificationBatchPassed === true,
  firstScreenPrimaryCtaCount: result.firstScreenPrimaryCtaCount === 1 && countMatches(renderedFuturePanel, /data-primary-cta="true"/g) === 1,
  dangerousActionButtonDetected: result.dangerousActionButtonDetected === false && !buttonTextIncludesAny(renderedFuturePanel, dangerousButtonTerms),
  realExecutionButtonDetected: result.realExecutionButtonDetected === false && !buttonTextIncludesAny(renderedFuturePanel, ["真实执行", "调用真实模型", "Call Provider Now"]),
  docsGenerated: requiredDocs.every((path) => existsSync(resolve(repoRoot, path))),
  screenshotsGenerated: [
    "initial-screen.png",
    "preview-after-cta.png",
    "details-collapsed.png",
    "details-expanded.png",
    "responsive-narrow.png"
  ].every((name) => existsSync(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1101_1120/screenshots", name)))
};

const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
const ok = failedChecks.length === 0;
const verified = {
  ...result,
  recommended_sealed: ok && result.recommended_sealed === true,
  blocker: ok ? result.blocker : `phase1101_1120_failed_checks:${failedChecks.join(",")}`,
  productUiFinalPatchSealed: ok && result.productUiFinalPatchSealed === true,
  partialCompletionAccepted: !ok,
  verifier: {
    ok,
    failedChecks,
    checks,
    checkedAt: new Date().toISOString()
  }
};

mkdirSync(dirname(resultPath), { recursive: true });
writeFileSync(resultPath, `${JSON.stringify(verified, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  ok,
  completed: verified.completed,
  recommended_sealed: verified.recommended_sealed,
  blocker: verified.blocker,
  failedChecks
}, null, 2));

if (!ok) {
  process.exitCode = 1;
}
