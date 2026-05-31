export function assertUserOwnedCredentialBoundary(binding = {}) {
  return {
    credentialRef: binding.credentialRef || null,
    credentialRefOnly: !!binding.credentialRef,
    rawSecretAccessed: false,
    secretValueExposed: false,
    nonConfiguredProviderBlocked: !binding.providerRef || !binding.modelRef || !binding.credentialRef,
  };
}

