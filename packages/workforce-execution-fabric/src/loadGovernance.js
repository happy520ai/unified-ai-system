export function applyExecutionLoadGovernance(plan, options = {}) {
  const maxActiveBranches = options.maxActiveBranches || plan.maxActiveBranches || 3;
  const maxActiveEmployees = options.maxActiveEmployees || plan.maxActiveEmployees || 3;
  const activeBranches = plan.branches.slice(0, maxActiveBranches);
  const shedBranches = plan.branches.slice(maxActiveBranches).map((branch) => ({
    branchId: branch.branchId,
    reason: "branch_load_governance_limit",
  }));
  const employeeSeen = new Set();
  const activeEmployees = [];
  for (const branch of activeBranches) {
    for (const employeeId of branch.assignedEmployees) {
      if (!employeeSeen.has(employeeId) && activeEmployees.length < maxActiveEmployees) {
        employeeSeen.add(employeeId);
        activeEmployees.push(employeeId);
      }
    }
  }
  const rejectedEmployees = activeBranches
    .flatMap((branch) => branch.assignedEmployees)
    .filter((employeeId) => !activeEmployees.includes(employeeId))
    .map((employeeId) => ({ employeeId, reason: "employee_load_governance_limit" }));
  return {
    governanceId: "phase578-load-governance",
    activeBranches,
    shedBranches,
    activeEmployees,
    rejectedEmployees,
    noAllEmployeeBroadcast: true,
    maxBrainCalls: 0,
    providerCallsMade: false,
  };
}

export function validateExecutionLoadGovernance(governance) {
  return {
    valid:
      Array.isArray(governance?.activeBranches) &&
      governance.activeBranches.length <= 3 &&
      Array.isArray(governance?.activeEmployees) &&
      governance.activeEmployees.length <= 3 &&
      governance?.noAllEmployeeBroadcast === true &&
      governance?.maxBrainCalls === 0 &&
      governance?.providerCallsMade === false,
    activeBranchCount: governance?.activeBranches?.length || 0,
    activeEmployeeCount: governance?.activeEmployees?.length || 0,
  };
}
