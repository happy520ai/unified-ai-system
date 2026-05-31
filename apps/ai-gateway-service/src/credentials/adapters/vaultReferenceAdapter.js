export function createVaultReferenceAdapter() {
  return {
    referenceType: "vault_reference",
    resolve(reference) {
      return {
        adapter: "vaultReferenceAdapter",
        referenceType: "vault_reference",
        referenceId: String(reference || ""),
        accessAllowed: false,
        resolverStatus: "VAULT_ADAPTER_NOT_CONFIGURED",
        redactionStatus: "metadata_only",
        secretValueExposed: false,
        rawSecretNeverReturned: true,
      };
    },
  };
}
