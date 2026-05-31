export const TIANSHU_PLANNER_ALIGNMENT_SCHEMA_VERSION = "phase1204.tianshu-planner-alignment.v1";

export function buildTianshuPlannerAlignment(input = {}) {
  const readout = input.readout || {};
  const candidateCapabilities = readout.candidateCapabilities || [];
  const blockedCandidates = readout.blockedCandidates || [];
  const approvalRequiredCandidates = readout.approvalRequiredCandidates || [];
  const routeCandidates = candidateCapabilities.map((candidate, index) => ({
    id: `route_${candidate.id}`,
    capabilityId: candidate.id,
    rank: index + 1,
    routeType: "dry_run_candidate_route",
    allowed: true,
    runtimeDispatch: false,
    evidenceRequired: true,
  }));

  return {
    schemaVersion: TIANSHU_PLANNER_ALIGNMENT_SCHEMA_VERSION,
    phase: "Phase1204",
    verificationMode: "synthetic-dry-run",
    plannerInput: {
      sourcePhase: "Phase1203",
      candidateCapabilityCount: candidateCapabilities.length,
      blockedCandidateCount: blockedCandidates.length,
      approvalRequiredCandidateCount: approvalRequiredCandidates.length,
      runtimeDispatchAllowed: false,
    },
    plannerRecommendation: {
      recommendationId: "tianshu_dry_run_alignment_preview",
      summary: "Use dry-run candidate readout, safety source gates, evidence replay, then approval packet.",
      confidence: "synthetic-medium",
      requiresHumanApprovalBeforeRuntime: true,
    },
    routeCandidates,
    modeRecommendation: {
      mode: "tianshu-dry-run",
      mainChainDefaultEnabled: false,
      providerRuntimeDefaultEnabled: false,
      reason: "Candidate generation remains preview-only until explicit owner approval.",
    },
    executionPlanPreview: [
      step("collect_phase1203_candidates", "Read candidate capabilities from synthetic evidence."),
      step("apply_phase1206_boundaries", "Apply safety negative and cost constraint sources before cell generation."),
      step("build_phase1207_cells", "Generate capability cells in dry-run only."),
      step("prepare_phase1210_approval_packet", "Require human owner decision before any main-chain entry."),
    ],
    trace: {
      syntheticOnly: true,
      evidenceRef: "apps/ai-gateway-service/evidence/phase1204-tianshu-planner-alignment/tianshu-planner-alignment-result.json",
    },
  };
}

export function validateTianshuPlannerAlignment(alignment) {
  const errors = [];
  if (alignment?.schemaVersion !== TIANSHU_PLANNER_ALIGNMENT_SCHEMA_VERSION) errors.push("schemaVersion_invalid");
  if (alignment?.phase !== "Phase1204") errors.push("phase_invalid");
  for (const field of ["plannerInput", "plannerRecommendation", "routeCandidates", "modeRecommendation", "executionPlanPreview"]) {
    if (!hasContent(alignment?.[field])) errors.push(`${field}_missing`);
  }
  if (alignment?.modeRecommendation?.mainChainDefaultEnabled !== false) errors.push("mainChainDefaultEnabled_not_false");
  if (alignment?.modeRecommendation?.providerRuntimeDefaultEnabled !== false) errors.push("providerRuntimeDefaultEnabled_not_false");
  if (alignment?.trace?.syntheticOnly !== true) errors.push("syntheticOnly_not_true");
  return {
    valid: errors.length === 0,
    errors,
  };
}

function step(id, summary) {
  return {
    id,
    summary,
    dryRunOnly: true,
    runtimeDispatch: false,
  };
}

function hasContent(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}
