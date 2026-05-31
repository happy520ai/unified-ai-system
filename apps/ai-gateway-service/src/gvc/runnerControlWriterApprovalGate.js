import { buildRunnerCommandDryRun } from "./runnerCommandBridgeDryRun.js";

export const CONTROL_WRITER_APPROVAL_PHASE_ID = "Phase2024-GVC-Approval-Gated-Control-Writer-Design";
export const CONTROL_WRITER_APPROVAL_PACKET_PATH = "docs/approvals/gvc-runner-control-writer-approval-required.json";

export function buildControlWriterApprovalRequiredPacket() {
  return {
    phaseId: CONTROL_WRITER_APPROVAL_PHASE_ID,
    taskId: "gvc-runner-control-writer",
    title: "GVC Runner pause/resume/stop control writer",
    status: "approval_required",
    approvalRequired: true,
    approved: false,
    reason: "Future Phase2025 may write runner-control.json only after explicit owner approval. Phase2024 is design and dry-run only.",
    allowedCommandIntents: ["pause", "resume", "stop"],
    targetControlFile: "docs/project-brain/runner-control.json",
    requiredFields: [
      "commandIntent",
      "approvalRecordId",
      "approvedByOwner",
      "expectedResult",
      "rollbackPlan",
      "dryRunEvidenceRef",
    ],
    ownerMustProvide: {
      commandIntent: "pause",
      approvalRecordId: "",
      approvedByOwner: false,
      expectedResult: "runner-control.json would be updated for exactly one selected command intent",
      rollbackPlan: "Restore the previous runner-control.json from the before-write snapshot.",
      dryRunEvidenceRef: "apps/ai-gateway-service/evidence/phase2024-gvc-approval-gated-control-writer-design/approval-gated-control-writer-design-result.json",
    },
    constraints: {
      dryRunBeforeApproval: true,
      realWriteAllowedOnlyAfterApproval: true,
      processSignalAllowed: false,
      allowedFiles: ["docs/project-brain/runner-control.json"],
      forbiddenPaths: ["legacy/", "PROJECT_CONTEXT.md", ".env", ".git", "node_modules"],
      maxFilesWritable: 1,
      noProvider: true,
      noSecret: true,
      noDeploy: true,
      noChatRouteModification: true,
      noChatGatewayExecuteModification: true,
    },
    safety: {
      providerCallsMade: false,
      secretRead: false,
      deployExecuted: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      legacyModified: false,
      projectContextModified: false,
      processSignalSent: false,
      realWritePerformed: false,
    },
    rollbackPlan: {
      beforeWriteSnapshotRequired: true,
      restorePreviousControlFile: true,
      stopOnVerifierFailure: true,
      verifierCommand: "pnpm run verify:phase2025-gvc-approval-gated-control-writer",
    },
  };
}

export function validateControlWriterApprovalPacket(packet) {
  const errors = [];
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    return { valid: false, errors: ["packet_not_object"] };
  }

  if (packet.phaseId !== CONTROL_WRITER_APPROVAL_PHASE_ID) errors.push("phase_id_mismatch");
  if (packet.status !== "approval_required") errors.push("status_mismatch");
  if (packet.approvalRequired !== true) errors.push("approval_required_not_true");
  if (packet.approved !== false) errors.push("approved_must_be_false_in_phase2024");
  if (packet.targetControlFile !== "docs/project-brain/runner-control.json") errors.push("target_control_file_mismatch");

  for (const commandIntent of ["pause", "resume", "stop"]) {
    if (!packet.allowedCommandIntents?.includes(commandIntent)) {
      errors.push(`missing_command_${commandIntent}`);
    }
  }

  for (const field of ["commandIntent", "approvalRecordId", "approvedByOwner", "expectedResult", "rollbackPlan"]) {
    if (!packet.requiredFields?.includes(field)) {
      errors.push(`missing_required_field_${field}`);
    }
  }

  if (packet.constraints?.dryRunBeforeApproval !== true) errors.push("dry_run_before_approval_required");
  if (packet.constraints?.realWriteAllowedOnlyAfterApproval !== true) errors.push("real_write_must_require_approval");
  if (packet.constraints?.processSignalAllowed !== false) errors.push("process_signal_must_stay_false");
  if (packet.safety?.providerCallsMade !== false) errors.push("provider_calls_must_be_false");
  if (packet.safety?.secretRead !== false) errors.push("secret_read_must_be_false");
  if (packet.safety?.realWritePerformed !== false) errors.push("real_write_must_be_false");
  if (packet.safety?.processSignalSent !== false) errors.push("process_signal_sent_must_be_false");

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function buildApprovalGatedControlWriterDryRun(options = {}) {
  const commandIntent = normalizeCommandIntent(options.commandIntent);
  const approvalPacket = options.approvalPacket ?? buildControlWriterApprovalRequiredPacket();
  const validation = validateControlWriterApprovalPacket(approvalPacket);
  const phase2023BridgePreview = buildRunnerCommandDryRun(commandIntent, {
    currentControl: options.currentControl,
    now: options.now,
  });
  const approvalGateSatisfied = validation.valid === true && approvalPacket.approved === true;

  return {
    phaseId: CONTROL_WRITER_APPROVAL_PHASE_ID,
    status: "approval_required_dry_run",
    generatedAt: options.now ?? new Date().toISOString(),
    commandIntent,
    approvalPacketPath: CONTROL_WRITER_APPROVAL_PACKET_PATH,
    approvalGateSatisfied,
    approvalPacketValid: validation.valid,
    approvalValidationErrors: validation.errors,
    targetControlFile: approvalPacket.targetControlFile,
    wouldWriteControlFile: phase2023BridgePreview.wouldWriteControlFile === true,
    realWritePerformed: false,
    processSignalSent: false,
    runnerStopped: false,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    phase2023BridgePreview,
    nextPhaseRequiredForRealWrite: "Phase2025-GVC-Approval-Gated-Real-Control-Writer",
  };
}

function normalizeCommandIntent(commandIntent) {
  const normalized = String(commandIntent ?? "").trim().toLowerCase();
  return ["pause", "resume", "stop"].includes(normalized) ? normalized : "pause";
}
