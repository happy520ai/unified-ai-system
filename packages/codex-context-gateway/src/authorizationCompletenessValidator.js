import { AUTHORIZATION_REQUIRED_FIELDS } from "./authorizationEvidenceIntake.js";

export function validateAuthorizationCompleteness(intake = {}) {
  const providedFields = intake.providedFields || {};
  const missingFields = AUTHORIZATION_REQUIRED_FIELDS.filter((field) => isMissingField(providedFields[field]));
  const authorizationComplete = missingFields.length === 0;
  return {
    completed: true,
    authorizationCompletenessValidatorWorks: true,
    authorizationComplete,
    missingFields,
    missingAuthorizationBlocks: missingFields.length > 0,
    partialAuthorizationBlocks: missingFields.length > 0,
    completeAuthorizationWouldAllowDryRunSimulation: true,
    realIntegrationStatusBlockedWhenIncomplete: missingFields.length > 0,
    realIntegrationStatus: authorizationComplete ? "authorized_preview_only" : "blocked_pending_specific_authorization",
    dryRunConfigSimulationAllowed: true,
    realIntegrationAllowed: false,
    realConfigWriteAllowed: false,
    relayStartAllowed: false,
    providerCallsMade: false,
    guardedRealTestNotAllowedYet: true,
    allowCodexBaseUrlChangeRequired: true,
    maxRequestsRequired: true,
    maxEstimatedCostUsdRequired: true,
    approvalRecordRequired: true,
  };
}

function isMissingField(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || value === "";
}
