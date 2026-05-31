import { PHASE595_ALLOWED_GENERATED_FILES, buildRelevantFileUsagePolicy } from "./relevantFileUsagePolicy.js";
import { buildUsageTrialRegressionPlan } from "./usageTrialRegressionPlanner.js";

export const DEFAULT_PHASE595_TASK =
  "Based on the current .codex-context pack, add docs/phase595-codex-context-real-usage-trial-note.md explaining the Codex Context Gateway real usage flow, boundaries, token-saving method, and next-step recommendation.";

export function buildRealUsageTaskPlan(options = {}) {
  const policy = options.policy || buildRelevantFileUsagePolicy(options);
  const regression = buildUsageTrialRegressionPlan(options);
  const disallowedFiles = [
    "legacy/",
    "PROJECT_CONTEXT.md",
    ".env",
    ".git",
    "node_modules",
    "apps/ai-gateway-service/src/httpServer.js",
    "/chat runtime",
    "/chat-gateway/execute runtime",
    "provider runtime",
    "Codex config",
    "Codex base_url",
  ];
  return {
    completed: true,
    realUsageTaskPlanGenerated: true,
    taskTitle: "Phase595 Codex Context Real Usage Trial Note",
    task: DEFAULT_PHASE595_TASK,
    allowedFiles: Array.from(new Set([...policy.expectedReadFiles, ...PHASE595_ALLOWED_GENERATED_FILES])),
    allowedFilesDefined: true,
    disallowedFiles,
    disallowedFilesDefined: true,
    validationCommands: regression.commands,
    validationCommandsDefined: regression.commands.length > 0,
    safetyBoundary: {
      codexConfigModified: false,
      codexBaseUrlModified: false,
      realCodexConnectionMade: false,
      providerCallsMade: false,
      rawSecretAccessed: false,
      secretValueExposed: false,
      rawWebhookAccessed: false,
      webhookValueExposed: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      deployExecuted: false,
      releaseExecuted: false,
      tagCreated: false,
      artifactUploaded: false,
    },
    rollbackNote:
      "Remove Phase595 docs, evidence, tools, usage trial modules, and managed-block additions only; keep runtime, /chat, /chat-gateway/execute, provider runtime, Codex config/base_url, legacy/, PROJECT_CONTEXT.md, deploy, release, tags, artifacts, and secrets untouched.",
    rollbackNoteDefined: true,
  };
}
