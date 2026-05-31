import { createModelLibraryStore } from "../../apps/ai-gateway-service/src/model-library/modelLibraryStore.js";
import { createNvidiaUnifiedClient } from "../../apps/ai-gateway-service/src/providers/nvidia/nvidiaUnifiedClient.js";
import {
  buildPhase913BlockedResult,
  createPhase913OutboundTrace,
  isPhase913ModelEligible,
  normalizePhase913ProviderEnvelope,
  PHASE913_EXPECTED_MARKER,
  PHASE913_MODEL_ID,
  runWithIsolatedCredentialSecret,
} from "../../packages/model-routing-engine/src/index.js";
import {
  baseSafety,
  ensurePhaseDirs,
  phase913OneShotPath,
  phase912InjectionDryRunPath,
  readJsonIfPresent,
  writeJson,
} from "./phase912-915-common.mjs";

ensurePhaseDirs();

const phase912 = readJsonIfPresent(phase912InjectionDryRunPath) || {};
const usabilityMatrix = readJsonIfPresent("apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json") || {};
const verificationState = readJsonIfPresent("apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json") || {};
const modelEligibility = isPhase913ModelEligible({
  modelId: PHASE913_MODEL_ID,
  usabilityMatrix,
  verificationState,
});

let result;
if (phase912.readyForPhase913 !== true) {
  result = buildPhase913BlockedResult({
    blocker: phase912.blocker || "phase912_not_ready_for_phase913",
    modelId: PHASE913_MODEL_ID,
  });
} else if (modelEligibility.eligible !== true) {
  result = buildPhase913BlockedResult({
    blocker: modelEligibility.blocker,
    modelId: PHASE913_MODEL_ID,
  });
} else {
  const bridge = await runWithIsolatedCredentialSecret({
    credentialRef: "credentialRef:nvidia:default",
    providerId: "nvidia",
    env: process.env,
    operation: async ({ runtimeCredentialStore, providerEnv, credentialRef }) => {
      const modelLibraryStore = createModelLibraryStore({ env: providerEnv });
      const client = createNvidiaUnifiedClient({
        env: providerEnv,
        runtimeCredentialStore,
        modelLibraryStore,
        timeoutMs: 60_000,
      });
      const trace = createPhase913OutboundTrace({
        credentialRef,
        modelId: PHASE913_MODEL_ID,
        networkAttemptRecorded: true,
      });
      const envelope = await client.chatCompletion({
        modelId: PHASE913_MODEL_ID,
        messages: [{ role: "user", content: `Reply with exactly: ${PHASE913_EXPECTED_MARKER}` }],
        maxTokens: 16,
        temperature: 0,
      });
      return normalizePhase913ProviderEnvelope({
        envelope,
        trace,
        credentialRef,
        modelId: PHASE913_MODEL_ID,
      });
    },
  });
  result = bridge.ok === true
    ? bridge.result
    : buildPhase913BlockedResult({
        blocker: bridge.blocker || "credential_ref_resolution_blocked",
        modelId: PHASE913_MODEL_ID,
      });
}

result = {
  ...result,
  ...baseSafety(),
  phase: "Phase913",
  providerId: "nvidia",
  modelId: PHASE913_MODEL_ID,
  credentialRef: "credentialRef:nvidia:default",
  credentialRefOnly: true,
  rawSecretRead: false,
  rawSecretReadByCallingProcess: false,
  secretValueExposed: false,
  authJsonRead: false,
};

writeJson(phase913OneShotPath, result);
console.log(JSON.stringify({
  providerCallAttempted: result.providerCallAttempted,
  networkAttemptRecorded: result.networkAttemptRecorded,
  providerResponseReceived: result.providerResponseReceived,
  responseSource: result.responseSource,
  responseClassification: result.responseClassification,
  responseMarkerMatched: result.responseMarkerMatched,
  blocker: result.blocker || null,
}, null, 2));
