export function executeDryRunBranches(governance, failureScenarios = []) {
  return governance.activeBranches.map((branch) => executeDryRunBranch(branch, failureScenarios));
}

export function executeDryRunBranch(branch, failureScenarios = []) {
  const injected = failureScenarios.find((scenario) => scenario.branchId === branch.branchId);
  if (injected) {
    return {
      branchId: branch.branchId,
      title: branch.title,
      executionStatus: "degraded",
      completionVerified: false,
      failureInjected: true,
      failureType: injected.type,
      verificationReason: `Failure injection handled without pass claim: ${injected.type}`,
      output: null,
      providerCallsMade: false,
      rawSecretAccessed: false,
      secretValueExposed: false,
    };
  }
  return {
    branchId: branch.branchId,
    title: branch.title,
    executionStatus: "dry_run_completed",
    completionVerified: true,
    failureInjected: false,
    output: {
      outputType: branch.expectedOutput,
      summary: `${branch.title} produced dry-run output for ${branch.objective}`,
      evidenceRefs: [`${branch.branchId}:dry-run-output`],
    },
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
  };
}

export function validateDryRunBranchResults(results) {
  return {
    valid:
      Array.isArray(results) &&
      results.length > 0 &&
      results.every((result) => result.providerCallsMade === false && result.rawSecretAccessed === false && result.secretValueExposed === false),
    completedCount: results.filter((result) => result.completionVerified === true).length,
    degradedCount: results.filter((result) => result.completionVerified === false).length,
  };
}
