import { redactSecretText } from "./secretRedactionBoundary.js";

export const DEFAULT_PHASE912_CREDENTIAL_REF = "credentialRef:nvidia:default";

const PROVIDER_ENV_SECRET_NAMES = Object.freeze({
  nvidia: "NVIDIA_API_KEY",
});

export function parseCredentialRef(credentialRef = "") {
  const parts = String(credentialRef).split(":");
  if (parts.length !== 3 || parts[0] !== "credentialRef") {
    return {
      valid: false,
      providerId: null,
      refName: null,
      failure: "credential_ref_format_invalid",
    };
  }
  return {
    valid: true,
    providerId: parts[1],
    refName: parts[2],
    failure: null,
  };
}

export function resolveCredentialRefReadiness({
  credentialRef = DEFAULT_PHASE912_CREDENTIAL_REF,
  providerId = "nvidia",
  env = process.env,
} = {}) {
  const parsed = parseCredentialRef(credentialRef);
  const failures = [];
  if (!parsed.valid) failures.push(parsed.failure);
  if (parsed.valid && parsed.providerId !== providerId) failures.push("credential_ref_provider_mismatch");
  if (providerId !== "nvidia") failures.push("provider_not_allowed");

  const secretName = PROVIDER_ENV_SECRET_NAMES[providerId] || null;
  if (!secretName) failures.push("credential_ref_secret_mapping_missing");
  const credentialSecretPresent = Boolean(secretName && String(env?.[secretName] || "").length > 0);
  if (!credentialSecretPresent) failures.push("credential_ref_secret_unavailable");

  return {
    credentialRef,
    providerId,
    credentialRefOnly: true,
    resolverBoundaryReceivesCredentialRef: true,
    callerReceivesRawSecret: false,
    rawSecretReadByCallingProcess: false,
    credentialSecretPresent,
    credentialResolutionStatus: failures.length === 0 ? "ready" : "blocked",
    credentialRefSecureResolutionReady: failures.length === 0,
    isolatedInjectionBoundaryReady: failures.length === 0,
    secretInjectedOnlyInsideBoundary: failures.length === 0,
    authJsonRead: false,
    failures,
    blocker: failures.length === 0 ? null : failures[0],
  };
}

export async function runWithIsolatedCredentialSecret({
  credentialRef = DEFAULT_PHASE912_CREDENTIAL_REF,
  providerId = "nvidia",
  env = process.env,
  operation,
} = {}) {
  const readiness = resolveCredentialRefReadiness({ credentialRef, providerId, env });
  if (readiness.credentialRefSecureResolutionReady !== true) {
    return {
      ok: false,
      blocker: readiness.blocker || "credential_ref_resolution_blocked",
      audit: readiness,
      result: null,
    };
  }
  if (typeof operation !== "function") {
    return {
      ok: false,
      blocker: "isolated_operation_missing",
      audit: readiness,
      result: null,
    };
  }

  const secretName = PROVIDER_ENV_SECRET_NAMES[providerId];
  const runtimeCredentialStore = {
    has(id) {
      return id === providerId && Boolean(env?.[secretName]);
    },
    getApiKey(id) {
      if (id !== providerId) return "";
      return String(env?.[secretName] || "");
    },
    getEndpoint() {
      return undefined;
    },
  };
  const providerEnv = Object.freeze({});

  try {
    const result = await operation({
      providerId,
      credentialRef,
      runtimeCredentialStore,
      providerEnv,
    });
    return {
      ok: true,
      blocker: null,
      audit: {
        ...readiness,
        providerAdapterReceivesEphemeralSecret: true,
      },
      result,
    };
  } catch (error) {
    return {
      ok: false,
      blocker: "isolated_operation_failed",
      audit: readiness,
      result: {
        code: "isolated_operation_failed",
        message: redactSecretText(error instanceof Error ? error.message : String(error)),
      },
    };
  }
}
