export function buildSynapseGraphRegistry(manifests) {
  return {
    graphVersion: "phase651-666-synapse-graph-v1",
    runtimeEnabled: false,
    nodes: manifests.map((manifest) => ({
      capabilityId: manifest.capabilityId,
      type: manifest.type,
      status: manifest.status,
      modes: manifest.synapse.modes,
      pressureTypes: manifest.synapse.pressureTypes,
      weight: manifest.synapse.weight,
      approvalRequiredForRuntime: manifest.approval.requiredForRuntime,
    })),
    edges: manifests.flatMap((manifest) =>
      manifest.synapse.dependencies.map((dependency) => ({
        from: manifest.capabilityId,
        to: dependency,
        relation: "depends_on",
        runtimeEnabled: false,
      }))),
  };
}
