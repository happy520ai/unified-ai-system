import { createEnvCredentialAdapter } from "./adapters/envCredentialAdapter.js";
import { createEncryptedReferenceAdapter } from "./adapters/encryptedReferenceAdapter.js";
import { createVaultReferenceAdapter } from "./adapters/vaultReferenceAdapter.js";

export function createCredentialVaultRegistry({ env = process.env } = {}) {
  const adapters = {
    env_key_name: createEnvCredentialAdapter({ env }),
    encrypted_reference: createEncryptedReferenceAdapter(),
    vault_reference: createVaultReferenceAdapter(),
  };
  return {
    resolve({ referenceType, reference }) {
      const adapter = adapters[String(referenceType || "")];
      if (!adapter) {
        return {
          adapter: null,
          referenceType,
          accessAllowed: false,
          resolverStatus: "CREDENTIAL_REFERENCE_TYPE_UNKNOWN",
          secretValueExposed: false,
          rawSecretNeverReturned: true,
        };
      }
      return adapter.resolve(reference);
    },
  };
}
