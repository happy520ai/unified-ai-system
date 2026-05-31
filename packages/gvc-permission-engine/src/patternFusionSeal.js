export function buildPatternFusionSeal({ evidenceInputs = [] } = {}) {
  const fusedClaudeCodePatterns = [
    "permission rule model",
    "shell command classifier",
    "tool registry and result ledger",
    "session timeline ledger",
    "project memory relevance and age scoring",
    "structured diff and patch review",
    "terminal transcript safety summary",
    "agent loop task capsule",
  ];
  const pmeOwnedImplementations = [
    "packages/gvc-permission-engine/src/permissionRuleEngine.js",
    "packages/gvc-permission-engine/src/shellCommandClassifier.js",
    "packages/gvc-permission-engine/src/toolRegistryLedger.js",
    "packages/gvc-permission-engine/src/sessionLedger.js",
    "packages/gvc-permission-engine/src/projectMemoryScoring.js",
    "packages/gvc-permission-engine/src/structuredDiffPatchReview.js",
    "packages/gvc-permission-engine/src/terminalTranscriptSummary.js",
    "packages/gvc-permission-engine/src/taskCapsule.js",
  ];
  return {
    fusedClaudeCodePatterns,
    pmeOwnedImplementations,
    evidenceInputCount: evidenceInputs.length,
    copiedClaudeCodeSource: false,
    secretRead: false,
    providerCallsMade: false,
    deployExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    productionReadyClaimed: false,
    workspaceCleanClaimed: false,
  };
}
