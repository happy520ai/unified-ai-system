export const REQUIRED_AUTHORIZATION_FIELDS = Object.freeze([
  "allowCodexBaseUrlChange",
  "allowedConfigScope",
  "allowedRelayRef",
  "allowedCredentialRefs",
  "allowedAccountPoolRefs",
  "maxRequests",
  "maxEstimatedCostUsd",
  "maxDurationMinutes",
  "rollbackOwner",
  "approvalReason",
  "approvalRecordRef",
]);

export function buildRelayAuthorizationGate(authorization = {}) {
  const missingFields = REQUIRED_AUTHORIZATION_FIELDS.filter((field) => {
    if (field === "allowCodexBaseUrlChange") return authorization[field] !== true;
    if (Array.isArray(authorization[field])) return authorization[field].length === 0;
    return authorization[field] === undefined || authorization[field] === null || authorization[field] === "";
  });
  return {
    completed: true,
    authorizationSchemaValid: true,
    authorizationGateDefined: true,
    requiredFields: REQUIRED_AUTHORIZATION_FIELDS,
    missingFields,
    missingAuthorizationBlocks: missingFields.length > 0,
    partialAuthorizationBlocks: missingFields.length > 0,
    allowCodexBaseUrlChangeRequired: true,
    maxRequestsRequired: true,
    maxEstimatedCostUsdRequired: true,
    approvalRecordRequired: true,
    realIntegrationStatus: missingFields.length === 0 ? "authorized_preview_only" : "blocked_pending_specific_authorization",
  };
}
