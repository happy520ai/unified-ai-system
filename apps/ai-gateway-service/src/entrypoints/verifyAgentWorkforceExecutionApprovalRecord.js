import { runExternalRunnerPreviewVerification } from "./verifyExternalRunnerPreviewCommon.js";

const phase = "phase-147a-execution-approval-record";

await runExternalRunnerPreviewVerification({
  phase,
  fieldName: "executionApprovalRecordPreview",
  scriptName: "verify:phase147a-execution-approval-record",
  serviceScript: "node ./src/entrypoints/verifyAgentWorkforceExecutionApprovalRecord.js",
  prerequisiteEvidence: "apps/ai-gateway-service/evidence/phase-146a-runner-request-review-queue.json",
  prerequisiteError: "Phase 146A prerequisite evidence must be passed with queueEnabled=false and executionEnabled=false.",
  prerequisiteOk: (body) =>
    body.status === "passed" &&
    body.workforce?.queueEnabled === false &&
    body.workforce?.executionEnabled === false,
  testGoal: "Preview a future execution approval record without granting execution permission.",
  acceptanceText: "Verify approvalRecordEnabled false, executionEnabled false, approval state, policy, and blocked reasons.",
  previewOk: (preview) =>
    preview.mode === "approval-record-preview" &&
    preview.approvalRecordEnabled === false &&
    preview.executionEnabled === false &&
    preview.approvalState === "not-approved-for-execution" &&
    !["real-approved", "approved-for-execution"].includes(preview.approvalState) &&
    preview.approvalPolicy?.approvalPreviewIsExecutionPermission === false &&
    preview.approvalPolicy?.requiresTaskClaimToken === true &&
    preview.approvalPolicy?.requiresFreshPreflight === true &&
    preview.approvalPolicy?.requiresEvidencePlan === true &&
    Array.isArray(preview.blockedReasons) &&
    preview.blockedReasons.length >= 4,
  markdownHeading: "Execution Request Approval Record Preview",
  contractName: "WorkforceExecutionApprovalRecordPreview",
  contractMarkers: ["approvalRecordEnabled: false", "approvalPreviewIsExecutionPermission: false"],
  uiPhaseMarker: "phase147a-execution-approval-record",
  uiTitle: "Phase147A Execution Request Approval Record Preview",
  uiMarkers: ["approvalRecordEnabled=false", "approval-preview is not execution approval"],
  readmeMarker: "Phase 147A",
  agentsMarker: "Phase 147A Execution Request Approval Record Preview Boundary",
  evidenceTitle: "Phase 147A Execution Request Approval Record Preview Evidence",
  passConclusion: "execution-approval-record-preview-closed",
  failConclusion: "execution-approval-record-preview-not-closed",
  workforceSummary: (preview, packageBody) => ({
    approvalRecordEnabled: preview.approvalRecordEnabled ?? null,
    executionEnabled: preview.executionEnabled ?? null,
    approvalState: preview.approvalState ?? null,
    approvalPreviewIsExecutionPermission: preview.approvalPolicy?.approvalPreviewIsExecutionPermission ?? null,
    blockedReasonCount: preview.blockedReasons?.length ?? 0,
    queueEnabled: packageBody.runnerRequestQueuePreview?.queueEnabled ?? null,
  }),
});
