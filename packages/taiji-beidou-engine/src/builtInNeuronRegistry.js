import { createCapabilityNeuronManifest } from "./capabilityNeuronManifest.js";

export function buildBuiltInNeuronRegistry() {
  const contextCodecNeuron = createCapabilityNeuronManifest({
    capabilityId: "context-codec-core-neuron",
    displayName: "Context Codec Core Neuron",
    description: "Built-in dry-run neuron for Phase641R Context Codec shared core.",
    type: "context",
    status: "registered_preview",
    intakeText: "Register Context Codec as a built-in dry-run neuron.",
    synapse: {
      pressureTypes: ["token", "context"],
      modes: ["normal", "codex"],
      dependencies: ["phase641r-context-codec-core"],
      weight: 0.7,
    },
  });
  const codexContextNeuron = createCapabilityNeuronManifest({
    capabilityId: "codex-context-gateway-neuron",
    displayName: "Codex Context Gateway Neuron",
    description: "Built-in dry-run neuron for Codex long-task token-saving preflight.",
    type: "codex",
    status: "registered_preview",
    intakeText: "Register Codex Context Gateway as a built-in dry-run neuron.",
    synapse: {
      pressureTypes: ["token", "scope"],
      modes: ["codex"],
      dependencies: ["phase592-codex-context-gateway"],
      weight: 0.7,
    },
  });
  const godReviewCell = createCapabilityNeuronManifest({
    capabilityId: "god-review-cell-draft",
    displayName: "God Review Cell Draft",
    description: "Draft dry-run neuron for future multi-review planning. It does not call models.",
    type: "review",
    status: "approval_required",
    intakeText: "Register God Review Cell draft.",
    synapse: {
      pressureTypes: ["quality", "review"],
      modes: ["god"],
      dependencies: [],
      weight: 0.5,
    },
  });
  const tianshuPlannerCell = createCapabilityNeuronManifest({
    capabilityId: "tianshu-planner-cell-draft",
    displayName: "Tianshu Planner Cell Draft",
    description: "Draft dry-run neuron for future planning. It does not trigger Tianshu runtime.",
    type: "planning",
    status: "approval_required",
    intakeText: "Register Tianshu Planner Cell draft.",
    synapse: {
      pressureTypes: ["planning"],
      modes: ["tianshu"],
      dependencies: [],
      weight: 0.5,
    },
  });

  return {
    registryVersion: "phase651-666-built-in-neuron-registry-v1",
    runtimeEnabled: false,
    contextCodecNeuron,
    codexContextNeuron,
    godTianshuNeuronDrafts: [godReviewCell, tianshuPlannerCell],
    all: [contextCodecNeuron, codexContextNeuron, godReviewCell, tianshuPlannerCell],
  };
}
