import {
  createConceptFieldSyntheticSpace,
  planConceptFieldSleepConsolidation,
} from "../../packages/taiji-beidou-engine/src/index.js";
import { cases, paths, phaseResult, writeJson } from "../phase1476_1485/phase1476-1485-common.mjs";

const space = createConceptFieldSyntheticSpace();
const candidatePlans = cases.map((entry) => ({
  caseId: entry.caseId,
  plan: planConceptFieldSleepConsolidation(entry.input, { space }),
}));
const result = phaseResult("Phase1483", {
  phaseName: "Sleep Consolidation Candidate Dry-Run",
  sleepConsolidationDryRun: true,
  sleepConsolidationCandidatesGenerated: true,
  pruneCandidatesGenerated: true,
  candidatePlans,
});

writeJson(paths.phase1483, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  candidatePlanCount: candidatePlans.length,
}, null, 2));
