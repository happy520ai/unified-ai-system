export function buildUserOwnedCredentialRefContract() {
  return {
    contractName: "user-owned-credentialref-model-access-contract",
    version: "phase767.v1",
    rawSecretAllowed: false,
    secretRead: false,
    authJsonRead: false,
    credentialStates: ["credential_missing", "credential_ready"],
    requiredFields: [
      "credentialRef",
      "providerFamily",
      "providerId",
      "scope",
      "owner",
      "createdBy",
      "status",
    ],
    forbiddenFields: ["apiKey", "secret", "token", "rawBaseUrl", "webhookSecret"],
    policy: {
      userOwnedApiKeyRequired: true,
      credentialRefRequired: true,
      rawSecretAllowed: false,
      credentialReadyDoesNotMeanSmokePassed: true,
      credentialReadyDoesNotMeanSelectable: true,
    },
  };
}
