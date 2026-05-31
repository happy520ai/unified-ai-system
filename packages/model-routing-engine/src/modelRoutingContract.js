export const ROUTING_MODES = Object.freeze(["normal", "god", "tianshu", "auto"]);
export const RESOLVED_ROUTING_MODES = Object.freeze(["normal", "god", "tianshu"]);

export function buildModelRoutingContract() {
  return {
    phase: "Phase801",
    contractName: "task-pressure-mode-based-model-routing",
    defaultRuntimeEnabled: false,
    dryRunOnly: true,
    providerCallsMade: false,
    secretRead: false,
    selectableAdmissionEnabled: false,
    routeInput: {
      taskId: "string",
      userTask: "string",
      mode: "normal|god|tianshu|auto",
      constraints: {
        preferLowCost: false,
        preferLowLatency: false,
        preferReasoning: false,
        preferCoding: false,
        preferChinese: false,
        preferLongContext: false,
        maxEstimatedCostUsd: null,
        maxLatencyMs: null,
      },
      context: {
        estimatedInputTokens: 0,
        requiresLongContext: false,
        requiresToolCalling: false,
        requiresJson: false,
        requiresVision: false,
      },
      safety: {
        providerCallsAllowed: false,
        secretReadAllowed: false,
        runtimeExecutionAllowed: false,
      },
    },
    routeOutput: {
      routeId: "string",
      mode: "normal|god|tianshu",
      providerCallsMade: false,
      secretRead: false,
      dryRunOnly: true,
    },
  };
}

export function normalizeRoutingInput(input = {}) {
  const mode = ROUTING_MODES.includes(input.mode) ? input.mode : "auto";
  return {
    taskId: String(input.taskId || "routing-task"),
    userTask: String(input.userTask || ""),
    mode,
    constraints: {
      preferLowCost: input.constraints?.preferLowCost === true,
      preferLowLatency: input.constraints?.preferLowLatency === true,
      preferReasoning: input.constraints?.preferReasoning === true,
      preferCoding: input.constraints?.preferCoding === true,
      preferChinese: input.constraints?.preferChinese === true,
      preferLongContext: input.constraints?.preferLongContext === true,
      maxEstimatedCostUsd: input.constraints?.maxEstimatedCostUsd ?? null,
      maxLatencyMs: input.constraints?.maxLatencyMs ?? null,
    },
    context: {
      estimatedInputTokens: Number(input.context?.estimatedInputTokens || 0),
      requiresLongContext: input.context?.requiresLongContext === true,
      requiresToolCalling: input.context?.requiresToolCalling === true,
      requiresJson: input.context?.requiresJson === true,
      requiresVision: input.context?.requiresVision === true,
    },
    safety: {
      providerCallsAllowed: input.safety?.providerCallsAllowed === true,
      secretReadAllowed: input.safety?.secretReadAllowed === true,
      runtimeExecutionAllowed: input.safety?.runtimeExecutionAllowed === true,
    },
  };
}
