export function buildUsageTrialRegressionPlan() {
  const commands = [
    "pnpm verify:phase595a-t-codex-context-real-usage-trial",
    "pnpm verify:phase594a-t-usage-workflow-runner-integration-preview",
    "pnpm verify:phase593a-t-codex-context-gateway-operator-panel",
    "pnpm verify:phase592a-t-codex-context-gateway-token-budget-manager",
    "pnpm verify:phase107a-secret-safety",
    "pnpm verify:phase321a-workbench-product-recovery",
    "pnpm -r --if-present check",
  ];
  const dangerous = /(deploy|release|git\s+tag|artifact\s+upload|provider\s+call|base_url|codex\s+config)/i;
  const safeCommands = commands.filter((command) => !dangerous.test(command));
  return {
    completed: safeCommands.length === commands.length,
    validationPlanGenerated: true,
    commands: safeCommands,
    phase595VerifierIncluded: safeCommands.includes("pnpm verify:phase595a-t-codex-context-real-usage-trial"),
    phase592RegressionIncluded: safeCommands.includes("pnpm verify:phase592a-t-codex-context-gateway-token-budget-manager"),
    phase593RegressionIncluded: safeCommands.includes("pnpm verify:phase593a-t-codex-context-gateway-operator-panel"),
    phase594RegressionIncluded: safeCommands.includes("pnpm verify:phase594a-t-usage-workflow-runner-integration-preview"),
    secretSafetyIncluded: safeCommands.includes("pnpm verify:phase107a-secret-safety"),
    productRecoveryIncluded: safeCommands.includes("pnpm verify:phase321a-workbench-product-recovery"),
    dangerousCommandExcluded: safeCommands.every((command) => !dangerous.test(command)),
  };
}
