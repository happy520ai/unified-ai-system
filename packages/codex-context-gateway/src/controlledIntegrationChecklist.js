export function buildControlledIntegrationChecklist() {
  const items = [
    "approval file exists",
    "allowCodexBaseUrlChange=true",
    "config scope selected",
    "relay endpoint approved",
    "credentialRef approved",
    "account pool approved",
    "maxRequests set",
    "maxEstimatedCostUsd set",
    "rollback owner assigned",
    "dry-run context pack fresh",
    "token budget respected",
    "emergency disable plan ready",
  ];
  return {
    completed: true,
    checklistGenerated: true,
    items,
    approvalRequired: true,
    maxRequestsIncluded: items.includes("maxRequests set"),
    maxCostIncluded: items.includes("maxEstimatedCostUsd set"),
    rollbackOwnerIncluded: items.includes("rollback owner assigned"),
    emergencyDisableIncluded: items.includes("emergency disable plan ready"),
  };
}
