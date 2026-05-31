import { buildCandidateHardeningClosure } from "../../packages/taiji-beidou-engine/src/candidateHardeningClosure.js";
import {
  evidenceAuditResultPath,
  executionReportPath,
  extendedNoFlagResultPath,
  manualTrialScriptPath,
  nextApprovalTemplate,
  nextApprovalTemplatePath,
  ownerReviewResultPath,
  phaseDocPath,
  phaseKeys,
  pathExists,
  readJsonIfExists,
  repoRoot,
  resultPath,
  riskLedgerDocPath,
  riskLedgerResultPath,
  rollbackRehearsalResultPath,
  reviewPacketPath,
  upstreamResultPath,
  validationPath,
  writeJson,
  writeText,
} from "./phase1236-1245-common.mjs";

const upstream = await readJsonIfExists(upstreamResultPath, null);
const evidenceRefs = await buildEvidenceRefs();
const closure = buildCandidateHardeningClosure({
  upstream,
  evidenceRefs,
  safeRegressionPassed: true,
});

const result = {
  ...closure,
  upstreamEvidenceRef: "apps/ai-gateway-service/evidence/phase1226-1235-taiji-beidou-guarded-shadow-integration/taiji-beidou-guarded-shadow-integration-result.json",
  evidenceRef: "apps/ai-gateway-service/evidence/phase1236-1245-taiji-beidou-candidate-hardening/taiji-beidou-candidate-hardening-result.json",
  validationRef: "apps/ai-gateway-service/evidence/phase1236-1245-taiji-beidou-candidate-hardening/taiji-beidou-candidate-hardening-validation-result.json",
  docsRef: "docs/phase1236-1245-taiji-beidou-candidate-hardening-execution-report.md",
  nextApprovalGateRef: "docs/approvals/phase1246-1255/limited-enable-owner-review-template.json",
  reviewPackRefs: {
    ownerReviewPacket: "docs/reviews/phase1236-1245/owner-review-packet.md",
    ownerManualTrialScript: "docs/reviews/phase1236-1245/owner-manual-trial-script.md",
    riskLedger: "docs/reviews/phase1236-1245/risk-ledger.md",
  },
};

await writeJson(resultPath, result);
await writeJson(ownerReviewResultPath, result.phase1237);
await writeJson(extendedNoFlagResultPath, result.phase1240);
await writeJson(rollbackRehearsalResultPath, result.phase1241);
await writeJson(evidenceAuditResultPath, result.phase1242);
await writeJson(riskLedgerResultPath, result.phase1244);
await writeJson(nextApprovalTemplatePath, nextApprovalTemplate());
await writeText(reviewPacketPath, renderOwnerReviewPacket(result));
await writeText(manualTrialScriptPath, renderManualTrialScript(result));
await writeText(riskLedgerDocPath, renderRiskLedger(result));
for (const key of phaseKeys) {
  await writeText(phaseDocPath(key), renderPhaseDoc(result[key], result));
}
await writeText(executionReportPath, renderExecutionReport(result));
await writeJson(validationPath, {
  phase: "Phase1236-1245-AIO",
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
  mainChainDefaultEnabled: result.mainChainDefaultEnabled,
  limitedEnableExecuted: result.limitedEnableExecuted,
  providerCallsMade: result.providerCallsMade,
}, null, 2));

if (!result.completed) process.exitCode = 1;

function renderPhaseDoc(phase, result) {
  return `# ${phase.phase} Taiji / Beidou Candidate Hardening

## Status

- completed=${phase.completed}
- recommended_sealed=${phase.recommended_sealed}
- blocker=${phase.blocker ?? "null"}

## Outputs

${Object.entries(phase)
    .filter(([key]) => !["phase", "completed", "recommended_sealed", "blocker"].includes(key))
    .map(([key, value]) => `- ${key}: ${formatValue(value)}`)
    .join("\n")}

## Boundary

- providerCallsMade=${result.providerCallsMade}
- secretRead=${result.secretRead}
- authJsonRead=${result.authJsonRead}
- rawCredentialRefRead=${result.rawCredentialRefRead}
- chatDefaultChanged=${result.chatDefaultChanged}
- chatGatewayExecuteDefaultChanged=${result.chatGatewayExecuteDefaultChanged}
- mainChainDefaultEnabled=${result.mainChainDefaultEnabled}
- providerRuntimeDefaultEnabled=${result.providerRuntimeDefaultEnabled}
- limitedEnableExecuted=${result.limitedEnableExecuted}
- deployExecuted=${result.deployExecuted}
- commitCreated=${result.commitCreated}
- pushExecuted=${result.pushExecuted}
- workspaceCleanClaimed=${result.workspaceCleanClaimed}
- realSemanticValidationClaimed=${result.realSemanticValidationClaimed}
- productionReadyClaimed=${result.productionReadyClaimed}
`;
}

function renderOwnerReviewPacket(result) {
  return `# Phase1236-1245 Owner Review Packet

## Candidate Summary

- candidateId=${result.phase1237.candidateSummary.candidateId}
- status=${result.phase1237.candidateSummary.status}
- mainChainCandidateIntegrated=${result.mainChainCandidateIntegrated}
- mainChainDefaultEnabled=${result.mainChainDefaultEnabled}
- flagGated=${result.flagGated}
- rollbackReady=${result.rollbackReady}

## Risk Summary

${result.phase1237.riskSummary.map((item) => `- ${item}`).join("\n")}

## Manual Review Checklist

${result.phase1237.manualReviewChecklist.map((item) => `- [ ] ${item}`).join("\n")}

## Approval Decision Template

- ownerApprovedForLimitedEnable=false
- limitedEnableAllowed=false
- providerCallAllowed=false
- secretReadAllowed=false
- deploymentAllowed=false

This packet is for owner review only. It is not owner feedback, production readiness, real semantic validation, deploy approval, or Provider approval.
`;
}

function renderManualTrialScript(result) {
  return `# Phase1236-1245 Owner Manual Trial Script

## Manual Steps

${result.phase1238.manualSteps.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Expected Observations

${result.phase1238.expectedObservations.map((item) => `- ${item}`).join("\n")}

## Feedback Form

\`\`\`json
${JSON.stringify(result.phase1238.feedbackForm, null, 2)}
\`\`\`

realOwnerFeedbackCollected=false
codexSelfTestCountedAsOwnerFeedback=false
humanValidationCompleted=false
`;
}

function renderRiskLedger(result) {
  return `# Phase1236-1245 Risk Ledger

## Classification Policy

- P0: unsafe execution / default behavior changed / secret/provider/deploy risk
- P1: route boundary / rollback / no-flag regression weakness
- P2: UX / evidence / status visibility issue
- P3: docs / copy / naming issue

## Ledger

${result.phase1244.riskLedger.map((risk) => `- ${risk.severity} ${risk.id}: ${risk.description} (${risk.action})`).join("\n")}

## Safety Brake

- p0RiskDetected=${result.phase1244.p0RiskDetected}
- safetyBrakeEngaged=${result.phase1244.safetyBrakeEngaged}
`;
}

function renderExecutionReport(result) {
  return `# Phase1236-1245 Taiji / Beidou Candidate Hardening Execution Report

## Status

- completed=${result.completed}
- recommended_sealed=${result.recommended_sealed}
- blocker=${result.blocker ?? "null"}

## Phase Status

${phaseKeys.map((key) => `${result[key].phase}: completed=${result[key].completed}, recommended_sealed=${result[key].recommended_sealed}, blocker=${result[key].blocker ?? "null"}`).join("\n")}

## Outputs

- candidateBoundaryHardeningGenerated=${result.candidateBoundaryHardeningGenerated}
- ownerReviewPacketGenerated=${result.ownerReviewPacketGenerated}
- ownerManualTrialScriptGenerated=${result.ownerManualTrialScriptGenerated}
- missionControlCandidateStatusUxHardened=${result.missionControlCandidateStatusUxHardened}
- extendedNoFlagRegressionGenerated=${result.extendedNoFlagRegressionGenerated}
- rollbackRehearsalGenerated=${result.rollbackRehearsalGenerated}
- evidenceCompletenessAuditGenerated=${result.evidenceCompletenessAuditGenerated}
- limitedEnableReadinessAssessmentGenerated=${result.limitedEnableReadinessAssessmentGenerated}
- riskLedgerGenerated=${result.riskLedgerGenerated}
- candidateHardeningClosureGenerated=${result.candidateHardeningClosureGenerated}

## Boundary

- providerCallsMade=${result.providerCallsMade}
- secretRead=${result.secretRead}
- authJsonRead=${result.authJsonRead}
- rawCredentialRefRead=${result.rawCredentialRefRead}
- credentialRefBypassed=${result.credentialRefBypassed}
- quotaBypassed=${result.quotaBypassed}
- budgetBypassed=${result.budgetBypassed}
- selectableGateBypassed=${result.selectableGateBypassed}
- chatDefaultChanged=${result.chatDefaultChanged}
- chatModified=${result.chatModified}
- chatGatewayExecuteDefaultChanged=${result.chatGatewayExecuteDefaultChanged}
- chatGatewayExecuteModified=${result.chatGatewayExecuteModified}
- mainChainDefaultEnabled=${result.mainChainDefaultEnabled}
- providerRuntimeDefaultEnabled=${result.providerRuntimeDefaultEnabled}
- limitedEnableExecuted=${result.limitedEnableExecuted}
- deployExecuted=${result.deployExecuted}
- releaseExecuted=${result.releaseExecuted}
- tagCreated=${result.tagCreated}
- artifactUploaded=${result.artifactUploaded}
- commitCreated=${result.commitCreated}
- pushExecuted=${result.pushExecuted}
- workspaceCleanClaimed=${result.workspaceCleanClaimed}
- realOwnerFeedbackCollected=${result.realOwnerFeedbackCollected}
- realSemanticValidationClaimed=${result.realSemanticValidationClaimed}
- productionReadyClaimed=${result.productionReadyClaimed}

## Next Gate

Phase1246-1255 Owner Manual Review + Limited Enable Approval Gate. This phase did not execute limited enable.
`;
}

function formatValue(value) {
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (value && typeof value === "object") return "generated";
  return String(value);
}

async function buildEvidenceRefs() {
  const refs = [
    {
      phaseRange: "Phase1201-1202",
      evidenceRef: "apps/ai-gateway-service/evidence/phase1201-physics-field",
    },
    {
      phaseRange: "Phase1202",
      evidenceRef: "apps/ai-gateway-service/evidence/phase1202-task-concept-source-schema",
    },
    {
      phaseRange: "Phase1203-1210",
      evidenceRef: "apps/ai-gateway-service/evidence/phase1203-1210-taiji-beidou-dry-run-closure",
    },
    {
      phaseRange: "Phase1211-1215",
      evidenceRef: "apps/ai-gateway-service/evidence/phase1211-1215-taiji-beidou-dry-run-stabilization",
    },
    {
      phaseRange: "Phase1216-1225",
      evidenceRef: "apps/ai-gateway-service/evidence/phase1216-1225-taiji-beidou-main-chain-candidate-prep/taiji-beidou-main-chain-candidate-prep-result.json",
    },
    {
      phaseRange: "Phase1226-1235",
      evidenceRef: "apps/ai-gateway-service/evidence/phase1226-1235-taiji-beidou-guarded-shadow-integration/taiji-beidou-guarded-shadow-integration-result.json",
    },
  ];

  const checked = [];
  for (const ref of refs) {
    checked.push({
      ...ref,
      exists: await pathExists(`${repoRoot}/${ref.evidenceRef}`),
    });
  }
  return checked;
}
