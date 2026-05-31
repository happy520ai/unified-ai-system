import { createCredentialVaultAdapter } from "./credentialVaultAdapter.js";

export function createCredentialResolver({ env = process.env, adapter = createCredentialVaultAdapter({ env }) } = {}) {
  return {
    validateCredentialRef(credentialRef) {
      return adapter.validateCredentialRef(credentialRef);
    },
    resolveCredentialRef(credentialRef) {
      const validation = adapter.validateCredentialRef(credentialRef);
      if (!validation.valid) {
        return { resolved: false, code: validation.code, validation };
      }
      const resolution = adapter.resolveCredentialRef(credentialRef);
      return {
        ...resolution,
        validation,
        safeSummary: {
          referenceType: resolution.referenceType ?? validation.normalized?.type ?? "",
          envKeyName: resolution.envKeyName || validation.normalized?.reference || "",
          secretAvailable: resolution.secretAvailable === true,
          materialized: false,
        },
      };
    },
  };
}
