const DEFAULT_TASK =
  "Plan a guarded Mission Control branch execution preview for an internal AI Gateway task.";

export function createUnifiedInputEnvelope(input = {}) {
  const task = String(input.task || DEFAULT_TASK).trim();
  return {
    schemaVersion: "phase578.unified_io.v1",
    envelopeId: input.envelopeId || "phase578-unified-io-preview",
    mode: "dry_run",
    input: {
      task,
      operatorIntent: input.operatorIntent || "mission_control_branch_preview",
      requestedOutput: input.requestedOutput || "branch_plan_result_merge_and_evidence",
      constraints: [
        "no_provider_call",
        "no_secret_access",
        "no_external_im_send",
        "no_deploy_release_tag_or_artifact",
      ],
    },
    outputContract: {
      branchOutputsRequired: true,
      mergeOutputRequired: true,
      evidenceTimelineRequired: true,
      failureInjectionLedgerRequired: true,
      safetyBoundaryRequired: true,
    },
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
  };
}

export function validateUnifiedInputEnvelope(envelope) {
  const errors = [];
  if (envelope?.schemaVersion !== "phase578.unified_io.v1") errors.push("schemaVersion");
  if (envelope?.mode !== "dry_run") errors.push("mode");
  if (!envelope?.input?.task) errors.push("input.task");
  if (envelope?.outputContract?.branchOutputsRequired !== true) errors.push("branchOutputsRequired");
  if (envelope?.outputContract?.mergeOutputRequired !== true) errors.push("mergeOutputRequired");
  if (envelope?.providerCallsMade !== false) errors.push("providerCallsMade");
  if (envelope?.rawSecretAccessed !== false) errors.push("rawSecretAccessed");
  if (envelope?.secretValueExposed !== false) errors.push("secretValueExposed");
  return {
    valid: errors.length === 0,
    errors,
  };
}
