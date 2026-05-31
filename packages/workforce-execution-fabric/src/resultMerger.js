export function mergeBranchResults(results) {
  const accepted = results.filter((result) => result.completionVerified === true);
  const rejected = results.filter((result) => result.completionVerified !== true);
  const conflicts = rejected.map((result) => ({
    branchId: result.branchId,
    reason: result.failureType || "branch_not_verified",
    resolution: "keep_out_of_final_answer_until_reviewed",
  }));
  return {
    mergeId: "phase578-result-merger",
    acceptedBranchIds: accepted.map((result) => result.branchId),
    rejectedBranchIds: rejected.map((result) => result.branchId),
    conflictCount: conflicts.length,
    conflicts,
    finalSummary: accepted.map((result) => result.output?.summary).filter(Boolean).join(" | "),
    completionVerified: rejected.length === 0,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
  };
}

export function validateMergedResult(merged) {
  return {
    valid:
      Array.isArray(merged?.acceptedBranchIds) &&
      Array.isArray(merged?.rejectedBranchIds) &&
      Array.isArray(merged?.conflicts) &&
      merged?.providerCallsMade === false &&
      merged?.rawSecretAccessed === false &&
      merged?.secretValueExposed === false,
    conflictCount: merged?.conflictCount || 0,
  };
}
