export const taijiBeidouProductionOpsCopy = {
  title: "No-deploy Production Ops Readiness",
  subtitle:
    "Production operation readiness is prepared for authorization, canary, rollback, monitoring, alerting, SLO, support, compliance, and security review. Deployment remains deferred.",
  boundary: "read-only / no deploy",
  status: [
    ["productionReady", "true"],
    ["productionDeployExecuted", "false"],
    ["deployDeferred", "true"],
    ["deployAuthorized", "false"],
    ["goDecision", "pending"],
    ["postDeploySmokeExecuted", "false"],
    ["productionTrafficObserved", "false"],
  ],
  readiness: [
    ["canaryPlanReady", "true"],
    ["monitoringConfigReady", "true"],
    ["alertingConfigReady", "true"],
    ["rollbackCommandPackReady", "true"],
    ["emergencyDisableDryRunPassed", "true"],
    ["postDeployChecklistPrepared", "true"],
  ],
  safeguards: [
    ["mainChainDefaultEnabled", "false"],
    ["chatDefaultEnabled", "false"],
    ["chatGatewayExecuteDefaultEnabled", "false"],
    ["providerRuntimeDefaultEnabled", "false"],
    ["rawSecretRead", "false"],
    ["authJsonRead", "false"],
  ],
  operations: [
    "View deploy authorization packet",
    "View Go/No-Go packet",
    "View rollback command pack",
    "View emergency disable drill",
    "View monitoring and alerting plans",
  ],
};
