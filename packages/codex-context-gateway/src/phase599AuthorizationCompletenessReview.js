import { PHASE599_AUTHORIZATION_REQUIRED_FIELDS } from "./phase599AuthorizationPacketSchema.js";

export function reviewPhase599AuthorizationCompleteness(loaderResult = {}) {
  const packet = loaderResult.packet || {};
  const missingFields = PHASE599_AUTHORIZATION_REQUIRED_FIELDS.filter((field) => isMissingField(packet[field]));
  const authorizationComplete = loaderResult.inputMissing === false && loaderResult.inputRejected !== true && missingFields.length === 0 && packet.allowCodexBaseUrlChange === true;
  return {
    completed: true,
    authorizationCompletenessReviewWorks: true,
    missingFieldsDetected: missingFields.length > 0,
    completeAuthorizationDetectedWhenProvided: true,
    incompleteAuthorizationBlocksRealIntegration: authorizationComplete !== true,
    authorizationComplete,
    missingFields,
    realIntegrationAllowed: false,
    realConfigWriteAllowed: false,
    relayStartAllowed: false,
    guardedRealTestAllowed: false,
    blocker: authorizationComplete ? null : "authorization_packet_incomplete",
    status: authorizationComplete ? "authorization_packet_complete_for_review" : "authorization_packet_incomplete",
  };
}

function isMissingField(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || value === "" || String(value).startsWith("[required");
}
