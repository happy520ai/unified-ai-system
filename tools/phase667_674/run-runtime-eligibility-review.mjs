import { reviewRuntimeEligibility } from "../../packages/taiji-beidou-engine/src/index.js";
import { phaseBoundary, readJsonIfExists, safeEvidenceBase, writeJson } from "./phase667_674_common.mjs";

const registry = await readJsonIfExists("capabilities/_registry_preview/taiji-beidou-neuron-registry.preview.json", { manifests: [] });
const manifests = registry.manifests || [];
const artifactsById = {};

for (const manifest of manifests) {
  const base = `capabilities/_generated_dry_run/${manifest.capabilityId}`;
  artifactsById[manifest.capabilityId] = {
    verifierResult: await readJsonIfExists(`${base}/verifier-result.json`, {}),
    rollbackPlan: await readJsonIfExists(`${base}/rollback-plan.json`, {}),
    dryRunResult: await readJsonIfExists(`${base}/dry-run-result.json`, {}),
    rollbackRef: `${base}/rollback-plan.json`,
    evidenceRefs: [`${base}/verifier-result.json`, `${base}/dry-run-result.json`],
  };
}

const decisions = reviewRuntimeEligibility({ manifests, artifactsById });
for (const decision of decisions) {
  await writeJson(`capabilities/_runtime_admitted/${decision.capabilityId}.runtime-admission.json`, decision);
}

const approved = decisions.filter((decision) => decision.admissionStatus === "approved_for_sandbox_runtime_only");
const evidence = safeEvidenceBase({
  phase: "Phase667",
  completed: approved.length >= 1,
  runtimeEligibilityReviewAvailable: true,
  allRuntimeCapabilitiesHaveAdmissionDecision: decisions.length === manifests.length && decisions.length > 0,
  runtimeAdmittedCapabilityCount: approved.length,
  runtimeRejectedCapabilityCount: decisions.filter((decision) => decision.admissionStatus === "rejected").length,
  runtimeBlockedCapabilityCount: decisions.filter((decision) => decision.admissionStatus === "blocked").length,
  autoRuntimeEligibleCount: approved.length,
  productionRuntimeEligible: false,
  maxSpawnDepth: 1,
  recursiveSpawnBlocked: true,
  runtimeAutoEnabledForSandboxOnly: true,
  productionRuntimeAutoEnabled: false,
  ...phaseBoundary(),
});

await writeJson("apps/ai-gateway-service/evidence/phase667_674/runtime-eligibility-review-result.json", evidence);
console.log(JSON.stringify(evidence, null, 2));
