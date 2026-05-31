import { createCredentialAuditEvent } from "./credentialAudit.js";

export function createCredentialVaultAdapter({ env = process.env } = {}) {
  return {
    validateCredentialRef(credentialRef) {
      const normalized = normalizeCredentialRef(credentialRef);
      if (!normalized.type || !normalized.reference) {
        return { valid: false, code: "CREDENTIAL_REF_INVALID", normalized };
      }
      return { valid: true, code: "OK", normalized };
    },
    resolveCredentialRef(credentialRef) {
      const { type, reference } = normalizeCredentialRef(credentialRef);
      if (!type || !reference) {
        return { resolved: false, code: "CREDENTIAL_REF_MISSING", materialized: false };
      }
      if (type === "env_key_name") {
        const keyPresent = Object.prototype.hasOwnProperty.call(env, reference);
        return {
          resolved: keyPresent,
          code: keyPresent ? "ENV_KEY_REFERENCE_READY" : "CREDENTIAL_RESOLUTION_FAILED",
          materialized: false,
          referenceType: type,
          envKeyName: reference,
          secretAvailable: keyPresent,
        };
      }
      return {
        resolved: false,
        code: "CREDENTIAL_RESOLVER_NOT_IMPLEMENTED",
        materialized: false,
        referenceType: type,
        envKeyName: null,
        secretAvailable: false,
      };
    },
    redactSecret(value) {
      return value ? "[redacted]" : "";
    },
    auditCredentialAccess(event) {
      return createCredentialAuditEvent(event);
    },
  };
}

export function normalizeCredentialRef(credentialRef) {
  if (!credentialRef) return { type: "", reference: "" };
  if (typeof credentialRef === "string") {
    const parts = credentialRef.split(":");
    if (parts.length >= 2) {
      return { type: parts[0], reference: parts.slice(1).join(":") };
    }
    return { type: "env_key_name", reference: credentialRef };
  }
  return {
    type: String(credentialRef.credentialRefType || credentialRef.type || ""),
    reference: String(credentialRef.reference || credentialRef.credentialRef || credentialRef.envKeyName || ""),
  };
}
