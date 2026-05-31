import { validateEmployeeShape } from "../../workforce-contracts/src/index.js";
import { applyFanoutPolicy, dryRunFanoutPolicy } from "./fanoutPolicy.js";
import { understandWorkforceTask } from "./workforcePlanner.js";
import { routeTaskToRoles } from "./roleRouter.js";
import { selectEmployeesForRoles } from "./employeeSelector.js";
import { buildWorkforceEvidence } from "./evidenceBuilder.js";

export function runWorkforceDryRun(input, options = {}) {
  const policy = options.policy || dryRunFanoutPolicy;
  const taskUnderstanding = understandWorkforceTask(input);
  const roles = routeTaskToRoles(taskUnderstanding);
  const orderedEmployees = selectEmployeesForRoles(roles, options.catalog);
  const { candidateEmployees, activeEmployees, rejectedEmployees } = applyFanoutPolicy(orderedEmployees, policy);
  const selectedPyramidPath = [...new Set(activeEmployees.map((employee) => employee.pyramidLevel))];
  const evidence = buildWorkforceEvidence({
    taskUnderstanding,
    selectedPyramidPath,
    candidateEmployees,
    activeEmployees,
    rejectedEmployees,
    policy,
  });
  return {
    mode: "dry_run",
    employeeSchemaValid: [...candidateEmployees, ...activeEmployees].every((employee) => validateEmployeeShape(employee).valid),
    taskUnderstanding,
    selectedPyramidPath,
    candidateEmployees,
    activeEmployees,
    rejectedEmployees,
    fanoutPolicy: policy,
    maxBrainCalls: policy.maxBrainCalls,
    providerCallsMade: false,
    secretValueExposed: false,
    evidence,
  };
}
