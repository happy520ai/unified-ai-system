export const CAPABILITY_CELL_GENERATION_SCHEMA_VERSION = "phase1207.capability-cell-generation.v1";

export function buildCapabilityCellGeneration(input = {}) {
  const readout = input.readout || {};
  const safetyCostSources = input.safetyCostSources || {};
  const evidenceReplay = input.evidenceReplay || {};
  const candidateCapabilities = readout.candidateCapabilities || [];
  const capabilityCells = candidateCapabilities.map((candidate, index) => ({
    id: `cell_${candidate.id}`,
    capabilityId: candidate.id,
    rank: index + 1,
    status: "dry_run_candidate",
    runtimeWorkerCreated: false,
    providerCallable: false,
    mainChainCallable: false,
  }));

  return {
    schemaVersion: CAPABILITY_CELL_GENERATION_SCHEMA_VERSION,
    phase: "Phase1207",
    verificationMode: "synthetic-dry-run",
    capabilityCells,
    cellInputs: capabilityCells.map((cell) => ({
      cellId: cell.id,
      inputRefs: ["phase1203_candidate_readout", "phase1205_evidence_replay", "phase1206_safety_cost_sources"],
    })),
    cellOutputs: capabilityCells.map((cell) => ({
      cellId: cell.id,
      outputType: "dry_run_capability_cell_manifest",
      runtimeEnabled: false,
    })),
    cellRisks: capabilityCells.map((cell) => ({
      cellId: cell.id,
      riskLevel: safetyCostSources.safetyNegativeSources?.length ? "approval-gated" : "low",
      blockedRuntimeReasons: safetyCostSources.blockedRequestMatrix?.map((item) => item.id) || [],
    })),
    cellDependencies: capabilityCells.map((cell) => ({
      cellId: cell.id,
      dependsOn: ["Phase1203", "Phase1204", "Phase1205", "Phase1206"],
      dependencyMode: "evidence_ref_only",
    })),
    cellEvidenceRefs: capabilityCells.map((cell) => ({
      cellId: cell.id,
      evidenceRefs: [
        readout.trace?.evidenceRef,
        evidenceReplay.trace?.evidenceRef,
        safetyCostSources.trace?.evidenceRef,
      ].filter(Boolean),
    })),
    trace: {
      syntheticOnly: true,
      evidenceRef: "apps/ai-gateway-service/evidence/phase1207-capability-cell-generation/capability-cell-generation-result.json",
    },
  };
}

export function validateCapabilityCellGeneration(generation) {
  const errors = [];
  if (generation?.schemaVersion !== CAPABILITY_CELL_GENERATION_SCHEMA_VERSION) errors.push("schemaVersion_invalid");
  if (generation?.phase !== "Phase1207") errors.push("phase_invalid");
  for (const field of ["capabilityCells", "cellInputs", "cellOutputs", "cellRisks", "cellDependencies", "cellEvidenceRefs"]) {
    if (!Array.isArray(generation?.[field]) || generation[field].length === 0) errors.push(`${field}_missing`);
  }
  if (generation?.capabilityCells?.some((cell) => cell.runtimeWorkerCreated !== false || cell.providerCallable !== false || cell.mainChainCallable !== false)) {
    errors.push("cell_runtime_boundary_invalid");
  }
  if (generation?.trace?.syntheticOnly !== true) errors.push("syntheticOnly_not_true");
  return {
    valid: errors.length === 0,
    errors,
  };
}
