import { gatewayAdapterContract } from "./gatewayAdapterContract.js";

export function runGatewayAdapterDryRun(input = {}) {
  return {
    ...gatewayAdapterContract,
    mode: "dry_run",
    inputPreview: {
      employeeId: input.employeeId || null,
      taskType: input.taskType || "general_review",
    },
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
  };
}

