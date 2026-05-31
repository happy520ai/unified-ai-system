import { runExternalRunnerPreviewVerification } from "./verifyExternalRunnerPreviewCommon.js";

const phase = "phase-148a-external-runner-protocol-freeze";

await runExternalRunnerPreviewVerification({
  phase,
  fieldName: "externalRunnerProtocolFreeze",
  scriptName: "verify:phase148a-external-runner-protocol-freeze",
  serviceScript: "node ./src/entrypoints/verifyExternalRunnerProtocolFreeze.js",
  prerequisiteEvidence: "apps/ai-gateway-service/evidence/phase-147a-execution-approval-record.json",
  prerequisiteError: "Phase 147A prerequisite evidence must be passed with approvalRecordEnabled=false and executionEnabled=false.",
  prerequisiteOk: (body) =>
    body.status === "passed" &&
    body.workforce?.approvalRecordEnabled === false &&
    body.workforce?.executionEnabled === false,
  testGoal: "Freeze the external runner preview protocol without implementing execution.",
  acceptanceText: "Verify frozen true, runnerEnabled false, executionEnabled false, designOnly true, and blocked reasons.",
  previewOk: (preview) =>
    preview.mode === "protocol-freeze" &&
    preview.protocolVersion === "preview-1" &&
    preview.frozen === true &&
    preview.runnerEnabled === false &&
    preview.executionEnabled === false &&
    preview.designOnly === true &&
    Array.isArray(preview.coveredCapabilities) &&
    preview.coveredCapabilities.includes("runnerRequestQueuePreview") &&
    preview.coveredCapabilities.includes("executionApprovalRecordPreview") &&
    Array.isArray(preview.frozenInvariants) &&
    preview.frozenInvariants.includes("default NVIDIA /chat lane is unchanged") &&
    Array.isArray(preview.blockedReasons) &&
    preview.blockedReasons.length >= 4,
  markdownHeading: "External Runner Protocol Freeze",
  contractName: "WorkforceExternalRunnerProtocolFreeze",
  contractMarkers: ["frozen: true", "runnerEnabled: false", "protocolVersion: \"preview-1\""],
  uiPhaseMarker: "phase148a-external-runner-protocol-freeze",
  uiTitle: "Phase148A External Runner Protocol Freeze",
  uiMarkers: ["frozen=true", "runnerEnabled=false", "designOnly=true"],
  readmeMarker: "Phase 148A",
  agentsMarker: "Phase 148A External Runner Protocol Freeze Boundary",
  evidenceTitle: "Phase 148A External Runner Protocol Freeze Evidence",
  passConclusion: "external-runner-protocol-freeze-preview-closed",
  failConclusion: "external-runner-protocol-freeze-preview-not-closed",
  workforceSummary: (preview, packageBody) => ({
    frozen: preview.frozen ?? null,
    runnerEnabled: preview.runnerEnabled ?? null,
    executionEnabled: preview.executionEnabled ?? null,
    designOnly: preview.designOnly ?? null,
    protocolVersion: preview.protocolVersion ?? null,
    coveredCapabilityCount: preview.coveredCapabilities?.length ?? 0,
    blockedReasonCount: preview.blockedReasons?.length ?? 0,
    approvalRecordEnabled: packageBody.executionApprovalRecordPreview?.approvalRecordEnabled ?? null,
    queueEnabled: packageBody.runnerRequestQueuePreview?.queueEnabled ?? null,
  }),
});
