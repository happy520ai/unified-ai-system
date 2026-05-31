export function authorizeCredentialRef(credentialRef, authorization = {}) {
  return {
    allowed: Array.isArray(authorization.allowedCredentialRefs) && authorization.allowedCredentialRefs.includes(credentialRef),
    credentialRefOnly: true,
    rawSecretAccessed: false,
    secretValueExposed: false,
  };
}

