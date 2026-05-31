export const providerCallAuthorizationRequiredFields = Object.freeze([
  "allowProviderCall",
  "allowedProviderRefs",
  "allowedCredentialRefs",
  "allowedModelRefs",
  "maxRequests",
  "maxEstimatedCostUsd",
  "fanoutLimit",
  "approvalReason",
]);

export function validateProviderCallAuthorization(authorization = {}) {
  const missing = providerCallAuthorizationRequiredFields.filter((field) => {
    const value = authorization[field];
    if (field === "allowProviderCall") return value !== true;
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === null || value === "";
  });
  return {
    valid: missing.length === 0,
    missing,
  };
}

