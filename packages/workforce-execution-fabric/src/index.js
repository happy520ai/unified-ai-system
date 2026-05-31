export * from "./unifiedIoEnvelope.js";
export * from "./internalBusBridge.js";
export * from "./adaptiveBranchPlanner.js";
export * from "./loadGovernance.js";
export * from "./branchExecutorDryRun.js";
export * from "./resultMerger.js";
export * from "./failureInjection.js";
export * from "./executionFabricEvidence.js";

export const PHASE578_EXECUTION_FABRIC_BOUNDARY = Object.freeze({
  phase: "Phase578A-T",
  dryRunOnly: true,
  unifiedIoOnly: true,
  internalEmployeeBusOnly: true,
  adaptiveBranchPreviewOnly: true,
  providerCallsMade: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  realFeishuMessageSent: false,
  realWeComMessageSent: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  characterModuleRestored: false,
  workspaceCleanClaimed: false,
});
