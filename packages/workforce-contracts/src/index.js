export * from "./positionTypes.js";
export * from "./employeeTypes.js";
export * from "./workforcePyramidTypes.js";
export * from "./brainAdapterTypes.js";
export * from "./schedulerTypes.js";

export const WORKFORCE_DOMAIN_BOUNDARY = Object.freeze({
  domain: "workforce",
  runtimeMode: "dry_run_preview",
  gatewayCopied: false,
  gatewayAdapterPreviewOnly: true,
  providerCallsMade: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  deployExecuted: false,
  allWorldJobsClaimed: false,
});
