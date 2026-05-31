import { createCredentialResolver } from "../credentials/credentialResolver.js";
import { evaluateGuardedRealCallPolicy } from "./guardedRealCallPolicy.js";

export function createUserOwnedProviderGate({ env = process.env, credentialResolver = createCredentialResolver({ env }) } = {}) {
  return {
    evaluate({ providerConfig = {}, request = {}, credentialRef } = {}) {
      if (!credentialRef) {
        return { allowed: false, code: "CREDENTIAL_REF_MISSING", providerCallsMade: false };
      }
      const resolution = credentialResolver.resolveCredentialRef(credentialRef);
      const policy = evaluateGuardedRealCallPolicy({ env, providerConfig, request, resolution });
      return {
        ...policy,
        resolution,
        secretValueExposed: false,
        nonNvidiaProviderCallsMade: false,
      };
    },
  };
}
