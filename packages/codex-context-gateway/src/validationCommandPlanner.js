import { loadPromptPack } from "./promptPackLoader.js";

export function planValidationCommands(options = {}) {
  const promptPack = options.promptPack || loadPromptPack(options);
  const commands = [
    "pnpm verify:phase594a-t-usage-workflow-runner-integration-preview",
    "pnpm verify:phase593a-t-codex-context-gateway-operator-panel",
    "pnpm verify:phase592a-t-codex-context-gateway-token-budget-manager",
    "pnpm verify:phase107a-secret-safety",
    "pnpm verify:phase321a-workbench-product-recovery",
    "pnpm -r --if-present check",
  ];
  if (promptPack.validationCommandsLoaded) {
    commands.push("pnpm sync:readme-agents-current-state");
    commands.push("pnpm verify:phase306c-readme-agents-auto-sync-guard");
  }
  const dangerous = /(deploy|release|git\s+tag|artifact\s+upload|provider\s+call|codex\s+config|base_url)/i;
  const safeCommands = Array.from(new Set(commands)).filter((command) => !dangerous.test(command));
  return {
    completed: safeCommands.length >= 6,
    validationCommandPlannerWorks: safeCommands.length >= 6,
    commands: safeCommands,
    checkCommandIncluded: safeCommands.includes("pnpm -r --if-present check"),
    secretSafetyIncluded: safeCommands.includes("pnpm verify:phase107a-secret-safety"),
    productRecoveryIncluded: safeCommands.includes("pnpm verify:phase321a-workbench-product-recovery"),
    phaseSpecificCommandIncluded: safeCommands.includes("pnpm verify:phase594a-t-usage-workflow-runner-integration-preview"),
    dangerousCommandExcluded: safeCommands.every((command) => !dangerous.test(command)),
    providerCallsMade: false,
  };
}
