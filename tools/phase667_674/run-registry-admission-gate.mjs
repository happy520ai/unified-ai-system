import { buildRuntimeRegistry } from "../../packages/taiji-beidou-engine/src/index.js";
import { listJsonFiles, phaseBoundary, readJsonIfExists, safeEvidenceBase, writeJson } from "./phase667_674_common.mjs";

const admissionFiles = await listJsonFiles("capabilities/_runtime_admitted");
const decisions = [];
for (const file of admissionFiles.filter((path) => path.endsWith(".runtime-admission.json"))) {
  decisions.push(await readJsonIfExists(file, {}));
}

const runtimeRegistry = buildRuntimeRegistry(decisions);
await writeJson("capabilities/_runtime_admitted/runtime-registry.json", runtimeRegistry);

const evidence = safeEvidenceBase({
  phase: "Phase668",
  completed: runtimeRegistry.admittedCapabilities.length >= 1,
  registryAdmissionGateAvailable: true,
  runtimeRegistryGenerated: true,
  runtimeAdmittedCapabilityCount: runtimeRegistry.admittedCapabilities.length,
  allRuntimeCapabilitiesHaveRollback: runtimeRegistry.admittedCapabilities.every((capability) => Boolean(capability.rollbackRef)),
  defaultProviderCallsAllowed: false,
  defaultSecretReadAllowed: false,
  defaultDeployAllowed: false,
  productionReady: false,
  productionRuntimeAutoEnabled: false,
  ...phaseBoundary(),
});

await writeJson("apps/ai-gateway-service/evidence/phase667_674/registry-admission-gate-result.json", evidence);
console.log(JSON.stringify(evidence, null, 2));
