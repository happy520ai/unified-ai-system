import { createHash } from "node:crypto";

export function buildContextHash(input) {
  const stable = JSON.stringify(input, Object.keys(input).sort());
  return createHash("sha256").update(stable).digest("hex");
}

export function buildSnapshotPolicy({ projectState, phaseEvidence, gitDiff, relevantFiles, task }) {
  const hash = buildContextHash({
    task,
    packageName: projectState.packageName,
    packageVersion: projectState.packageVersion,
    packageScriptCount: projectState.packageScriptCount,
    evidenceCount: phaseEvidence.indexedCount,
    dirtyFiles: gitDiff.changedFiles.map((item) => `${item.status}:${item.path}`),
    relevantFiles: relevantFiles.map((item) => item.path),
  });
  return {
    completed: true,
    hash,
    inputs: ["project-state", "phase-evidence-index", "git-dirty-metadata", "relevant-files", "task"],
  };
}
