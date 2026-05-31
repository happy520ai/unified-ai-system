import { createCapabilityNeuronManifest } from "./capabilityNeuronManifest.js";

export function generateManifestDraft(spec, risk = {}) {
  const status = risk.approvalRequired ? "approval_required" : "registered_preview";
  return createCapabilityNeuronManifest({
    capabilityId: spec.capabilityId,
    displayName: spec.displayName,
    description: spec.description,
    intakeText: spec.intakeText,
    type: spec.type,
    status,
    runtime: {
      kind: "dry_run",
      maxSpawnDepth: 1,
      enabledByDefault: false,
    },
    safety: spec.safetyBoundary,
    approval: {
      requiredForRuntime: true,
      currentStatus: "draft",
    },
    synapse: {
      pressureTypes: spec.pressureTypes,
      modes: spec.modes,
      dependencies: spec.dependencies,
      weight: 0.5,
    },
  });
}

export function generateManifestDrafts(specs, risks) {
  return specs.map((spec, index) => generateManifestDraft(spec, risks[index]));
}
