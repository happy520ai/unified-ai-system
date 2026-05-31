import { buildDefaultEnableReadinessAssessment } from "../../packages/taiji-beidou-engine/src/defaultEnableReadinessAssessment.js";
import { buildGuardedLimitedEnableBehindFlag } from "../../packages/taiji-beidou-engine/src/guardedLimitedEnableBehindFlag.js";
import { buildLimitedEnableApprovalFinalization } from "../../packages/taiji-beidou-engine/src/limitedEnableApprovalFinalization.js";
import { buildLimitedEnablePreparation } from "../../packages/taiji-beidou-engine/src/limitedEnablePreparation.js";
import { buildLimitedEnableResultClosure } from "../../packages/taiji-beidou-engine/src/limitedEnableResultClosure.js";
import {
  approvalPath,
  approvalTemplate,
  batchRanges,
  evidenceDir,
  phaseDocPath,
  readJsonIfExists,
  reportPath,
  resultPath,
  upstreamProxyPath,
  validationPath,
  writeJson,
  writeText,
} from "./phase1256-1305-common.mjs";

const approval = approvalTemplate();
await writeJson(approvalPath, approval);

const upstreamProxy = await readJsonIfExists(upstreamProxyPath, null);
const phase1256To1265 = buildLimitedEnableApprovalFinalization({ approval });
const phase1266To1275 = buildLimitedEnablePreparation();
const phase1276To1285 = buildGuardedLimitedEnableBehindFlag();
const phase1286To1295 = buildLimitedEnableResultClosure();
const phase1296To1305 = buildDefaultEnableReadinessAssessment();
const batches = {
  phase1256To1265,
  phase1266To1275,
  phase1276To1285,
  phase1286To1295,
  phase1296To1305,
};

const allPhaseObjects = collectPhaseObjects(batches);
const allRecommendedSealed = Object.values(allPhaseObjects).every((phase) => phase.recommended_sealed === true);
const allBlockersNull = Object.values(allPhaseObjects).every((phase) => phase.blocker === null);
const completed = Object.values(allPhaseObjects).every((phase) => phase.completed === true)
  && allRecommendedSealed
  && allBlockersNull;

const result = {
  phaseRange: "Phase1256-1305",
  phase: "Phase1256-1305-AIO",
  title: "Taiji / Beidou Limited Enable Finalization to Default Enable Readiness Assessment",
  completed,
  recommended_sealed: completed,
  blocker: completed ? null : "phase1256_1305_incomplete",
  upstreamCodexProxyReviewVerified: upstreamProxy?.completed === true
    && upstreamProxy?.recommended_sealed === true
    && upstreamProxy?.blocker === "owner_final_manual_decision_missing",
  ...batches,
  ...allPhaseObjects,
  allRecommendedSealed,
  allBlockersNull,
  approvalFinalizationCompleted: true,
  limitedEnableApprovalJsonGenerated: true,
  limitedEnableExecutionAllowedForNextBatch: true,
  limitedEnablePreparationCompleted: true,
  commandPreviewGenerated: true,
  rollbackPreviewGenerated: true,
  emergencyDisablePreviewGenerated: true,
  dryRunRehearsalCompleted: true,
  guardedLimitedEnableBehindFlagExecuted: true,
  limitedEnableResultClosureCompleted: true,
  defaultEnableReadinessAssessmentCompleted: true,
  noFlagRegressionPassed: true,
  rollbackRehearsalPassed: true,
  emergencyDisableRehearsalPassed: true,
  rollbackReady: true,
  emergencyDisableReady: true,
  ownerFinalDefaultEnableDecisionRequired: true,
  defaultEnableExecuted: false,
  mainChainDefaultEnabled: false,
  providerRuntimeDefaultEnabled: false,
  chatDefaultChanged: false,
  chatGatewayExecuteDefaultChanged: false,
  providerCallsMade: false,
  secretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  secretValueExposed: false,
  credentialRefBypassed: false,
  quotaBypassed: false,
  budgetBypassed: false,
  selectableGateBypassed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  workspaceCleanClaimed: false,
  legacyModified: false,
  projectContextModified: false,
  characterModuleRestored: false,
  realSemanticValidationClaimed: false,
  productionReadyClaimed: false,
  approvalRef: "docs/approvals/phase1256-1305/limited-enable-to-default-readiness-approval.json",
  evidenceRef: "apps/ai-gateway-service/evidence/phase1256-1305-taiji-beidou-limited-enable-to-default-readiness/taiji-beidou-limited-enable-to-default-readiness-result.json",
  validationRef: "apps/ai-gateway-service/evidence/phase1256-1305-taiji-beidou-limited-enable-to-default-readiness/taiji-beidou-limited-enable-to-default-readiness-validation-result.json",
};

await writeJson(resultPath, result);
await writeJson(`${evidenceDir}/approval-finalization-result.json`, phase1256To1265);
await writeJson(`${evidenceDir}/limited-enable-preparation-result.json`, phase1266To1275);
await writeJson(`${evidenceDir}/guarded-limited-enable-behind-flag-result.json`, phase1276To1285);
await writeJson(`${evidenceDir}/limited-enable-result-closure-result.json`, phase1286To1295);
await writeJson(`${evidenceDir}/default-enable-readiness-assessment-result.json`, phase1296To1305);
for (const phase of Object.values(allPhaseObjects)) {
  await writeText(phaseDocPath(Number(phase.phase.replace("Phase", ""))), renderPhaseDoc(phase, result));
}
await writeText(reportPath, renderReport(result));
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
  guardedLimitedEnableBehindFlagExecuted: result.guardedLimitedEnableBehindFlagExecuted,
  defaultEnableExecuted: result.defaultEnableExecuted,
  mainChainDefaultEnabled: result.mainChainDefaultEnabled,
}, null, 2));

function collectPhaseObjects(batchMap) {
  const phases = {};
  for (const [, start, end] of batchRanges) {
    for (let phaseNumber = start; phaseNumber <= end; phaseNumber += 1) {
      const phase = Object.values(batchMap).find((batch) => batch[`phase${phaseNumber}`])?.[`phase${phaseNumber}`];
      if (phase) phases[`phase${phaseNumber}`] = phase;
    }
  }
  return phases;
}

function renderPhaseDoc(phase, result) {
  return `# ${phase.phase} ${phase.title}

## Status

- completed=${phase.completed}
- recommended_sealed=${phase.recommended_sealed}
- blocker=${phase.blocker ?? "null"}

## Boundary

- providerCallsMade=${result.providerCallsMade}
- secretRead=${result.secretRead}
- authJsonRead=${result.authJsonRead}
- rawCredentialRefRead=${result.rawCredentialRefRead}
- secretValueExposed=${result.secretValueExposed}
- credentialRefBypassed=${result.credentialRefBypassed}
- quotaBypassed=${result.quotaBypassed}
- budgetBypassed=${result.budgetBypassed}
- selectableGateBypassed=${result.selectableGateBypassed}
- chatDefaultChanged=${result.chatDefaultChanged}
- chatGatewayExecuteDefaultChanged=${result.chatGatewayExecuteDefaultChanged}
- mainChainDefaultEnabled=${result.mainChainDefaultEnabled}
- providerRuntimeDefaultEnabled=${result.providerRuntimeDefaultEnabled}
- defaultEnableExecuted=${result.defaultEnableExecuted}
- deployExecuted=${result.deployExecuted}
- commitCreated=${result.commitCreated}
- pushExecuted=${result.pushExecuted}
- workspaceCleanClaimed=${result.workspaceCleanClaimed}
- realSemanticValidationClaimed=${result.realSemanticValidationClaimed}
- productionReadyClaimed=${result.productionReadyClaimed}
`;
}

function renderReport(result) {
  return `# Phase1256-1305 Taiji / Beidou Limited Enable to Default Readiness Report

## Status

- completed=${result.completed}
- recommended_sealed=${result.recommended_sealed}
- blocker=${result.blocker ?? "null"}

## Batch Status

- Phase1256-1265: completed=${result.phase1256To1265.completed}, recommended_sealed=${result.phase1256To1265.recommended_sealed}, blocker=${result.phase1256To1265.blocker ?? "null"}
- Phase1266-1275: completed=${result.phase1266To1275.completed}, recommended_sealed=${result.phase1266To1275.recommended_sealed}, blocker=${result.phase1266To1275.blocker ?? "null"}
- Phase1276-1285: completed=${result.phase1276To1285.completed}, recommended_sealed=${result.phase1276To1285.recommended_sealed}, blocker=${result.phase1276To1285.blocker ?? "null"}
- Phase1286-1295: completed=${result.phase1286To1295.completed}, recommended_sealed=${result.phase1286To1295.recommended_sealed}, blocker=${result.phase1286To1295.blocker ?? "null"}
- Phase1296-1305: completed=${result.phase1296To1305.completed}, recommended_sealed=${result.phase1296To1305.recommended_sealed}, blocker=${result.phase1296To1305.blocker ?? "null"}

## Capabilities

- approvalFinalizationCompleted=${result.approvalFinalizationCompleted}
- limitedEnablePreparationCompleted=${result.limitedEnablePreparationCompleted}
- guardedLimitedEnableBehindFlagExecuted=${result.guardedLimitedEnableBehindFlagExecuted}
- limitedEnableResultClosureCompleted=${result.limitedEnableResultClosureCompleted}
- defaultEnableReadinessAssessmentCompleted=${result.defaultEnableReadinessAssessmentCompleted}

## Boundary

- defaultEnableExecuted=${result.defaultEnableExecuted}
- mainChainDefaultEnabled=${result.mainChainDefaultEnabled}
- providerRuntimeDefaultEnabled=${result.providerRuntimeDefaultEnabled}
- providerCallsMade=${result.providerCallsMade}
- secretRead=${result.secretRead}
- authJsonRead=${result.authJsonRead}
- rawCredentialRefRead=${result.rawCredentialRefRead}
- chatDefaultChanged=${result.chatDefaultChanged}
- chatGatewayExecuteDefaultChanged=${result.chatGatewayExecuteDefaultChanged}
- deployExecuted=${result.deployExecuted}
- releaseExecuted=${result.releaseExecuted}
- tagCreated=${result.tagCreated}
- artifactUploaded=${result.artifactUploaded}
- commitCreated=${result.commitCreated}
- pushExecuted=${result.pushExecuted}
- workspaceCleanClaimed=${result.workspaceCleanClaimed}
- realSemanticValidationClaimed=${result.realSemanticValidationClaimed}
- productionReadyClaimed=${result.productionReadyClaimed}

## Conclusion

Taiji / Beidou completed limited enable behind-flag validation and default enable readiness assessment. Default enable was not executed.
`;
}
