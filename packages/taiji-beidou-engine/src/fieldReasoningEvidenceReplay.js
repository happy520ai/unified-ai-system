export const FIELD_REASONING_EVIDENCE_REPLAY_SCHEMA_VERSION = "phase1205.field-reasoning-evidence-replay.v1";

export function buildFieldReasoningEvidenceReplay(input = {}) {
  const readout = input.readout || {};
  const alignment = input.alignment || {};
  const sourceTrace = [
    trace("phase1201_minimal_field", "Synthetic vector field prototype supplied field reasoning baseline."),
    trace("phase1202_task_source_schema", "Task concept sources supplied positive, negative, constraint, and context sources."),
    trace("phase1203_candidate_readout", "Candidate capabilities were generated from source schemas."),
  ];
  const fieldStepTrace = [
    trace("field_step_collect_sources", "Collect synthetic sources and candidate target vectors."),
    trace("field_step_apply_negative_sources", "Preserve blocked reasons as negative fields."),
    trace("field_step_readout_candidates", "Read candidate capabilities without runtime execution."),
  ];
  const candidateTrace = (readout.candidateCapabilities || []).map((candidate) => ({
    id: `candidate_trace_${candidate.id}`,
    candidateId: candidate.id,
    sourceTaskId: candidate.sourceTaskId,
    evidenceRequired: candidate.evidenceRequired === true,
    dryRunOnly: true,
  }));
  const blockedReasonTrace = (readout.blockedCandidates || []).map((candidate) => ({
    id: `blocked_trace_${candidate.id}`,
    reason: candidate.reason,
    blocked: true,
    runtimeDispatch: false,
  }));
  const approvalReasonTrace = (readout.approvalRequiredCandidates || []).map((candidate) => ({
    id: `approval_trace_${candidate.id}`,
    approvalReason: candidate.approvalReason,
    ownerApproved: false,
  }));

  return {
    schemaVersion: FIELD_REASONING_EVIDENCE_REPLAY_SCHEMA_VERSION,
    phase: "Phase1205",
    verificationMode: "synthetic-dry-run",
    sourceTrace,
    fieldStepTrace,
    candidateTrace,
    blockedReasonTrace,
    approvalReasonTrace,
    readoutTrace: {
      plannerRecommendationId: alignment.plannerRecommendation?.recommendationId || "tianshu_dry_run_alignment_preview",
      routeCandidateCount: alignment.routeCandidates?.length || 0,
      replayRuntimeModified: false,
      previewOnly: true,
    },
    trace: {
      syntheticOnly: true,
      evidenceRef: "apps/ai-gateway-service/evidence/phase1205-field-reasoning-evidence-replay/field-reasoning-evidence-replay-result.json",
    },
  };
}

export function validateFieldReasoningEvidenceReplay(replay) {
  const errors = [];
  if (replay?.schemaVersion !== FIELD_REASONING_EVIDENCE_REPLAY_SCHEMA_VERSION) errors.push("schemaVersion_invalid");
  if (replay?.phase !== "Phase1205") errors.push("phase_invalid");
  for (const field of ["sourceTrace", "fieldStepTrace", "candidateTrace", "blockedReasonTrace", "approvalReasonTrace"]) {
    if (!Array.isArray(replay?.[field])) errors.push(`${field}_missing`);
  }
  if (!replay?.readoutTrace?.previewOnly) errors.push("readoutTrace_previewOnly_missing");
  if (replay?.trace?.syntheticOnly !== true) errors.push("syntheticOnly_not_true");
  return {
    valid: errors.length === 0,
    errors,
  };
}

function trace(id, summary) {
  return {
    id,
    summary,
    syntheticOnly: true,
    runtimeDispatch: false,
  };
}
