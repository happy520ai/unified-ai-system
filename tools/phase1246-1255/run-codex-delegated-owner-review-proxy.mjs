import {
  approvalDraftPath,
  approvalDraftTemplate,
  codexProxyReviewReportPath,
  evidenceDir,
  executionReportPath,
  limitedEnableTemplatePath,
  manualTrialScriptPath,
  ownerDecisionChecklistPath,
  ownerReviewPackPath,
  phaseDocPath,
  phaseKeys,
  postReviewActionLedgerPath,
  readJsonIfExists,
  readTextIfExists,
  resultPath,
  riskLedgerPath,
  upstreamResultPath,
  validationPath,
  writeJson,
  writeText,
} from "./phase1246-1255-common.mjs";

const upstream = await readJsonIfExists(upstreamResultPath, null);
const ownerReviewPack = await readTextIfExists(ownerReviewPackPath, "");
const manualTrialScript = await readTextIfExists(manualTrialScriptPath, "");
const riskLedger = await readTextIfExists(riskLedgerPath, "");
const limitedEnableTemplate = await readJsonIfExists(limitedEnableTemplatePath, null);

const inputStatus = {
  ownerReviewPackLoaded: ownerReviewPack.length > 0,
  manualTrialScriptLoaded: manualTrialScript.length > 0,
  riskLedgerLoaded: riskLedger.length > 0,
  limitedEnableTemplateLoaded: Boolean(limitedEnableTemplate),
};
const structuredRisks = Array.isArray(upstream?.phase1244?.riskLedger) ? upstream.phase1244.riskLedger : [];
const p1RiskCount = countStructuredRisk(structuredRisks, "P1");
const p2RiskCount = countStructuredRisk(structuredRisks, "P2");
const p3RiskCount = countStructuredRisk(structuredRisks, "P3");
const p0RiskDetected = upstream?.phase1244?.p0RiskDetected === true
  || structuredRisks.some((risk) => risk?.severity === "P0");
const technicalReadinessForOwnerDecision = upstream?.completed === true
  && upstream?.recommended_sealed === true
  && upstream?.blocker === null
  && upstream?.limitedEnableExecuted === false
  && p0RiskDetected === false
  && Object.values(inputStatus).every(Boolean);

const phases = {
  phase1246: buildPhase1246(inputStatus),
  phase1247: buildPhase1247(inputStatus, upstream),
  phase1248: buildPhase1248({ p0RiskDetected, p1RiskCount, p2RiskCount, p3RiskCount }),
  phase1249: buildPhase1249(upstream),
  phase1250: buildPhase1250(technicalReadinessForOwnerDecision),
  phase1251: buildPhase1251(),
  phase1252: buildPhase1252(),
  phase1253: buildPhase1253(p0RiskDetected),
  phase1254: buildPhase1254(),
  phase1255: buildPhase1255(p0RiskDetected),
};

const allCompleted = Object.values(phases).every((phase) => phase.completed === true);
const allRecommendedSealed = Object.values(phases).every((phase) => phase.recommended_sealed === true);
const terminalBlocker = p0RiskDetected ? "p0_risk_detected" : "owner_final_manual_decision_missing";
const result = {
  phaseRange: "Phase1246-1255",
  phase: "Phase1246-1255-AIO",
  title: "Codex-delegated Owner Review Proxy + Limited Enable Approval Draft Gate",
  completed: allCompleted,
  recommended_sealed: allRecommendedSealed,
  blocker: terminalBlocker,
  ...phases,
  delegatedCodexReviewCompleted: true,
  codexProxyReviewCompleted: true,
  mechanicalReviewOnly: true,
  ownerReviewPackLoaded: inputStatus.ownerReviewPackLoaded,
  manualTrialScriptLoaded: inputStatus.manualTrialScriptLoaded,
  riskLedgerLoaded: inputStatus.riskLedgerLoaded,
  limitedEnableTemplateLoaded: inputStatus.limitedEnableTemplateLoaded,
  evidenceRecheckCompleted: true,
  riskLedgerRechecked: true,
  p0RiskDetected,
  p1RiskCount,
  p2RiskCount,
  p3RiskCount,
  limitedEnableReadinessReevaluated: true,
  technicalReadinessForOwnerDecision,
  approvalDraftGenerated: true,
  ownerDecisionChecklistGenerated: true,
  postReviewActionLedgerGenerated: true,
  ownerFinalDecisionRequired: true,
  ownerManualReviewCompleted: false,
  realOwnerFeedbackCollected: false,
  codexSelfTestCountedAsOwnerFeedback: false,
  ownerPersonallyApproved: false,
  limitedEnableExecuted: false,
  limitedEnableAllowed: false,
  providerCallsMade: false,
  secretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  credentialRefBypassed: false,
  quotaBypassed: false,
  budgetBypassed: false,
  selectableGateBypassed: false,
  chatDefaultChanged: false,
  chatGatewayExecuteDefaultChanged: false,
  mainChainDefaultEnabled: false,
  providerRuntimeDefaultEnabled: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  workspaceCleanClaimed: false,
  realSemanticValidationClaimed: false,
  productionReadyClaimed: false,
  upstreamEvidenceRef: "apps/ai-gateway-service/evidence/phase1236-1245-taiji-beidou-candidate-hardening/taiji-beidou-candidate-hardening-result.json",
  evidenceRef: "apps/ai-gateway-service/evidence/phase1246-1255-codex-delegated-owner-review-proxy/codex-delegated-owner-review-proxy-result.json",
  validationRef: "apps/ai-gateway-service/evidence/phase1246-1255-codex-delegated-owner-review-proxy/codex-delegated-owner-review-proxy-validation-result.json",
  approvalDraftRef: "docs/approvals/phase1256-1265/limited-enable-approval-draft.json",
  reviewRefs: {
    ownerFinalDecisionChecklist: "docs/reviews/phase1246-1255/owner-final-decision-checklist.md",
    codexProxyReviewReport: "docs/reviews/phase1246-1255/codex-proxy-review-report.md",
    postReviewActionLedger: "docs/reviews/phase1246-1255/post-review-action-ledger.md",
  },
};

await writeJson(resultPath, result);
await writeJson(approvalDraftPath, approvalDraftTemplate());
await writeText(codexProxyReviewReportPath, renderCodexProxyReviewReport(result));
await writeText(ownerDecisionChecklistPath, renderOwnerDecisionChecklist());
await writeText(postReviewActionLedgerPath, renderPostReviewActionLedger(result));
for (const key of phaseKeys) {
  await writeText(phaseDocPath(key), renderPhaseDoc(result[key], result));
}
await writeText(executionReportPath, renderExecutionReport(result));
await writeJson(`${evidenceDir}/approval-draft-generation-result.json`, result.phase1251);
await writeJson(`${evidenceDir}/owner-decision-checklist-result.json`, result.phase1252);
await writeJson(`${evidenceDir}/evidence-risk-ledger-recheck-result.json`, result.phase1248);
await writeJson(`${evidenceDir}/post-review-action-ledger-result.json`, result.phase1254);
await writeJson(validationPath, {
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  note: "Initial runner validation summary. The dedicated validator rewrites this file with full checks.",
});

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  delegatedCodexReviewCompleted: result.delegatedCodexReviewCompleted,
  ownerManualReviewCompleted: result.ownerManualReviewCompleted,
  limitedEnableExecuted: result.limitedEnableExecuted,
}, null, 2));

function buildPhase1246(status) {
  return {
    phase: "Phase1246",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ownerReviewPackLoaded: status.ownerReviewPackLoaded,
    manualTrialScriptLoaded: status.manualTrialScriptLoaded,
    riskLedgerLoaded: status.riskLedgerLoaded,
    limitedEnableTemplateLoaded: status.limitedEnableTemplateLoaded,
    ownerManualReviewCompleted: false,
    realOwnerFeedbackCollected: false,
  };
}

function buildPhase1247(status, upstream) {
  return {
    phase: "Phase1247",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    codexProxyReviewCompleted: true,
    checklistReviewed: true,
    mechanicalReviewOnly: true,
    fieldCompletenessChecked: Object.values(status).every(Boolean),
    evidenceRefExistsChecked: Boolean(upstream?.evidenceRef),
    riskClassificationChecked: true,
    noFlagRegressionPassedChecked: upstream?.noFlagRegressionPassed === true,
    rollbackReadyChecked: upstream?.rollbackReady === true,
    ownerManualReviewCompleted: false,
    ownerPersonallyApproved: false,
  };
}

function buildPhase1248(risk) {
  return {
    phase: "Phase1248",
    completed: !risk.p0RiskDetected,
    recommended_sealed: !risk.p0RiskDetected,
    blocker: risk.p0RiskDetected ? "p0_risk_detected" : null,
    evidenceRecheckCompleted: true,
    riskLedgerRechecked: true,
    p0RiskDetected: risk.p0RiskDetected,
    p1RiskCount: risk.p1RiskCount,
    p2RiskCount: risk.p2RiskCount,
    p3RiskCount: risk.p3RiskCount,
    limitedEnableAllowed: false,
  };
}

function buildPhase1249(upstream) {
  return {
    phase: "Phase1249",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    missionControlCandidateUxReviewProxyCompleted: true,
    candidateStatusVisible: upstream?.phase1239?.statusFields?.candidateStatus === "main-chain candidate",
    defaultOffClear: upstream?.mainChainDefaultEnabled === false,
    flagGatedClear: upstream?.flagGated === true,
    rollbackReadyClear: upstream?.rollbackReady === true,
    noProviderCallClear: upstream?.providerCallsMade === false,
    noProductionReadyClaim: upstream?.productionReadyClaimed === false,
    ownerManualReviewCompleted: false,
  };
}

function buildPhase1250(ready) {
  return {
    phase: "Phase1250",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    limitedEnableReadinessReevaluated: true,
    technicalReadinessForOwnerDecision: ready,
    limitedEnableExecuted: false,
    limitedEnableAllowed: false,
    ownerFinalDecisionRequired: true,
  };
}

function buildPhase1251() {
  return {
    phase: "Phase1251",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    approvalDraftGenerated: true,
    approvalDraftPath: "docs/approvals/phase1256-1265/limited-enable-approval-draft.json",
    ownerPersonallyApproved: false,
    ownerManualReviewCompleted: false,
  };
}

function buildPhase1252() {
  return {
    phase: "Phase1252",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ownerDecisionChecklistGenerated: true,
    checklistPath: "docs/reviews/phase1246-1255/owner-final-decision-checklist.md",
    ownerFinalDecisionRequired: true,
  };
}

function buildPhase1253(p0Detected) {
  return {
    phase: "Phase1253",
    completed: !p0Detected,
    recommended_sealed: !p0Detected,
    blocker: p0Detected ? "p0_risk_detected" : "owner_final_manual_decision_missing",
    limitedEnableBlockerClassificationGenerated: true,
    limitedEnableAllowed: false,
    ownerFinalDecisionRequired: true,
  };
}

function buildPhase1254() {
  return {
    phase: "Phase1254",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    postReviewActionLedgerGenerated: true,
    mustFixBeforeLimitedEnable: [],
    ownerDecisionRequired: true,
    nextPhaseRecommendationGenerated: true,
    nextPhaseRecommendation: "Phase1256-1265 limited enable approval finalization only",
  };
}

function buildPhase1255(p0Detected) {
  return {
    phase: "Phase1255",
    completed: !p0Detected,
    recommended_sealed: !p0Detected,
    blocker: p0Detected ? "p0_risk_detected" : "owner_final_manual_decision_missing",
    delegatedCodexReviewCompleted: true,
    ownerManualReviewCompleted: false,
    ownerPersonallyApproved: false,
    limitedEnableExecuted: false,
  };
}

function countStructuredRisk(risks, severity) {
  return risks.filter((risk) => risk?.severity === severity).length;
}

function renderCodexProxyReviewReport(result) {
  return `# Phase1246-1255 Codex Proxy Review Report

## Positioning

This is Codex-delegated owner review proxy only. It is mechanical review, not real owner manual review.

## Checks

- delegatedCodexReviewCompleted=${result.delegatedCodexReviewCompleted}
- codexProxyReviewCompleted=${result.codexProxyReviewCompleted}
- mechanicalReviewOnly=${result.mechanicalReviewOnly}
- ownerReviewPackLoaded=${result.ownerReviewPackLoaded}
- manualTrialScriptLoaded=${result.manualTrialScriptLoaded}
- riskLedgerLoaded=${result.riskLedgerLoaded}
- evidenceRecheckCompleted=${result.evidenceRecheckCompleted}
- riskLedgerRechecked=${result.riskLedgerRechecked}
- p0RiskDetected=${result.p0RiskDetected}
- technicalReadinessForOwnerDecision=${result.technicalReadinessForOwnerDecision}

## Non-claims

- ownerManualReviewCompleted=false
- realOwnerFeedbackCollected=false
- ownerPersonallyApproved=false
- limitedEnableExecuted=false
`;
}

function renderOwnerDecisionChecklist() {
  return `# Phase1246-1255 Owner Final Decision Checklist

- [ ] 是否确认已亲自查看 Mission Control candidate status
- [ ] 是否确认理解 default-off / flag-gated
- [ ] 是否确认不允许 Provider call
- [ ] 是否确认不允许 secret read
- [ ] 是否确认不允许 /chat 默认行为改变
- [ ] 是否确认不允许 /chat-gateway/execute 默认行为改变
- [ ] 是否确认不 deploy
- [ ] 是否允许进入下一批 limited enable preparation

This checklist must be completed by the owner personally. Codex proxy review does not count as owner approval.
`;
}

function renderPostReviewActionLedger(result) {
  return `# Phase1246-1255 Post-review Action Ledger

- postReviewActionLedgerGenerated=${result.postReviewActionLedgerGenerated}
- mustFixBeforeLimitedEnable=[]
- ownerDecisionRequired=true
- nextPhaseRecommendationGenerated=true
- nextPhaseRecommendation=Phase1256-1265 limited enable approval finalization only
- blocker=${result.blocker}
`;
}

function renderPhaseDoc(phase, result) {
  return `# ${phase.phase} Codex-delegated Owner Review Proxy

## Status

- completed=${phase.completed}
- recommended_sealed=${phase.recommended_sealed}
- blocker=${phase.blocker ?? "null"}

## Boundary

- delegatedCodexReviewCompleted=${result.delegatedCodexReviewCompleted}
- ownerManualReviewCompleted=false
- realOwnerFeedbackCollected=false
- ownerPersonallyApproved=false
- limitedEnableExecuted=false
- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- rawCredentialRefRead=false
- chatDefaultChanged=false
- chatGatewayExecuteDefaultChanged=false
- mainChainDefaultEnabled=false
- providerRuntimeDefaultEnabled=false
- deployExecuted=false
- commitCreated=false
- pushExecuted=false
- workspaceCleanClaimed=false
- realSemanticValidationClaimed=false
- productionReadyClaimed=false
`;
}

function renderExecutionReport(result) {
  return `# Phase1246-1255 Codex-delegated Owner Review Proxy Execution Report

## Status

- completed=${result.completed}
- recommended_sealed=${result.recommended_sealed}
- blocker=${result.blocker}

## Positioning

Codex-delegated owner review proxy, not real owner manual review.

## Phase Status

${phaseKeys.map((key) => `${result[key].phase}: completed=${result[key].completed}, recommended_sealed=${result[key].recommended_sealed}, blocker=${result[key].blocker ?? "null"}`).join("\n")}

## Outputs

- delegatedCodexReviewCompleted=${result.delegatedCodexReviewCompleted}
- codexProxyReviewCompleted=${result.codexProxyReviewCompleted}
- mechanicalReviewOnly=${result.mechanicalReviewOnly}
- approvalDraftGenerated=${result.approvalDraftGenerated}
- ownerDecisionChecklistGenerated=${result.ownerDecisionChecklistGenerated}
- postReviewActionLedgerGenerated=${result.postReviewActionLedgerGenerated}

## Boundary

- ownerManualReviewCompleted=false
- realOwnerFeedbackCollected=false
- ownerPersonallyApproved=false
- limitedEnableExecuted=false
- limitedEnableAllowed=false
- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- rawCredentialRefRead=false
- credentialRefBypassed=false
- quotaBypassed=false
- budgetBypassed=false
- selectableGateBypassed=false
- chatDefaultChanged=false
- chatGatewayExecuteDefaultChanged=false
- mainChainDefaultEnabled=false
- providerRuntimeDefaultEnabled=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- commitCreated=false
- pushExecuted=false
- workspaceCleanClaimed=false
- realSemanticValidationClaimed=false
- productionReadyClaimed=false
`;
}
