import {
  createConceptFieldSnapshot,
  createConceptFieldSyntheticSpace,
  scoreConceptFieldEvidenceCoherence,
} from "../../packages/taiji-beidou-engine/src/index.js";
import { cases, paths, phaseResult, writeJson } from "../phase1476_1485/phase1476-1485-common.mjs";

const space = createConceptFieldSyntheticSpace();
const input = cases.find((entry) => entry.caseId === "evidence-memory-snapshot").input;
const snapshot = createConceptFieldSnapshot(input, { space });
const evidenceCoherence = scoreConceptFieldEvidenceCoherence(input, { space, snapshot });
const result = phaseResult("Phase1481", {
  phaseName: "Evidence Memory Field Snapshot Integration Dry-Run",
  evidenceMemoryFieldSnapshotIntegrated: true,
  fieldSnapshotGenerated: true,
  evidenceCoherenceScoreGenerated: true,
  snapshot,
  evidenceCoherence,
});

writeJson(paths.phase1481, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  evidenceCoherenceScore: evidenceCoherence.evidenceCoherenceScore,
}, null, 2));
