import { createConceptFieldSyntheticSpace, auditConceptFieldFailures } from "../../packages/taiji-beidou-engine/src/index.js";
import { benchmarkCases, paths, phaseResult, writeJson } from "../phase1476_1485/phase1476-1485-common.mjs";

const space = createConceptFieldSyntheticSpace();
const failureAudit = auditConceptFieldFailures(benchmarkCases(), { space });
const result = phaseResult("Phase1484", {
  phaseName: "Concept Field Failure / Drift / Hallucination Audit",
  failureDriftHallucinationAuditCompleted: true,
  benchmarkAgainstBaseline: true,
  failureAudit,
});

writeJson(paths.phase1484, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  driftCandidateCount: failureAudit.driftCandidateCount,
  hallucinationCandidateCount: failureAudit.hallucinationCandidateCount,
}, null, 2));
