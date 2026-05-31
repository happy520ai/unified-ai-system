export const credentialRefBoundary = Object.freeze({
  credentialRefOnly: true,
  rawSecretAccessed: false,
  secretValueExposed: false,
  allowedToResolveSecret: false,
  message: "CredentialRef is metadata only in Phase576D; raw secret access is not allowed.",
});

export function assertCredentialRefBoundary() {
  return {
    ...credentialRefBoundary,
    valid: credentialRefBoundary.credentialRefOnly &&
      !credentialRefBoundary.rawSecretAccessed &&
      !credentialRefBoundary.secretValueExposed &&
      !credentialRefBoundary.allowedToResolveSecret,
  };
}
