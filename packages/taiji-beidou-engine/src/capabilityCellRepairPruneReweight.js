export const CAPABILITY_CELL_REPAIR_PRUNE_REWEIGHT_SCHEMA_VERSION = "phase1208.capability-cell-repair-prune-reweight.v1";

export function buildCapabilityCellRepairPruneReweight(input = {}) {
  const generation = input.generation || {};
  const cells = generation.capabilityCells || [];
  const repairedCells = cells.map((cell) => ({
    ...cell,
    repaired: true,
    repairAction: "attach_missing_evidence_refs_and_boundary_flags",
    runtimeWorkerCreated: false,
  }));
  const prunedCells = cells
    .filter((cell) => /provider|secret|deploy|main_chain/i.test(cell.capabilityId))
    .map((cell) => ({
      cellId: cell.id,
      capabilityId: cell.capabilityId,
      pruned: true,
      runtimeDeleted: false,
    }));
  const reweightedCells = repairedCells.map((cell, index) => ({
    cellId: cell.id,
    capabilityId: cell.capabilityId,
    previousWeight: Number((1 / Math.max(1, cells.length)).toFixed(4)),
    newWeight: Number(((cells.length - index) / Math.max(1, cells.length)).toFixed(4)),
    weightingMode: "synthetic_boundary_aware_preview",
  }));

  return {
    schemaVersion: CAPABILITY_CELL_REPAIR_PRUNE_REWEIGHT_SCHEMA_VERSION,
    phase: "Phase1208",
    verificationMode: "synthetic-dry-run",
    repairedCells,
    prunedCells,
    reweightedCells,
    repairReasons: repairedCells.map((cell) => ({
      cellId: cell.id,
      reason: "ensure_evidence_refs_and_runtime_disabled_flags_are_visible",
    })),
    pruneReasons: prunedCells.length > 0
      ? prunedCells.map((cell) => ({ cellId: cell.cellId, reason: "forbidden_runtime_or_provider_boundary_candidate" }))
      : [{ cellId: "none", reason: "no_real_module_deleted_or_pruned_in_runtime" }],
    weightingReasons: reweightedCells.map((cell) => ({
      cellId: cell.cellId,
      reason: "prefer_readout_and_preview_cells_over_runtime_integration_candidates",
    })),
    runtimeModulesDeleted: false,
    trace: {
      syntheticOnly: true,
      evidenceRef: "apps/ai-gateway-service/evidence/phase1208-capability-cell-repair-prune-reweight/capability-cell-repair-prune-reweight-result.json",
    },
  };
}

export function validateCapabilityCellRepairPruneReweight(result) {
  const errors = [];
  if (result?.schemaVersion !== CAPABILITY_CELL_REPAIR_PRUNE_REWEIGHT_SCHEMA_VERSION) errors.push("schemaVersion_invalid");
  if (result?.phase !== "Phase1208") errors.push("phase_invalid");
  for (const field of ["repairedCells", "reweightedCells", "repairReasons", "pruneReasons", "weightingReasons"]) {
    if (!Array.isArray(result?.[field]) || result[field].length === 0) errors.push(`${field}_missing`);
  }
  if (!Array.isArray(result?.prunedCells)) errors.push("prunedCells_missing");
  if (result?.runtimeModulesDeleted !== false) errors.push("runtimeModulesDeleted_not_false");
  if (result?.trace?.syntheticOnly !== true) errors.push("syntheticOnly_not_true");
  return {
    valid: errors.length === 0,
    errors,
  };
}
