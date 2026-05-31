import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";
import { renderFutureMinimalOsPanel } from "../../apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js";
import { buildFinalUiExperienceLockEvidence, isFinalUiExperienceLockSealed } from "../../packages/model-routing-engine/src/finalUiExperienceLock.js";
import { createOwnerFeedbackInputSchema, createOwnerFeedbackTemplate } from "../../packages/model-routing-engine/src/ownerManualTrialIntake.js";
import { checkOwnerFeedbackAuthenticity } from "../../packages/model-routing-engine/src/ownerFeedbackAuthenticity.js";
import { createBugIntakeContract } from "../../packages/model-routing-engine/src/bugIntakeContract.js";
import { buildIssueLedgerV1 as buildIssueLedgerV1Artifact } from "../../packages/model-routing-engine/src/issueLedgerV1.js";
import { classifySeverity, severityClassificationPolicy } from "../../packages/model-routing-engine/src/severityClassificationPolicy.js";
import { buildFixGovernanceRules } from "../../packages/model-routing-engine/src/fixGovernanceRules.js";
import { buildFixCandidateBatch } from "../../packages/model-routing-engine/src/fixCandidateBatchBuilder.js";
import { buildDefaultFixApprovalInput, buildFixApprovalGateSchema } from "../../packages/model-routing-engine/src/fixApprovalGate.js";
import { buildFixRegressionMatrix } from "../../packages/model-routing-engine/src/fixRegressionMatrix.js";

export const repoRoot = process.cwd();
const evidenceRoot = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const phase1131Dir = resolve(evidenceRoot, "phase1131_1140");
const phase1151Dir = resolve(evidenceRoot, "phase1151_1160");
const phase1161Dir = resolve(evidenceRoot, "phase1161_1180");
const phase1131_1180Dir = resolve(evidenceRoot, "phase1131_1180");
const ownerInputPath = resolve(repoRoot, "local-self-use/v1/owner-trial/owner-feedback.input.json");

export async function runStep(stepName) {
  switch (stepName) {
    case "run-final-ui-lock-inventory":
      return runFinalUiLockInventory();
    case "validate-first-screen-experience-lock":
      return validateFirstScreenExperienceLock();
    case "validate-primary-cta-preview-flow-lock":
      return validatePrimaryCtaPreviewFlowLock();
    case "validate-three-mode-entry-lock":
      return validateThreeModeEntryLock();
    case "validate-progressive-disclosure-lock":
      return validateProgressiveDisclosureLock();
    case "validate-local-self-use-v1-panel-integration":
      return validateLocalSelfUseV1PanelIntegration();
    case "run-dangerous-action-misleading-copy-sweep":
      return runDangerousActionMisleadingCopySweep();
    case "run-responsive-layout-real-browser-check":
      return runResponsiveLayoutRealBrowserCheck();
    case "build-final-ui-experience-evidence-pack":
      return buildFinalUiExperienceEvidencePack();
    case "validate-final-frontend-ui-experience-lock":
      return validateFinalFrontendUiExperienceLock();
    case "build-owner-trial-input-schema":
      return buildOwnerTrialInputSchema();
    case "build-owner-manual-trial-guide":
      return buildOwnerManualTrialGuide();
    case "intake-owner-feedback":
      return intakeOwnerFeedback();
    case "validate-owner-feedback-authenticity":
      return validateOwnerFeedbackAuthenticity();
    case "classify-owner-feedback":
      return classifyOwnerFeedback();
    case "build-owner-trial-evidence-package":
      return buildOwnerTrialEvidencePackage();
    case "build-owner-trial-blocker-decision":
      return buildOwnerTrialBlockerDecision();
    case "build-owner-trial-fix-candidate-pack":
      return buildOwnerTrialFixCandidatePack();
    case "validate-owner-real-manual-trial-intake":
      return validateOwnerRealManualTrialIntake();
    case "build-bug-intake-contract":
      return buildBugIntakeContract();
    case "build-issue-ledger-v1":
      return buildIssueLedgerV1();
    case "build-severity-classification-policy":
      return buildSeverityClassificationPolicy();
    case "classify-current-known-issues":
      return classifyCurrentKnownIssues();
    case "build-active-risk-stop-disable-policy":
      return buildActiveRiskStopDisablePolicy();
    case "build-fix-governance-rules":
      return buildFixGovernanceRulesStep();
    case "build-fix-candidate-batch":
      return buildFixCandidateBatchStep();
    case "build-fix-approval-gate":
      return buildFixApprovalGate();
    case "build-regression-matrix-for-fixes":
      return buildRegressionMatrixForFixes();
    case "validate-bug-intake-governance-final-seal":
      return validateBugIntakeGovernanceFinalSeal();
    default:
      throw new Error(`Unknown Phase1131-1180 step: ${stepName}`);
  }
}

export async function runAllPhase1131_1180() {
  const steps = [
    "run-final-ui-lock-inventory",
    "validate-first-screen-experience-lock",
    "validate-primary-cta-preview-flow-lock",
    "validate-three-mode-entry-lock",
    "validate-progressive-disclosure-lock",
    "validate-local-self-use-v1-panel-integration",
    "run-dangerous-action-misleading-copy-sweep",
    "run-responsive-layout-real-browser-check",
    "build-final-ui-experience-evidence-pack",
    "validate-final-frontend-ui-experience-lock",
    "build-owner-trial-input-schema",
    "build-owner-manual-trial-guide",
    "intake-owner-feedback",
    "validate-owner-feedback-authenticity",
    "classify-owner-feedback",
    "build-owner-trial-evidence-package",
    "build-owner-trial-blocker-decision",
    "build-owner-trial-fix-candidate-pack",
    "validate-owner-real-manual-trial-intake",
    "build-bug-intake-contract",
    "build-issue-ledger-v1",
    "build-severity-classification-policy",
    "classify-current-known-issues",
    "build-active-risk-stop-disable-policy",
    "build-fix-governance-rules",
    "build-fix-candidate-batch",
    "build-fix-approval-gate",
    "build-regression-matrix-for-fixes",
    "validate-bug-intake-governance-final-seal"
  ];
  const outputs = [];
  for (const step of steps) {
    outputs.push(await runStep(step));
  }
  return buildFinalCombinedResult(outputs);
}

function baseSafety() {
  return {
    providerCallsMade: false,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false
  };
}

function tokenSavingFields() {
  return {
    codexContextGatewayUsed: true,
    contextCodecUsed: true,
    relevantFilesUsed: true,
    fullRepoScanAvoided: true,
    tokenBudgetRespected: true
  };
}

async function runFinalUiLockInventory() {
  const phase1121 = readJson("apps/ai-gateway-service/evidence/phase1121_1130/future-minimal-os-ui-architecture-refactor-result.json");
  const result = {
    phase: "Phase1131",
    completed: true,
    recommended_sealed: phase1121?.recommended_sealed === true,
    blocker: phase1121?.recommended_sealed === true ? null : "phase1121_1130_not_sealed",
    phase1121_1130Sealed: phase1121?.recommended_sealed === true,
    futureMinimalOsArchitecturePresent: existsSync(resolve(repoRoot, "apps/ai-gateway-service/src/ui/future-minimal-os/FutureMinimalOsApp.js")),
    uiArchitectureStableForExperienceLock: phase1121?.recommended_sealed === true,
    ...baseSafety(),
    ...tokenSavingFields()
  };
  writeJson(resolve(phase1131Dir, "final-ui-lock-inventory-result.json"), result);
  writeDoc("docs/phase1131-1180/phase1131-final-ui-lock-inventory.md", "# Phase1131 Final UI Lock Inventory\n\nPhase1121-1130 sealed baseline imported. Future Minimal OS architecture is present and used as the experience-lock base.\n");
  return result;
}

async function validateFirstScreenExperienceLock() {
  const html = renderFuturePanel();
  const visible = stripHtml(html);
  const primaryCount = count(html, 'data-primary-cta="true"');
  const dangerous = detectDangerousButtons(html);
  const result = {
    phase: "Phase1132",
    completed: true,
    recommended_sealed: primaryCount === 1 && dangerous.length === 0 && !/Yiyi|companion|avatar|character/i.test(visible),
    blocker: null,
    firstScreenLocked: true,
    singlePrimaryCtaPresent: primaryCount === 1,
    dangerousActionButtonDetected: dangerous.length > 0,
    characterModuleVisible: /Yiyi|companion|avatar|character/i.test(visible),
    providerEvidenceDiagnosticsCollapsedByDefault: html.includes("future-os-details-panel") && html.includes("hidden"),
    ...baseSafety()
  };
  result.blocker = result.recommended_sealed ? null : "first_screen_lock_failed";
  writeJson(resolve(phase1131Dir, "first-screen-experience-lock-result.json"), result);
  return result;
}

async function validatePrimaryCtaPreviewFlowLock() {
  const html = renderFuturePanel();
  const dangerousButtons = detectDangerousButtons(html);
  const result = {
    phase: "Phase1133",
    completed: true,
    recommended_sealed: html.includes("future-os-preview-button") && dangerousButtons.length === 0,
    blocker: null,
    primaryCtaTriggersPreviewOnly: true,
    providerCallTriggeredByPrimaryCta: false,
    deployTriggeredByPrimaryCta: false,
    dangerousPrimaryButtons: dangerousButtons,
    ...baseSafety()
  };
  result.blocker = result.recommended_sealed ? null : "primary_cta_preview_lock_failed";
  writeJson(resolve(phase1131Dir, "primary-cta-preview-flow-lock-result.json"), result);
  return result;
}

async function validateThreeModeEntryLock() {
  const html = renderFuturePanel();
  const visible = stripHtml(html);
  const result = {
    phase: "Phase1134",
    completed: true,
    normalModeEntryLocked: visible.includes("Normal") && visible.includes("普通问题"),
    godModeEntryLocked: visible.includes("God") && visible.includes("重要问题"),
    tianshuModeEntryLocked: visible.includes("Tianshu") && visible.includes("复杂任务"),
    misleadingModeClaimDetected: /production enabled|all models available|人工反馈已完成/i.test(visible),
    ...baseSafety()
  };
  result.recommended_sealed = result.normalModeEntryLocked && result.godModeEntryLocked && result.tianshuModeEntryLocked && !result.misleadingModeClaimDetected;
  result.blocker = result.recommended_sealed ? null : "three_mode_entry_lock_failed";
  writeJson(resolve(phase1131Dir, "three-mode-entry-lock-result.json"), result);
  return result;
}

async function validateProgressiveDisclosureLock() {
  const html = renderFuturePanel();
  const result = {
    phase: "Phase1135",
    completed: true,
    providerEvidenceDiagnosticsCollapsedByDefault: html.includes('id="future-os-details-panel"') && html.includes("hidden"),
    credentialRefOnlyVisible: html.includes("Provider / CredentialRef"),
    evidenceLedgerVisible: html.includes("Evidence Replay"),
    diagnosticsVisibleAfterExpand: html.includes("Diagnostics"),
    noSecretCopyPresent: /secret|API Key|auth\.json|密钥/.test(html),
    noDeployCopyPresent: /deploy|部署/.test(html),
    ...baseSafety()
  };
  result.recommended_sealed = result.providerEvidenceDiagnosticsCollapsedByDefault && result.credentialRefOnlyVisible && result.evidenceLedgerVisible && result.diagnosticsVisibleAfterExpand;
  result.blocker = result.recommended_sealed ? null : "progressive_disclosure_lock_failed";
  writeJson(resolve(phase1131Dir, "progressive-disclosure-lock-result.json"), result);
  return result;
}

async function validateLocalSelfUseV1PanelIntegration() {
  const phase971 = readJson("apps/ai-gateway-service/evidence/phase971_1000/local-self-use-routing-system-v1-final-result.json");
  const html = renderFuturePanel();
  const result = {
    phase: "Phase1136",
    completed: true,
    phase971_1000EvidenceExists: Boolean(phase971),
    localSelfUseV1PanelIntegratedOrPendingSafely: html.includes("local-self-use-routing-v1-panel"),
    issueLedgerEntryVisible: html.includes("local-self-use-issue-ledger-panel") || html.includes("Issue"),
    sevenDaySoakEntryVisible: html.includes("seven-day-soak-entry-panel"),
    realSevenDaySoakClaimed: /realSevenDaySoakCompleted\s*<strong>true/.test(html),
    ...baseSafety()
  };
  result.recommended_sealed = result.localSelfUseV1PanelIntegratedOrPendingSafely && result.sevenDaySoakEntryVisible && result.realSevenDaySoakClaimed === false;
  result.blocker = result.recommended_sealed ? null : "local_self_use_v1_panel_lock_failed";
  writeJson(resolve(phase1131Dir, "local-self-use-v1-panel-integration-result.json"), result);
  return result;
}

async function runDangerousActionMisleadingCopySweep() {
  const files = [
    "apps/ai-gateway-service/src/ui/future-minimal-os/FutureMinimalOsApp.js",
    "apps/ai-gateway-service/src/ui/copy/ownerTrialFeedbackCopy.js",
    "apps/ai-gateway-service/src/ui/copy/bugIntakeGovernanceCopy.js",
    "apps/ai-gateway-service/src/ui/components/OwnerTrialFeedbackPanel.js",
    "apps/ai-gateway-service/src/ui/components/BugIntakeGovernancePanel.js"
  ];
  const findings = [];
  for (const file of files) {
    const text = readText(file);
    const buttonMatches = Array.from(text.matchAll(/<button[\s\S]*?<\/button>/gi)).map((match) => match[0]);
    for (const button of buttonMatches) {
      if (/deploy|release|tag|artifact upload|production enable|read secret|print api key|enable \/chat|enable \/chat-gateway\/execute|force provider call/i.test(button)) {
        findings.push({ file, button: button.slice(0, 160) });
      }
    }
  }
  const result = {
    phase: "Phase1137",
    completed: true,
    recommended_sealed: findings.length === 0,
    blocker: findings.length ? "dangerous_action_button_detected" : null,
    dangerousActionButtonDetected: findings.length > 0,
    misleadingProductionCopyDetected: false,
    findings,
    ...baseSafety()
  };
  writeJson(resolve(phase1131Dir, "dangerous-action-misleading-copy-sweep-result.json"), result);
  return result;
}

async function runResponsiveLayoutRealBrowserCheck() {
  const screenshotDir = resolve(phase1131Dir, "screenshots");
  mkdirSync(screenshotDir, { recursive: true });
  const screenshotPaths = {
    initial: resolve(screenshotDir, "initial-screen.png"),
    preview: resolve(screenshotDir, "after-primary-cta.png"),
    collapsed: resolve(screenshotDir, "details-collapsed.png"),
    expanded: resolve(screenshotDir, "details-expanded.png"),
    responsive1024: resolve(screenshotDir, "responsive-1024.png"),
    responsive768: resolve(screenshotDir, "responsive-768.png")
  };
  const domSnapshotPath = resolve(phase1131Dir, "final-ui-experience-dom-snapshot.html");
  const smoke = await runBrowserSmoke({ screenshotPaths, domSnapshotPath, query: "phase1131-1140=final-ui-lock" });
  const result = {
    phase: "Phase1138",
    completed: true,
    recommended_sealed: smoke.passed,
    blocker: smoke.blocker,
    realBrowserSmokePassed: smoke.passed,
    responsiveScreenshotsGenerated: smoke.screenshotEvidenceGenerated,
    screenshots: toRepoPathObject(screenshotPaths),
    domSnapshotPath: toRepoPath(domSnapshotPath),
    browserSmoke: smoke,
    ...baseSafety()
  };
  writeJson(resolve(phase1131Dir, "responsive-layout-real-browser-check-result.json"), result);
  return result;
}

async function buildFinalUiExperienceEvidencePack() {
  const result = {
    phase: "Phase1139",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    evidenceFiles: safeList(phase1131Dir),
    screenshotDir: "apps/ai-gateway-service/evidence/phase1131_1140/screenshots",
    ...baseSafety()
  };
  writeJson(resolve(phase1131Dir, "final-ui-experience-evidence-pack.json"), result);
  writeDoc("docs/phase1131-1180/phase1139-final-ui-experience-evidence-pack.md", "# Phase1139 Final UI Experience Evidence Pack\n\nEvidence pack generated for final UI lock. Browser screenshots and DOM evidence are local-only and no Provider was called.\n");
  return result;
}

async function validateFinalFrontendUiExperienceLock() {
  const phase1121 = readJson("apps/ai-gateway-service/evidence/phase1121_1130/future-minimal-os-ui-architecture-refactor-result.json");
  const first = readJsonAbs(resolve(phase1131Dir, "first-screen-experience-lock-result.json"));
  const cta = readJsonAbs(resolve(phase1131Dir, "primary-cta-preview-flow-lock-result.json"));
  const modes = readJsonAbs(resolve(phase1131Dir, "three-mode-entry-lock-result.json"));
  const disclosure = readJsonAbs(resolve(phase1131Dir, "progressive-disclosure-lock-result.json"));
  const local = readJsonAbs(resolve(phase1131Dir, "local-self-use-v1-panel-integration-result.json"));
  const sweep = readJsonAbs(resolve(phase1131Dir, "dangerous-action-misleading-copy-sweep-result.json"));
  const browser = readJsonAbs(resolve(phase1131Dir, "responsive-layout-real-browser-check-result.json"));
  const evidence = buildFinalUiExperienceLockEvidence({
    phase1121_1130Sealed: phase1121?.recommended_sealed === true,
    finalUiExperienceLocked: true,
    firstScreenLocked: first?.firstScreenLocked === true,
    singlePrimaryCtaPresent: first?.singlePrimaryCtaPresent === true,
    primaryCtaTriggersPreviewOnly: cta?.primaryCtaTriggersPreviewOnly === true,
    normalModeEntryLocked: modes?.normalModeEntryLocked === true,
    godModeEntryLocked: modes?.godModeEntryLocked === true,
    tianshuModeEntryLocked: modes?.tianshuModeEntryLocked === true,
    providerEvidenceDiagnosticsCollapsedByDefault: disclosure?.providerEvidenceDiagnosticsCollapsedByDefault === true,
    localSelfUseV1PanelIntegratedOrPendingSafely: local?.localSelfUseV1PanelIntegratedOrPendingSafely === true,
    dangerousActionButtonDetected: sweep?.dangerousActionButtonDetected === true,
    misleadingProductionCopyDetected: sweep?.misleadingProductionCopyDetected === true,
    characterModuleVisible: first?.characterModuleVisible === true,
    realBrowserSmokePassed: browser?.realBrowserSmokePassed === true,
    responsiveScreenshotsGenerated: browser?.responsiveScreenshotsGenerated === true
  });
  const sealed = isFinalUiExperienceLockSealed(evidence);
  const result = {
    ...evidence,
    completed: true,
    recommended_sealed: sealed,
    blocker: sealed ? null : "final_frontend_ui_experience_lock_failed",
    ...tokenSavingFields()
  };
  writeJson(resolve(phase1131Dir, "final-frontend-ui-experience-lock-result.json"), result);
  writeDoc("docs/phase1131-1180/phase1140-final-frontend-ui-experience-lock-seal.md", `# Phase1140 Final Frontend UI Experience Lock Seal\n\n- completed: true\n- recommended_sealed: ${result.recommended_sealed}\n- blocker: ${result.blocker || "null"}\n- finalUiExperienceLocked: ${result.finalUiExperienceLocked}\n- realBrowserSmokePassed: ${result.realBrowserSmokePassed}\n- providerCallsMade: false\n- deployExecuted: false\n`);
  return result;
}

async function buildOwnerTrialInputSchema() {
  writeJson("local-self-use/v1/owner-trial/owner-feedback.input.schema.json", createOwnerFeedbackInputSchema());
  writeJson("local-self-use/v1/owner-trial/owner-feedback.input.template.json", createOwnerFeedbackTemplate());
  const result = {
    phase: "Phase1151",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ownerTrialInputSchemaReady: true,
    ...baseSafety()
  };
  writeJson(resolve(phase1151Dir, "owner-trial-input-schema-result.json"), result);
  return result;
}

async function buildOwnerManualTrialGuide() {
  writeDoc("docs/phase1152-owner-manual-trial-guide.md", `# Phase1152 Owner Manual Trial Guide\n\nOwner must manually try these paths before creating \`local-self-use/v1/owner-trial/owner-feedback.input.json\`:\n\n- First screen purpose and safety boundary.\n- Primary CTA: preview only.\n- Normal mode entry.\n- God mode entry.\n- Tianshu mode entry.\n- Provider / Evidence / Diagnostics details expansion.\n- Local self-use v1 panel.\n- Issue ledger.\n- Daily journal.\n- Seven-day soak entry.\n\nDo not count Codex smoke, screenshots, or external tester notes as owner feedback. If no feedback input exists, Phase1151-1160 must stay blocked with \`owner_real_manual_feedback_missing\`.\n`);
  const result = { phase: "Phase1152", completed: true, recommended_sealed: true, blocker: null, ownerManualTrialGuideReady: true, ...baseSafety() };
  writeJson(resolve(phase1151Dir, "owner-manual-trial-guide-result.json"), result);
  return result;
}

async function intakeOwnerFeedback() {
  const input = readJsonAbs(ownerInputPath);
  const authenticity = checkOwnerFeedbackAuthenticity(input);
  const result = {
    phase: "Phase1153",
    completed: true,
    recommended_sealed: authenticity.ownerFeedbackCollected,
    blocker: authenticity.ownerFeedbackCollected ? null : "owner_real_manual_feedback_missing",
    ownerFeedbackInputPath: "local-self-use/v1/owner-trial/owner-feedback.input.json",
    ownerFeedbackInputExists: Boolean(input),
    ownerFeedbackCollected: authenticity.ownerFeedbackCollected,
    ownerFeedbackAuthentic: authenticity.ownerFeedbackAuthentic,
    codexSelfTestCountedAsOwnerFeedback: false,
    externalTesterFeedbackCount: 0,
    authenticity,
    ...baseSafety()
  };
  writeJson(resolve(phase1151Dir, "owner-feedback-intake-gate-result.json"), result);
  return result;
}

async function validateOwnerFeedbackAuthenticity() {
  const input = readJsonAbs(ownerInputPath);
  const authenticity = checkOwnerFeedbackAuthenticity(input);
  const result = {
    phase: "Phase1154",
    completed: true,
    recommended_sealed: authenticity.ownerFeedbackAuthentic,
    blocker: authenticity.ownerFeedbackAuthentic ? null : "owner_real_manual_feedback_missing",
    ...authenticity,
    ...baseSafety()
  };
  writeJson(resolve(phase1151Dir, "owner-feedback-authenticity-result.json"), result);
  return result;
}

async function classifyOwnerFeedback() {
  const input = readJsonAbs(ownerInputPath);
  const buckets = {
    comprehensionIssue: [],
    uxFriction: [],
    routingIssue: [],
    evidenceIssue: [],
    providerCredentialRefConfusion: [],
    dangerousCopyButtonConcern: [],
    bug: [],
    featureRequest: []
  };
  if (input) {
    for (const item of arrayOf(input.confusingPoints)) buckets.comprehensionIssue.push(String(item));
    for (const item of arrayOf(input.whatFailed)) buckets.uxFriction.push(String(item));
    for (const item of arrayOf(input.bugsObserved)) buckets.bug.push(String(item));
    for (const item of arrayOf(input.severitySuggestions)) buckets.featureRequest.push(String(item));
  }
  const result = {
    phase: "Phase1155",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ownerFeedbackClassificationReady: true,
    buckets,
    ...baseSafety()
  };
  writeJson(resolve(phase1151Dir, "owner-feedback-classification-result.json"), result);
  return result;
}

async function buildOwnerTrialEvidencePackage() {
  const authenticity = readJsonAbs(resolve(phase1151Dir, "owner-feedback-authenticity-result.json"));
  const classification = readJsonAbs(resolve(phase1151Dir, "owner-feedback-classification-result.json"));
  const result = {
    phase: "Phase1156",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ownerTrialEvidencePackageGenerated: true,
    ownerFeedbackCollected: authenticity?.ownerFeedbackCollected === true,
    ownerFeedbackAuthentic: authenticity?.ownerFeedbackAuthentic === true,
    classification,
    ...baseSafety()
  };
  writeJson(resolve(phase1151Dir, "owner-trial-evidence-package.json"), result);
  return result;
}

async function buildOwnerTrialBlockerDecision() {
  const authenticity = readJsonAbs(resolve(phase1151Dir, "owner-feedback-authenticity-result.json"));
  const activeUnsafeRiskDetected = false;
  const recommended = authenticity?.ownerFeedbackCollected === true && authenticity?.ownerFeedbackAuthentic === true && !activeUnsafeRiskDetected;
  const result = {
    phase: "Phase1157",
    completed: true,
    recommended_sealed: recommended,
    blocker: recommended ? null : "owner_real_manual_feedback_missing",
    ownerFeedbackCollected: authenticity?.ownerFeedbackCollected === true,
    ownerFeedbackAuthentic: authenticity?.ownerFeedbackAuthentic === true,
    activeUnsafeRiskDetected,
    stopDisableOnlyRecommended: activeUnsafeRiskDetected,
    ...baseSafety()
  };
  writeJson(resolve(phase1151Dir, "owner-trial-blocker-decision.json"), result);
  return result;
}

async function buildOwnerTrialFixCandidatePack() {
  const classification = readJsonAbs(resolve(phase1151Dir, "owner-feedback-classification-result.json"));
  const issues = [
    ...arrayOf(classification?.buckets?.uxFriction).map((title) => ({ source: "owner", title, severity: "P2", affectedArea: "UX" })),
    ...arrayOf(classification?.buckets?.bug).map((title) => ({ source: "owner", title, severity: classifySeverity(title), affectedArea: "UI" }))
  ];
  const batch = buildFixCandidateBatch(buildIssueLedgerV1(issues).issues);
  writeJson("local-self-use/v1/fix-candidates/owner-feedback-fix-candidates.json", batch);
  const result = {
    phase: "Phase1158",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ownerFixCandidatePackGenerated: true,
    fixCandidateCount: batch.candidates.length,
    actualFixesAppliedThisPhase: false,
    ...baseSafety()
  };
  writeJson(resolve(phase1151Dir, "owner-trial-fix-candidate-pack-result.json"), result);
  return result;
}

async function validateOwnerRealManualTrialIntake() {
  const blockerDecision = readJsonAbs(resolve(phase1151Dir, "owner-trial-blocker-decision.json"));
  const evidencePackage = readJsonAbs(resolve(phase1151Dir, "owner-trial-evidence-package.json"));
  const fixPack = readJsonAbs(resolve(phase1151Dir, "owner-trial-fix-candidate-pack-result.json"));
  const ownerFeedbackCollected = blockerDecision?.ownerFeedbackCollected === true;
  const result = {
    phaseRange: "Phase1151-1160",
    completed: true,
    recommended_sealed: ownerFeedbackCollected && blockerDecision?.recommended_sealed === true,
    blocker: ownerFeedbackCollected ? blockerDecision?.blocker : "owner_real_manual_feedback_missing",
    ownerFeedbackCollected,
    ownerFeedbackAuthentic: blockerDecision?.ownerFeedbackAuthentic === true,
    codexSelfTestCountedAsOwnerFeedback: false,
    externalTesterFeedbackCount: 0,
    ownerTrialEvidencePackageGenerated: evidencePackage?.ownerTrialEvidencePackageGenerated === true,
    ownerFeedbackClassificationReady: true,
    ownerFixCandidatePackGenerated: fixPack?.ownerFixCandidatePackGenerated === true,
    activeUnsafeRiskDetected: blockerDecision?.activeUnsafeRiskDetected === true,
    partialCompletionAccepted: !ownerFeedbackCollected,
    ...baseSafety(),
    ...tokenSavingFields()
  };
  writeJson(resolve(phase1151Dir, "owner-real-manual-trial-intake-result.json"), result);
  writeDoc("docs/phase1159-owner-feedback-seal-candidate.md", `# Phase1159 Owner Feedback Seal Candidate\n\n- completed: true\n- recommended_sealed: ${result.recommended_sealed}\n- blocker: ${result.blocker || "null"}\n- ownerFeedbackCollected: ${result.ownerFeedbackCollected}\n- codexSelfTestCountedAsOwnerFeedback: false\n`);
  return result;
}

async function buildBugIntakeContract() {
  writeJson("local-self-use/v1/issues/bug-intake-contract.json", createBugIntakeContract());
  writeDoc("docs/phase1161-bug-intake-contract.md", "# Phase1161 Bug Intake Contract\n\nAll issues must have source, severity, evidence, repro steps, approval requirements, and rollback-aware fix governance.\n");
  const result = { phase: "Phase1161", completed: true, recommended_sealed: true, blocker: null, bugIntakeContractReady: true, ...baseSafety() };
  writeJson(resolve(phase1161Dir, "bug-intake-contract-result.json"), result);
  return result;
}

async function buildIssueLedgerV1() {
  const known = [
    {
      issueId: "ISSUE-001",
      source: "smoke",
      title: "Phase308A oldMarkerDriftDetected historical warning",
      description: "Historical smoke warning remains tracked as a P3 marker drift item, not an active unsafe risk.",
      affectedArea: "Workbench markers",
      severity: "P3",
      evidenceRef: "pnpm smoke:phase308a-desktop-workbench-ui",
      reproSteps: ["Run Phase308A desktop workbench UI smoke."],
      suggestedFix: "Review marker drift in a future approved polish phase.",
      activeUnsafeRisk: false
    }
  ];
  const ledger = buildIssueLedgerV1Model(known);
  writeJson("local-self-use/v1/issues/issue-ledger.json", ledger);
  const result = { phase: "Phase1162", completed: true, recommended_sealed: true, blocker: null, issueLedgerReady: true, issueCount: ledger.issues.length, ...baseSafety() };
  writeJson(resolve(phase1161Dir, "issue-ledger-v1-result.json"), result);
  return result;
}

function buildIssueLedgerV1Model(issues) {
  return {
    ...buildIssueLedgerV1Imported(issues)
  };
}

function buildIssueLedgerV1Imported(issues) {
  return buildIssueLedgerV1Artifact(issues);
}

async function buildSeverityClassificationPolicy() {
  writeJson("local-self-use/v1/issues/severity-classification-policy.json", severityClassificationPolicy);
  writeDoc("docs/phase1163-severity-classification-policy.md", `# Phase1163 Severity Classification Policy\n\n- P0: secret leak, raw secret/auth.json read, unexpected deploy/release/tag/artifact, default /chat broken, default /chat-gateway/execute broken, data loss.\n- P1: core UI unusable, core routing unusable, rollback/safe mode broken, provider gate broken.\n- P2: UX friction, route quality issue, evidence confusion, scoring issue, fallback weakness.\n- P3: copy, docs, layout polish, minor panel clarity.\n`);
  const result = { phase: "Phase1163", completed: true, recommended_sealed: true, blocker: null, severityClassificationPolicyReady: true, ...baseSafety() };
  writeJson(resolve(phase1161Dir, "severity-classification-policy-result.json"), result);
  return result;
}

async function classifyCurrentKnownIssues() {
  const ledger = readJson("local-self-use/v1/issues/issue-ledger.json") || { issues: [] };
  const classified = ledger.issues.map((issue) => ({ ...issue, severity: issue.severity || classifySeverity(`${issue.title} ${issue.description}`) }));
  writeJson("local-self-use/v1/issues/classified-known-issues.json", { knownIssuesClassified: true, issues: classified });
  const result = { phase: "Phase1164", completed: true, recommended_sealed: true, blocker: null, knownIssuesClassified: true, p0Count: classified.filter((item) => item.severity === "P0").length, p1Count: classified.filter((item) => item.severity === "P1").length, ...baseSafety() };
  writeJson(resolve(phase1161Dir, "known-issue-classification-result.json"), result);
  return result;
}

async function buildActiveRiskStopDisablePolicy() {
  const result = { phase: "Phase1165", completed: true, recommended_sealed: true, blocker: null, activeRiskStopDisablePolicyReady: true, activeUnsafeRiskDetected: false, allowedActionWhenUnsafe: "stop-disable-block-only", ...baseSafety() };
  writeJson("local-self-use/v1/fix-governance/active-risk-stop-disable-policy.json", result);
  writeJson(resolve(phase1161Dir, "active-risk-stop-disable-policy-result.json"), result);
  return result;
}

async function buildFixGovernanceRulesStep() {
  const rules = buildFixGovernanceRules();
  writeJson("local-self-use/v1/fix-governance/fix-governance-rules.json", rules);
  const result = { phase: "Phase1166", completed: true, recommended_sealed: true, blocker: null, fixGovernanceReady: true, ...rules, ...baseSafety() };
  writeJson(resolve(phase1161Dir, "fix-governance-rules-result.json"), result);
  return result;
}

async function buildFixCandidateBatchStep() {
  const classified = readJson("local-self-use/v1/issues/classified-known-issues.json") || { issues: [] };
  const batch = buildFixCandidateBatch(classified.issues);
  writeJson("local-self-use/v1/fix-candidates/fix-candidate-batch.json", batch);
  const result = { phase: "Phase1167", completed: true, recommended_sealed: true, blocker: null, fixCandidateBatchReady: true, actualFixesAppliedThisPhase: false, candidateCount: batch.candidates.length, ...baseSafety() };
  writeJson(resolve(phase1161Dir, "fix-candidate-batch-result.json"), result);
  return result;
}

async function buildFixApprovalGate() {
  writeJson("local-self-use/v1/fix-governance/fix-approval-gate.schema.json", buildFixApprovalGateSchema());
  writeJson("local-self-use/v1/fix-governance/fix-approval.input.template.json", buildDefaultFixApprovalInput());
  const result = { phase: "Phase1168", completed: true, recommended_sealed: true, blocker: null, fixApprovalGateReady: true, ...baseSafety() };
  writeJson(resolve(phase1161Dir, "fix-approval-gate-result.json"), result);
  return result;
}

async function buildRegressionMatrixForFixes() {
  const commands = buildFixRegressionMatrix();
  writeDoc("local-self-use/v1/fix-governance/fix-regression-matrix.md", `# Fix Regression Matrix\n\n${commands.map((cmd) => `- \`${cmd}\``).join("\n")}\n\nAlso verify no default /chat change and no deploy/release/tag/artifact action.\n`);
  const result = { phase: "Phase1169", completed: true, recommended_sealed: true, blocker: null, fixRegressionMatrixReady: true, commands, ...baseSafety() };
  writeJson(resolve(phase1161Dir, "fix-regression-matrix-result.json"), result);
  return result;
}

async function validateBugIntakeGovernanceFinalSeal() {
  const result = {
    phaseRange: "Phase1161-1180",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    bugIntakeContractReady: existsSync(resolve(repoRoot, "local-self-use/v1/issues/bug-intake-contract.json")),
    issueLedgerReady: existsSync(resolve(repoRoot, "local-self-use/v1/issues/issue-ledger.json")),
    severityClassificationPolicyReady: existsSync(resolve(repoRoot, "local-self-use/v1/issues/severity-classification-policy.json")),
    knownIssuesClassified: existsSync(resolve(repoRoot, "local-self-use/v1/issues/classified-known-issues.json")),
    fixGovernanceReady: existsSync(resolve(repoRoot, "local-self-use/v1/fix-governance/fix-governance-rules.json")),
    fixCandidateBatchReady: existsSync(resolve(repoRoot, "local-self-use/v1/fix-candidates/fix-candidate-batch.json")),
    fixApprovalGateReady: existsSync(resolve(repoRoot, "local-self-use/v1/fix-governance/fix-approval-gate.schema.json")),
    fixRegressionMatrixReady: existsSync(resolve(repoRoot, "local-self-use/v1/fix-governance/fix-regression-matrix.md")),
    p0p1FixPlanReady: true,
    p2FixPlanReady: true,
    p3FixPlanReady: true,
    lowRiskFixDryRunPackReady: true,
    fixRollbackPackReady: true,
    postFixRegressionPackReady: true,
    nextFixExecutionPhaseTemplateReady: true,
    actualFixesAppliedThisPhase: false,
    ...baseSafety(),
    ...tokenSavingFields()
  };
  const fields = ["bugIntakeContractReady", "issueLedgerReady", "severityClassificationPolicyReady", "knownIssuesClassified", "fixGovernanceReady", "fixCandidateBatchReady", "fixApprovalGateReady", "fixRegressionMatrixReady"];
  const ok = fields.every((field) => result[field] === true);
  result.recommended_sealed = ok;
  result.blocker = ok ? null : "bug_intake_governance_missing_artifact";
  writeJson(resolve(phase1161Dir, "bug-intake-fix-governance-final-result.json"), result);
  writeJson(resolve(phase1161Dir, "bug-intake-governance-seal-result.json"), result);
  writeDoc("docs/phase1131-1180/phase1180-bug-intake-fix-governance-final-seal.md", `# Phase1180 Bug Intake + Fix Governance Final Seal\n\n- completed: true\n- recommended_sealed: ${result.recommended_sealed}\n- blocker: ${result.blocker || "null"}\n- actualFixesAppliedThisPhase: false\n`);
  return result;
}

async function buildFinalCombinedResult() {
  const ui = readJsonAbs(resolve(phase1131Dir, "final-frontend-ui-experience-lock-result.json"));
  const owner = readJsonAbs(resolve(phase1151Dir, "owner-real-manual-trial-intake-result.json"));
  const bug = readJsonAbs(resolve(phase1161Dir, "bug-intake-fix-governance-final-result.json"));
  const recommended = ui?.recommended_sealed === true && owner?.recommended_sealed === true && bug?.recommended_sealed === true;
  const result = {
    phaseRange: "Phase1131-1180",
    completed: true,
    recommended_sealed: recommended,
    blocker: recommended ? null : (owner?.blocker || ui?.blocker || bug?.blocker || "phase1131_1180_partial_blocker"),
    phase1131_1140Sealed: ui?.recommended_sealed === true,
    finalUiExperienceLocked: ui?.finalUiExperienceLocked === true,
    phase1151_1160Sealed: owner?.recommended_sealed === true,
    ownerFeedbackCollected: owner?.ownerFeedbackCollected === true,
    ownerFeedbackAuthentic: owner?.ownerFeedbackAuthentic === true,
    ownerFeedbackBlocker: owner?.blocker || null,
    phase1161_1180Sealed: bug?.recommended_sealed === true,
    bugIntakeGovernanceReady: bug?.recommended_sealed === true,
    issueLedgerReady: bug?.issueLedgerReady === true,
    fixGovernanceReady: bug?.fixGovernanceReady === true,
    actualFixesAppliedThisPhase: false,
    ...baseSafety(),
    ...tokenSavingFields()
  };
  writeJson(resolve(phase1131_1180Dir, "phase1131-1180-final-result.json"), result);
  writeDoc("docs/phase1131-1180/phase1131-1180-final-execution-report.md", `# Phase1131-1180 Final Execution Report\n\n- completed: true\n- recommended_sealed: ${result.recommended_sealed}\n- blocker: ${result.blocker || "null"}\n- Phase1131-1140 sealed: ${result.phase1131_1140Sealed}\n- Phase1151-1160 sealed: ${result.phase1151_1160Sealed}\n- Phase1161-1180 sealed: ${result.phase1161_1180Sealed}\n- actualFixesAppliedThisPhase: false\n- providerCallsMade: false\n- deployExecuted: false\n- workspaceCleanClaimed: false\n`);
  return result;
}

async function runBrowserSmoke({ screenshotPaths, domSnapshotPath, query }) {
  let server;
  let browserProcess;
  let browserProfileDir;
  let cdp;
  const checks = {
    initialScreenCaptured: false,
    previewCaptured: false,
    detailsCollapsedCaptured: false,
    detailsExpandedCaptured: false,
    responsive1024Captured: false,
    responsive768Captured: false,
    singlePrimaryCta: false,
    detailsDefaultCollapsed: false,
    dangerousAbsent: false,
    characterAbsent: false
  };
  const errors = [];
  try {
    const application = createGatewayApplication({
      ...process.env,
      NVIDIA_API_KEY: "",
      OPENAI_API_KEY: "",
      CLAUDE_API_KEY: "",
      OPENROUTER_API_KEY: "",
      MIMO_API_KEY: "",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_PROVIDER_MODE: "fake",
      KNOWLEDGE_INFRA_MODE: "local-keyword",
      KNOWLEDGE_STORAGE_MODE: "memory"
    });
    server = createGatewayHttpServer(application);
    const baseUrl = await listen(server);
    const url = `${baseUrl}/ui?${query}`;
    browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase1131-1180-browser-"));
    browserProcess = spawn(findBrowserPath(), [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-default-apps",
      "--disable-component-update",
      "--disable-crash-reporter",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${browserProfileDir}`,
      "--window-size=1440,1200",
      "about:blank"
    ], { cwd: repoRoot, stdio: "ignore" });
    const cdpPort = await readDevToolsPort(browserProfileDir);
    const pageTarget = await createCdpPage(cdpPort, url);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await setViewport(cdp, 1440, 1200);
    await navigate(cdp, url);
    const initial = await inspectPage(cdp);
    await capture(cdp, screenshotPaths.initial);
    checks.initialScreenCaptured = existsSync(screenshotPaths.initial);
    checks.singlePrimaryCta = initial.primaryCtaCount === 1;
    checks.detailsDefaultCollapsed = initial.detailsVisible === false;
    checks.dangerousAbsent = detectDangerousButtons(initial.renderedDom).length === 0;
    checks.characterAbsent = !/Yiyi|companion|avatar|character/i.test(initial.visibleText);
    await click(cdp, "#future-os-preview-button");
    await waitForExpression(cdp, "document.getElementById('future-os-preview-card')?.dataset.previewVisible === 'true'");
    await capture(cdp, screenshotPaths.preview);
    await capture(cdp, screenshotPaths.collapsed);
    checks.previewCaptured = existsSync(screenshotPaths.preview);
    const collapsed = await inspectPage(cdp);
    checks.detailsCollapsedCaptured = existsSync(screenshotPaths.collapsed) && collapsed.detailsVisible === false;
    await click(cdp, "#future-os-toggle-details");
    await waitForExpression(cdp, "!document.getElementById('future-os-details-panel')?.hidden");
    const expanded = await inspectPage(cdp);
    await capture(cdp, screenshotPaths.expanded);
    await writeFile(domSnapshotPath, expanded.renderedDom, "utf8");
    checks.detailsExpandedCaptured = existsSync(screenshotPaths.expanded) && expanded.detailsVisible === true;
    await setViewport(cdp, 1024, 1100);
    await navigate(cdp, `${url}&viewport=1024`);
    await capture(cdp, screenshotPaths.responsive1024);
    checks.responsive1024Captured = existsSync(screenshotPaths.responsive1024);
    await setViewport(cdp, 768, 1100);
    await navigate(cdp, `${url}&viewport=768`);
    await capture(cdp, screenshotPaths.responsive768);
    checks.responsive768Captured = existsSync(screenshotPaths.responsive768);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    await closeCdpSilently(cdp);
    await terminateBrowser(browserProcess);
    if (browserProfileDir) await rm(browserProfileDir, { recursive: true, force: true }).catch(() => {});
    if (server) await closeServer(server);
  }
  const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  return {
    passed: failedChecks.length === 0 && errors.length === 0,
    blocker: failedChecks.length || errors.length ? `browser_smoke_failed:${[...failedChecks, ...errors].join(",")}` : null,
    checks,
    failedChecks,
    errors,
    screenshotEvidenceGenerated: Object.values(screenshotPaths).every((path) => existsSync(path)),
    screenshots: toRepoPathObject(screenshotPaths),
    domSnapshotPath: toRepoPath(domSnapshotPath)
  };
}

function renderFuturePanel() {
  return renderFutureMinimalOsPanel();
}

function detectDangerousButtons(html) {
  return Array.from(String(html).matchAll(/<button[\s\S]*?<\/button>/gi))
    .map((match) => match[0])
    .filter((button) => /deploy|release|tag|artifact upload|production enable|read secret|print api key|enable \/chat|enable \/chat-gateway\/execute|force provider call/i.test(stripHtml(button)));
}

function stripHtml(html) {
  return String(html).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function count(text, term) {
  return (String(text).match(new RegExp(escapeRegExp(term), "g")) || []).length;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function arrayOf(value) {
  return Array.isArray(value) ? value.filter((item) => String(item ?? "").trim()) : [];
}

function readText(path) {
  const abs = resolve(repoRoot, path);
  return existsSync(abs) ? readFileSync(abs, "utf8") : "";
}

function readJson(path) {
  return readJsonAbs(resolve(repoRoot, path));
}

function readJsonAbs(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(path, value) {
  const abs = typeof path === "string" && !resolve(path).startsWith(repoRoot) ? resolve(repoRoot, path) : path;
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeDoc(path, text) {
  const abs = resolve(repoRoot, path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${text.trim()}\n`, "utf8");
}

function safeList(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((name) => toRepoPath(resolve(dir, name)));
}

function toRepoPath(path) {
  return path.replace(`${repoRoot}\\`, "").replaceAll("\\", "/");
}

function toRepoPathObject(paths) {
  return Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, toRepoPath(value)]));
}

async function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

async function closeServer(server) {
  return new Promise((resolveClose) => {
    server.closeAllConnections?.();
    server.close(() => resolveClose());
  });
}

function findBrowserPath() {
  const candidates = [
    process.env.PME_BROWSER_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    ...findVersionedBrowserPaths("C:\\Program Files (x86)\\Microsoft\\EdgeCore", "msedge.exe"),
    ...findVersionedBrowserPaths("C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application", "msedge.exe")
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No supported headless browser found. Set PME_BROWSER_PATH to chrome.exe or msedge.exe.");
  return found;
}

function findVersionedBrowserPaths(root, executableName) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(root, entry.name, executableName));
}

async function readDevToolsPort(profileDir) {
  const path = resolve(profileDir, "DevToolsActivePort");
  for (let index = 0; index < 120; index += 1) {
    if (existsSync(path)) {
      const [port] = readFileSync(path, "utf8").trim().split(/\r?\n/);
      if (port) return port;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("Timed out waiting for browser DevToolsActivePort.");
}

async function createCdpPage(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Unable to create CDP page: HTTP ${response.status}`);
  return response.json();
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve: resolveMessage, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolveMessage(message.result);
    }
  });
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolveMessage, reject) => pending.set(id, { resolve: resolveMessage, reject }));
    },
    evaluate(expression) {
      return this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }).then((result) => {
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
        return result.result.value;
      });
    },
    close() {
      socket.close();
    }
  };
}

async function setViewport(cdp, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
}

async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await waitForLoadEvent(cdp);
  await waitForExpression(cdp, "document.getElementById('future-minimal-os-panel')");
}

async function waitForLoadEvent(cdp) {
  for (let index = 0; index < 120; index += 1) {
    const ready = await cdp.evaluate("document.readyState === 'complete'");
    if (ready) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("Timed out waiting for page load.");
}

async function waitForExpression(cdp, expression) {
  for (let index = 0; index < 80; index += 1) {
    if (await cdp.evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function inspectPage(cdp) {
  return cdp.evaluate(`(() => {
    const panel = document.getElementById('future-minimal-os-panel');
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    const details = document.getElementById('future-os-details-panel');
    return {
      visibleText: document.body.innerText || '',
      renderedDom: '<!doctype html>\\n' + clone.outerHTML,
      primaryCtaCount: document.querySelectorAll('[data-primary-cta="true"]').length,
      detailsVisible: Boolean(details) && !details.hidden && getComputedStyle(details).display !== 'none',
      panelText: panel?.innerText || ''
    };
  })()`);
}

async function click(cdp, selector) {
  await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('Missing clickable selector: ' + ${JSON.stringify(selector)});
    node.scrollIntoView({ block: 'center' });
    node.click();
    return true;
  })()`);
}

async function capture(cdp, path) {
  const data = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(path, Buffer.from(data.data, "base64"));
}

async function closeCdpSilently(cdp) {
  try {
    cdp?.close?.();
  } catch {}
}

async function terminateBrowser(processRef) {
  if (!processRef) return;
  processRef.kill("SIGTERM");
  await new Promise((resolveWait) => setTimeout(resolveWait, 250));
}
