export function createEnvCredentialAdapter({ env = process.env } = {}) {
  return {
    referenceType: "env_key_name",
    resolve(reference) {
      const key = String(reference || "");
      const present = Object.prototype.hasOwnProperty.call(env, key);
      return {
        adapter: "envCredentialAdapter",
        referenceType: "env_key_name",
        accessAllowed: present,
        resolverStatus: present ? "ENV_CREDENTIAL_REFERENCE_READY" : "ENV_CREDENTIAL_KEY_MISSING",
        redactionStatus: "metadata_only",
        envKeyName: key,
        secretValueExposed: false,
        rawSecretNeverReturned: true,
      };
    },
  };
}
