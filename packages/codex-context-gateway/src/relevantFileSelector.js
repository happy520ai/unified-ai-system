import { isForbiddenPath, isSensitivePath } from "./safetyBoundaryChecker.js";

const gatewayCoreFiles = [
  "packages/codex-context-gateway/src/index.js",
  "packages/codex-context-gateway/src/projectStateReader.js",
  "packages/codex-context-gateway/src/phaseEvidenceIndexer.js",
  "packages/codex-context-gateway/src/gitDiffSummarizer.js",
  "packages/codex-context-gateway/src/relevantFileSelector.js",
  "packages/codex-context-gateway/src/contextPackSchema.js",
  "packages/codex-context-gateway/src/tokenBudgetPolicy.js",
  "packages/codex-context-gateway/src/longContextCompressor.js",
  "packages/codex-context-gateway/src/codexPromptBuilder.js",
  "packages/codex-context-gateway/src/contextHashPolicy.js",
  "packages/codex-context-gateway/src/contextFreshnessDetector.js",
  "packages/codex-context-gateway/src/staleContextGuard.js",
  "packages/codex-context-gateway/src/contextPackGenerator.js",
  "packages/codex-context-gateway/src/safetyBoundaryChecker.js",
  "tools/phase592-common.mjs",
  "tools/phase592-registry.mjs",
  "tools/phase592-sequential-runner.mjs",
  "package.json",
  "README.md",
  "AGENTS.md",
];

const missionControlFiles = [
  "apps/ai-gateway-service/src/ui/consolePage.js",
  "apps/ai-gateway-service/src/workforce/workforcePlanner.js",
  "apps/ai-gateway-service/src/workforce/workforceService.js",
  "packages/workforce-execution-fabric/src/index.js",
  "packages/employee-communication-bus/src/index.js",
];

export function selectRelevantFiles({ task, gitDiff, profile = "codex-context-gateway", maxFiles = 42 }) {
  const selected = new Map();
  const add = (path, reason, mode = "reference-only") => {
    if (!path || isForbiddenPath(path) || isSensitivePath(path) || selected.size >= maxFiles) return;
    selected.set(path, { path, reason, mode });
  };

  for (const path of gatewayCoreFiles) add(path, "phase592-core-gateway-file", "summary");
  for (const item of gitDiff?.changedFiles || []) add(item.path, `dirty-file-${item.status}`, "reference-only");

  const taskText = String(task || "").toLowerCase();
  if (profile === "mission-control-workforce" || /mission control|workforce|branch|employee/.test(taskText)) {
    for (const path of missionControlFiles) add(path, "mission-control-workforce-context", "reference-only");
  }

  return {
    completed: true,
    selectionMode: "targeted-not-full-repo",
    defaultFullRepoScan: false,
    files: [...selected.values()],
  };
}
