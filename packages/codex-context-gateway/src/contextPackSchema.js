export const CONTEXT_PACK_SCHEMA_VERSION = "phase592.context-pack.v1";

export function buildContextPack({
  task,
  architecture,
  projectState,
  phaseEvidence,
  gitDiff,
  relevantFiles,
  longContextSummary,
  tokenBudgetReport,
  freshnessReport,
  staleGuard,
  safety,
  hash,
}) {
  return {
    schemaVersion: CONTEXT_PACK_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    hash,
    task,
    gatewayType: "codex-context-gateway",
    notMainGatewayRuntime: true,
    providerCalled: false,
    codexBaseUrlConnected: false,
    architecture,
    projectState: summarizeProjectState(projectState),
    phaseEvidence: {
      indexedCount: phaseEvidence.indexedCount,
      phaseCount: phaseEvidence.phaseCount,
      latestRefs: phaseEvidence.latestRefs,
    },
    gitDiff,
    relevantFiles,
    longContextSummary,
    tokenBudget: tokenBudgetReport.budget,
    freshness: freshnessReport,
    staleGuard,
    safetyBoundary: safety,
  };
}

function summarizeProjectState(projectState) {
  return {
    completed: projectState.completed,
    packageName: projectState.packageName,
    packageVersion: projectState.packageVersion,
    packageScriptCount: projectState.packageScriptCount,
    readmeManagedBlockFound: projectState.readmeManagedBlockFound,
    agentsManagedBlockFound: projectState.agentsManagedBlockFound,
    phaseDocCount: projectState.phaseDocs.length,
    recentPhaseDocs: projectState.phaseDocs.slice(-20),
  };
}
