import { createPreviewBrainBinding } from "./modelBrainBindingPolicy.js";
import { buildBrainCallEvidence } from "./brainCallEvidence.js";

export function runDryRunBrainAdapter({ employee, taskUnderstanding }) {
  const binding = createPreviewBrainBinding(employee?.brainBinding || {});
  const evidence = buildBrainCallEvidence({
    employeeId: employee.employeeId,
    title: employee.title,
    taskType: taskUnderstanding.taskType,
    binding,
  });
  return {
    mode: "dry_run",
    employeeId: employee.employeeId,
    title: employee.title,
    simulatedContribution: `${employee.title} dry-run contribution for ${taskUnderstanding.taskType}`,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    evidence,
  };
}
