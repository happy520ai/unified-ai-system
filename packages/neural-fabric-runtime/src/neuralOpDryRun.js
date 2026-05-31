export function runNeuralOpDryRun(input = {}) {
  const opId = input.opId || "phase1305.mock.neural-op";
  const syntheticTensor = Object.freeze({
    shape: [1, 4],
    dtype: "float32",
    values: [0.125, 0.25, 0.5, 1],
  });
  const mockAdapter = Object.freeze({
    adapterId: "mock.adapter.phase1305",
    mode: "synthetic",
    realModelLoaded: false,
  });
  const lifecycle = Object.freeze([
    "manifest_loaded",
    "synthetic_tensor_created",
    "mock_adapter_attached",
    "dry_run_scored",
    "evidence_recorded",
  ]);

  return Object.freeze({
    phase: "Phase1305A",
    phaseKey: "phase1305a",
    name: "Inference-only Local Neural-op Dry-run",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    opId,
    inferenceOnly: true,
    dryRun: true,
    syntheticTensor,
    mockAdapter,
    lifecycle,
    realModelLoaded: false,
    realModelDownloaded: false,
    trainingExecuted: false,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    networkUsed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    safety: {
      providerCallsMade: false,
      secretRead: false,
      secretValueExposed: false,
      realTrainingEnabled: false,
      mainChainIntegrated: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      workspaceCleanClaimed: false,
    },
  });
}
