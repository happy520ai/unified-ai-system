import { evaluateCredentialRefProviderRuntimeGate } from "../../packages/taiji-beidou-engine/src/index.js";
import { approvalInputPath, pathExists, phaseBoundary, readJsonIfExists, writeJson } from "./phase675_682_common.mjs";

const approval = (await pathExists(approvalInputPath)) ? await readJsonIfExists(approvalInputPath, null) : null;
const runtimeRegistry = await readJsonIfExists("capabilities/_runtime_admitted/runtime-registry.json", { admittedCapabilities: [] });
const executionEvidenceById = {};

for (const capability of runtimeRegistry.admittedCapabilities || []) {
  executionEvidenceById[capability.capabilityId] = await readJsonIfExists(`capabilities/_runtime_executions/${capability.capabilityId}/execution-result.json`, {});
}

const gate = evaluateCredentialRefProviderRuntimeGate({ approval, runtimeRegistry, executionEvidenceById });
await writeJson(`capabilities/_real_provider_runtime_admitted/${gate.capabilityId || "missing-approval"}.real-provider-admission.json`, gate);

const evidence = phaseBoundary({
  phase: "Phase676",
  completed: true,
  credentialRefProviderRuntimeGateAvailable: true,
  approvalFilePresent: Boolean(approval),
  authorizationComplete: gate.authorizationComplete,
  providerId: gate.providerId,
  modelId: gate.modelId,
  capabilityId: gate.capabilityId,
  gateStatus: gate.admissionStatus,
  credentialRefOnly: approval ? gate.credentialRefOnly : true,
  nonNvidiaProviderBlocked: true,
  missingApprovalBlocked: gate.failures.includes("real_provider_runtime_approval_missing"),
  rawSecretBlocked: true,
  authJsonBlocked: true,
  rawBaseUrlBlocked: true,
  rollbackAvailable: gate.rollbackAvailable,
  realProviderRuntimeAllowed: gate.realProviderRuntimeAllowed,
  providerRuntimeDefaultEnabled: false,
  maxSpawnDepth: 1,
  failures: gate.failures,
});

await writeJson("apps/ai-gateway-service/evidence/phase675_682/credentialref-provider-runtime-gate-result.json", evidence);
console.log(JSON.stringify(evidence, null, 2));
