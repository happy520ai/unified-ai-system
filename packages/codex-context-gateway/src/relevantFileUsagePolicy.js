import { buildRelevantFileScopeGate, requestFileRead } from "./relevantFileScopeGate.js";

export const PHASE595_ALLOWED_GENERATED_FILES = Object.freeze([
  "docs/phase595-codex-context-real-usage-trial-note.md",
  "docs/phase595a-real-usage-trial-scope-lock.md",
  "docs/phase595t-codex-context-real-usage-trial-closure.md",
  "tools/phase595-common.mjs",
  "tools/phase595-registry.mjs",
  "tools/phase595-sequential-runner.mjs",
  "package.json",
  "README.md",
  "AGENTS.md",
  "apps/ai-gateway-service/src/entrypoints/syncReadmeAgentsCurrentState.js",
  "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
  "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
  "apps/ai-gateway-service/src/ui/consolePage.js",
]);

export function buildRelevantFileUsagePolicy(options = {}) {
  const scope = buildRelevantFileScopeGate(options);
  const contextReads = [
    ".codex-context/current-context-pack.md",
    ".codex-context/current-context-pack.json",
    ".codex-context/relevant-files.json",
    ".codex-context/codex-prompt-pack.md",
    ".codex-context/token-budget-report.json",
    ".codex-context/context-freshness-report.json",
  ];
  const expectedReadFiles = Array.from(new Set([
    ...contextReads,
    ...scope.allowedPaths,
    ...PHASE595_ALLOWED_GENERATED_FILES,
  ]));
  const outOfScopePreview = requestFileRead(
    "apps/ai-gateway-service/src/httpServer.js",
    expectedReadFiles,
    "not needed for Phase595; runtime is out of scope",
  );
  return {
    completed: scope.scopeGateWorks && expectedReadFiles.length > 0,
    relevantFilesLoaded: scope.relevantFileScopeLoaded,
    expectedReadFilesGenerated: expectedReadFiles.length > 0,
    fullRepoScanAvoided: scope.fullRepoScanAvoided,
    outOfScopeReadRequiresReason: true,
    relevantFileCountVisible: scope.relevantFileCountVisible,
    relevantFileCount: scope.relevantFileCount,
    expectedReadFiles,
    defaultRelevantFiles: scope.relevantFiles,
    outOfScopePreview,
  };
}
