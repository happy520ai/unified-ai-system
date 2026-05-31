export function createEncryptedReferenceAdapter() {
  return {
    referenceType: "encrypted_reference",
    resolve(reference) {
      return {
        adapter: "encryptedReferenceAdapter",
        referenceType: "encrypted_reference",
        referenceId: String(reference || ""),
        accessAllowed: false,
        resolverStatus: "ENCRYPTED_REFERENCE_ADAPTER_NOT_READY",
        redactionStatus: "metadata_only",
        secretValueExposed: false,
        rawSecretNeverReturned: true,
      };
    },
  };
}
