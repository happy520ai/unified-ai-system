import {
  DEFAULT_PHASE912_CREDENTIAL_REF,
  runWithIsolatedCredentialSecret,
} from "./credentialRefSecureResolver.js";
import { buildSecretRedactionBoundaryReport } from "./secretRedactionBoundary.js";

export async function runIsolatedSecretInjectionDryRun({
  credentialRef = DEFAULT_PHASE912_CREDENTIAL_REF,
  providerId = "nvidia",
  env = process.env,
} = {}) {
  const boundary = await runWithIsolatedCredentialSecret({
    credentialRef,
    providerId,
    env,
    operation: async ({ runtimeCredentialStore }) => ({
      providerAdapterReceivesEphemeralSecret: Boolean(runtimeCredentialStore.getApiKey(providerId)),
      providerCallExecuted: false,
      injectedSecretEchoed: false,
    }),
  });

  const dryRunEvidence = {
    credentialRef,
    providerId,
    credentialRefOnly: true,
    callerReceivesRawSecret: false,
    resolverBoundaryReceivesCredentialRef: true,
    isolatedInjectionBoundaryReady: boundary.ok === true,
    secretInjectedOnlyInsideBoundary: boundary.ok === true,
    providerAdapterReceivesEphemeralSecret: boundary.result?.providerAdapterReceivesEphemeralSecret === true,
    providerCallExecuted: false,
    authJsonRead: false,
    rawSecretReadByCallingProcess: false,
    rawSecretRead: false,
    secretValueExposed: false,
    readyForPhase913: boundary.ok === true,
    blocker: boundary.ok === true ? null : boundary.blocker,
    failures: boundary.audit?.failures || [],
  };
  const redaction = buildSecretRedactionBoundaryReport({ evidence: dryRunEvidence });
  return {
    ...dryRunEvidence,
    ...redaction,
    secretWrittenToEvidence: false,
    secretWrittenToLogs: false,
    secretPrintedToStdout: false,
    secretPrintedToStderr: false,
  };
}
