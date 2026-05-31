import { PROVIDER_EXPANSION_ALLOWLIST, validateCredentialRefShape } from "./userOwnedCredentialRefSetup.js";

export function evaluateProviderCredentialReadiness(input = {}) {
  const failures = [];
  const providerFamily = String(input.providerFamily ?? "");
  const credentialRef = String(input.credentialRef ?? "");
  if (!PROVIDER_EXPANSION_ALLOWLIST.includes(providerFamily)) failures.push("provider_family_not_allowlisted");
  if (!credentialRef) failures.push("credential_ref_missing");
  if (credentialRef && !validateCredentialRefShape(credentialRef)) failures.push("credential_ref_invalid_or_secret_like");
  if (input.rawSecretPresent === true) failures.push("raw_secret_present");
  return {
    phase: "Phase783",
    providerFamily,
    providerId: input.providerId ?? providerFamily,
    credentialRefPresent: Boolean(credentialRef),
    credentialRefValid: failures.every((failure) => failure !== "credential_ref_invalid_or_secret_like"),
    credentialReady: failures.length === 0,
    readinessStatus: failures.length === 0 ? "credential_ready" : "credential_missing",
    failures,
    credentialRefOnly: true,
    rawSecretRead: false,
    secretRead: false,
    authJsonRead: false,
    nonAllowlistedProviderBlocked: failures.includes("provider_family_not_allowlisted"),
  };
}
