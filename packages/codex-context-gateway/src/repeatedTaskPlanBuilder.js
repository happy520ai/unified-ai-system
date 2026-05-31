import { buildRelevantFileUsagePolicy } from "./relevantFileUsagePolicy.js";

export const PHASE596_TASKS = Object.freeze([
  {
    taskId: "phase596-task1",
    title: "Context Pack Usage Note",
    expectedOutputDoc: "docs/phase596-task1-context-pack-usage-note.md",
    topic: "Codex Context Gateway usage flow",
  },
  {
    taskId: "phase596-task2",
    title: "Relevant File Scope Note",
    expectedOutputDoc: "docs/phase596-task2-relevant-file-scope-note.md",
    topic: "relevant-files.json scoped reading",
  },
  {
    taskId: "phase596-task3",
    title: "Token Budget Note",
    expectedOutputDoc: "docs/phase596-task3-token-budget-note.md",
    topic: "16k token budget policy",
  },
  {
    taskId: "phase596-task4",
    title: "Stale Guard Note",
    expectedOutputDoc: "docs/phase596-task4-stale-guard-note.md",
    topic: "stale context guard",
  },
  {
    taskId: "phase596-task5",
    title: "Read Audit Note",
    expectedOutputDoc: "docs/phase596-task5-read-audit-note.md",
    topic: "expected reads and actual read preview",
  },
  {
    taskId: "phase596-task6",
    title: "Validation Plan Note",
    expectedOutputDoc: "docs/phase596-task6-validation-plan-note.md",
    topic: "validation plan",
  },
  {
    taskId: "phase596-task7",
    title: "Operator Checklist Note",
    expectedOutputDoc: "docs/phase596-task7-operator-checklist-note.md",
    topic: "operator checklist",
  },
  {
    taskId: "phase596-task8",
    title: "Summary Benchmark Note",
    expectedOutputDoc: "docs/phase596-task8-summary-benchmark-note.md",
    topic: "benchmark summary",
  },
  {
    taskId: "phase596-task9",
    title: "Mission Control Usage Note",
    expectedOutputDoc: "docs/phase596-task9-mission-control-usage-note.md",
    topic: "Mission Control operator panel status",
    optional: true,
  },
  {
    taskId: "phase596-task10",
    title: "Next Optimization Note",
    expectedOutputDoc: "docs/phase596-task10-next-optimization-note.md",
    topic: "pre-base-url authorization gate",
    optional: true,
  },
]);

export const PHASE596_ALLOWED_GENERATED_FILES = Object.freeze([
  ...PHASE596_TASKS.map((task) => task.expectedOutputDoc),
  "tools/phase596-common.mjs",
  "tools/phase596-registry.mjs",
  "tools/phase596-sequential-runner.mjs",
  "package.json",
  "README.md",
  "AGENTS.md",
  "apps/ai-gateway-service/src/entrypoints/syncReadmeAgentsCurrentState.js",
  "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
  "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
  "apps/ai-gateway-service/src/ui/consolePage.js",
]);

export function buildRepeatedTaskPlan(options = {}) {
  const policy = options.policy || buildRelevantFileUsagePolicy(options);
  const contextInputs = [
    ".codex-context/current-context-pack.md",
    ".codex-context/current-context-pack.json",
    ".codex-context/relevant-files.json",
    ".codex-context/codex-prompt-pack.md",
    ".codex-context/token-budget-report.json",
    ".codex-context/context-freshness-report.json",
  ];
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
  const validationCommands = [
    "pnpm verify:phase596a-t-codex-context-repeated-usage-benchmark",
    "pnpm verify:phase595a-t-codex-context-real-usage-trial",
    "pnpm verify:phase594a-t-usage-workflow-runner-integration-preview",
    "pnpm verify:phase593a-t-codex-context-gateway-operator-panel",
    "pnpm verify:phase592a-t-codex-context-gateway-token-budget-manager",
    "pnpm verify:phase107a-secret-safety",
    "pnpm verify:phase321a-workbench-product-recovery",
    "pnpm -r --if-present check",
  ];
  const tasks = PHASE596_TASKS.map((task) => ({
    ...task,
    allowedFiles: Array.from(new Set([...contextInputs, ...policy.expectedReadFiles, task.expectedOutputDoc])),
    disallowedFiles,
    requiredContextInputs: contextInputs,
    validationCommands,
    safetyBoundary: buildSafetyBoundary(),
    status: "planned",
  }));
  return {
    completed: tasks.length >= 8,
    benchmarkTaskRegistryExists: true,
    taskCount: tasks.length,
    tasks,
    allTasksHaveAllowedFiles: tasks.every((task) => task.allowedFiles.length > 0),
    allTasksHaveDisallowedFiles: tasks.every((task) => task.disallowedFiles.length > 0),
    allTasksRequireContextPack: tasks.every((task) => task.requiredContextInputs.includes(".codex-context/current-context-pack.md")),
    allTasksRequireRelevantFiles: tasks.every((task) => task.requiredContextInputs.includes(".codex-context/relevant-files.json")),
    dangerousTaskExcluded: tasks.every((task) => task.safetyBoundary.providerCallsMade === false && task.safetyBoundary.codexBaseUrlModified === false),
  };
}

export function buildSafetyBoundary() {
  return {
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
    characterModuleRestored: false,
    workspaceCleanClaimed: false,
  };
}
