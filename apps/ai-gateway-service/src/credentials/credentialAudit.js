import { redactCredentialRef } from "./credentialRedactor.js";

export function createCredentialAuditEvent({ eventType, credentialRef, providerId, result, details = {} } = {}) {
  return {
    eventType,
    providerId: providerId || "unknown",
    credentialRef: redactCredentialRef(credentialRef),
    result: result || "unknown",
    details,
    recordedAt: new Date().toISOString(),
  };
}
