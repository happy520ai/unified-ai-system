export function compressLongContext({ projectState, phaseEvidence, gitDiff }) {
  const readmeSummary = projectState.files.find((item) => item.path === "README.md");
  const agentsSummary = projectState.files.find((item) => item.path === "AGENTS.md");
  const latestEvidence = phaseEvidence.latestRefs.slice(-18).map((item) => ({
    phaseId: item.phaseId,
    path: item.path,
    completed: item.completed,
    recommended_sealed: item.recommended_sealed,
    blocker: item.blocker,
  }));

  return {
    completed: true,
    compressionMode: "phase-history-boundary-blocker-next-action",
    retainedSignals: [
      "current system position",
      "phase summary",
      "safety boundary",
      "blocker",
      "relevant evidence refs",
      "dirty-file metadata",
      "next verification action",
    ],
    droppedSignals: ["full historical logs", "raw provider outputs", "raw secret files", "full git diff content"],
    summary: {
      packageName: projectState.packageName,
      readmeHeadings: readmeSummary?.firstHeadings || [],
      agentsHeadings: agentsSummary?.firstHeadings || [],
      phaseDocCount: projectState.phaseDocs.length,
      evidenceRefCount: phaseEvidence.indexedCount,
      dirtyFileCount: gitDiff.changedFileCount,
      currentBlocker: "none recorded in managed state; workspace dirty is not clean",
      nextAction: "Use generated Codex prompt pack with fresh context hash before executing any Codex task.",
    },
    latestEvidence,
  };
}
