import { runExternalRunnerPreviewVerification } from "./verifyExternalRunnerPreviewCommon.js";

const phase = "phase-146a-runner-request-review-queue";

await runExternalRunnerPreviewVerification({
  phase,
  fieldName: "runnerRequestQueuePreview",
  scriptName: "verify:phase146a-runner-request-review-queue",
  serviceScript: "node ./src/entrypoints/verifyAgentWorkforceRunnerRequestReviewQueue.js",
  prerequisiteEvidence: "apps/ai-gateway-service/evidence/phase-145a-external-omx-runner-design.json",
  prerequisiteError: "Phase 145A prerequisite evidence must be passed with runnerEnabled=false, executionEnabled=false, and designOnly=true.",
  prerequisiteOk: (body) =>
    body.status === "passed" &&
    body.workforce?.runnerEnabled === false &&
    body.workforce?.executionEnabled === false &&
    body.workforce?.designOnly === true,
  testGoal: "Preview a future external runner request review queue without dispatch.",
  acceptanceText: "Verify queueEnabled false, executionEnabled false, draft-review-only, and blocked reasons.",
  previewOk: (preview) =>
    preview.mode === "review-queue-preview" &&
    preview.queueEnabled === false &&
    preview.executionEnabled === false &&
    preview.requestState === "draft-review-only" &&
    preview.queuePolicy?.autoDispatchEnabled === false &&
    preview.queuePolicy?.externalRunnerDispatchEnabled === false &&
    preview.queuePolicy?.approvalPreviewIsExecutionPermission === false &&
    Array.isArray(preview.blockedReasons) &&
    preview.blockedReasons.length >= 4,
  markdownHeading: "Runner Request Review Queue Preview",
  contractName: "WorkforceRunnerRequestQueuePreview",
  contractMarkers: ["queueEnabled: false", "externalRunnerDispatchEnabled: false"],
  uiPhaseMarker: "phase146a-runner-request-review-queue",
  uiTitle: "Phase146A Runner Request Review Queue Preview",
  uiMarkers: ["queueEnabled=false", "external runner dispatch is disabled"],
  readmeMarker: "Phase 146A",
  agentsMarker: "Phase 146A Runner Request Review Queue Preview Boundary",
  evidenceTitle: "Phase 146A Runner Request Review Queue Preview Evidence",
  passConclusion: "runner-request-review-queue-preview-closed",
  failConclusion: "runner-request-review-queue-preview-not-closed",
  workforceSummary: (preview, packageBody) => ({
    queueEnabled: preview.queueEnabled ?? null,
    executionEnabled: preview.executionEnabled ?? null,
    requestState: preview.requestState ?? null,
    autoDispatchEnabled: preview.queuePolicy?.autoDispatchEnabled ?? null,
    externalRunnerDispatchEnabled: preview.queuePolicy?.externalRunnerDispatchEnabled ?? null,
    blockedReasonCount: preview.blockedReasons?.length ?? 0,
    executionReadinessOverallStatus: packageBody.executionReadinessPreflight?.overallStatus ?? null,
  }),
});
