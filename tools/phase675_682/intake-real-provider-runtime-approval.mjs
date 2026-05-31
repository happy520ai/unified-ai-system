import { validateRealProviderRuntimeApproval } from "../../packages/taiji-beidou-engine/src/index.js";
import { approvalInputPath, pathExists, phaseBoundary, readJsonIfExists, writeJson } from "./phase675_682_common.mjs";

const approvalFilePresent = await pathExists(approvalInputPath);
const packet = approvalFilePresent ? await readJsonIfExists(approvalInputPath, {}) : null;
const validation = packet ? validateRealProviderRuntimeApproval(packet) : {
  authorizationComplete: false,
  failures: ["real_provider_runtime_approval_missing"],
  providerIdAllowedList: ["nvidia"],
  credentialRefOnly: false,
};

const evidence = phaseBoundary({
  phase: "Phase678",
  completed: true,
  recommended_sealed: approvalFilePresent === false ? true : validation.authorizationComplete,
  blocker: approvalFilePresent ? (validation.authorizationComplete ? null : validation.failures[0]) : "real_provider_runtime_approval_missing",
  approvalFilePresent,
  authorizationComplete: validation.authorizationComplete,
  providerId: packet?.providerId || "nvidia",
  modelId: packet?.modelId || null,
  capabilityId: packet?.capabilityId || null,
  credentialRefOnly: validation.credentialRefOnly || false,
  approvalGateWorking: true,
  realProviderCallExecuted: false,
  validationFailures: validation.failures,
});

await writeJson("apps/ai-gateway-service/evidence/phase675_682/real-provider-runtime-approval-intake-result.json", evidence);
console.log(JSON.stringify(evidence, null, 2));
