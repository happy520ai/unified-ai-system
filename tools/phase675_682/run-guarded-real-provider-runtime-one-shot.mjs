import { evaluateCredentialRefProviderRuntimeGate, runGuardedRealProviderRuntimeOneShot } from "../../packages/taiji-beidou-engine/src/index.js";
import { createModelLibraryStore } from "../../apps/ai-gateway-service/src/model-library/modelLibraryStore.js";
import { createNvidiaUnifiedClient } from "../../apps/ai-gateway-service/src/providers/nvidia/nvidiaUnifiedClient.js";
import { approvalInputPath, pathExists, phaseBoundary, readJsonIfExists, writeJson } from "./phase675_682_common.mjs";

const approval = (await pathExists(approvalInputPath)) ? await readJsonIfExists(approvalInputPath, null) : null;
const runtimeRegistry = await readJsonIfExists("capabilities/_runtime_admitted/runtime-registry.json", { admittedCapabilities: [] });
const executionEvidenceById = {};
for (const capability of runtimeRegistry.admittedCapabilities || []) {
  executionEvidenceById[capability.capabilityId] = await readJsonIfExists(`capabilities/_runtime_executions/${capability.capabilityId}/execution-result.json`, {});
}
const gate = evaluateCredentialRefProviderRuntimeGate({ approval, runtimeRegistry, executionEvidenceById });
const providerClient = createGuardedNvidiaProviderClient({ approval, gate });

const result = await runGuardedRealProviderRuntimeOneShot({
  approval,
  gate,
  providerClient,
});

const evidence = phaseBoundary({
  phase: "Phase679",
  completed: true,
  approvalFilePresent: Boolean(approval),
  authorizationComplete: gate.authorizationComplete,
  providerId: result.providerId,
  modelId: result.modelId,
  capabilityId: result.capabilityId,
  credentialRefUsed: result.credentialRefUsed,
  credentialRefOnly: approval ? gate.credentialRefOnly : true,
  ...result,
  maxRequestsRespected: result.maxRequestsRespected,
  maxRetriesRespected: result.maxRetriesRespected,
  providerCallsMade: result.realProviderCallExecuted,
});

await writeJson("apps/ai-gateway-service/evidence/phase675_682/guarded-real-provider-runtime-one-shot-result.json", evidence);
console.log(JSON.stringify(evidence, null, 2));

function createGuardedNvidiaProviderClient({ approval, gate }) {
  if (!approval || gate.realProviderRuntimeAllowed !== true) return null;
  if (approval.providerId !== "nvidia") return null;
  if (approval.credentialRef !== "credentialRef:nvidia:default") return null;
  if (approval.maxRequests !== 1 || approval.maxRetries !== 0) return null;
  if (approval.allowSecretRead !== false) return null;

  const envKeyPresent = typeof process.env.NVIDIA_API_KEY === "string" && process.env.NVIDIA_API_KEY.trim().length > 0;
  if (!envKeyPresent) {
    return async () => ({
      blockedBeforeProviderCall: true,
      blockedReason: "credential_ref_unresolved",
    });
  }

  const modelLibraryStore = createModelLibraryStore({
    env: process.env,
    storagePath: "apps/ai-gateway-service/evidence/phase675_682/model-library-state-one-shot-local.json",
  });
  const client = createNvidiaUnifiedClient({
    env: process.env,
    modelLibraryStore,
    timeoutMs: 30000,
  });

  return async ({ modelId, prompt }) => {
    const envelope = await client.chatCompletion({
      modelId,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 24,
      temperature: 0,
      capability: "chat_general",
    });
    if (envelope.meta?.providerCalled !== true) {
      return {
        blockedBeforeProviderCall: true,
        blockedReason: envelope.code || "provider_call_not_started",
      };
    }
    return {
      text: envelope.data?.text || envelope.data?.outputText || "",
      providerEnvelopeCode: envelope.code,
    };
  };
}
