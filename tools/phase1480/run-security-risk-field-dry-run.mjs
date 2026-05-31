import {
  createConceptFieldSyntheticSpace,
  scoreConceptFieldRisk,
} from "../../packages/taiji-beidou-engine/src/index.js";
import { cases, paths, phaseResult, writeJson } from "../phase1476_1485/phase1476-1485-common.mjs";

const space = createConceptFieldSyntheticSpace();
const input = cases.find((entry) => entry.caseId === "security-risk-field").input;
const riskField = scoreConceptFieldRisk(input, { space });
const result = phaseResult("Phase1480", {
  phaseName: "Security Shield Risk Field Dry-Run",
  securityShieldRiskFieldDryRun: true,
  riskFieldScoreGenerated: true,
  riskField,
});

writeJson(paths.phase1480, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  riskFieldScore: riskField.riskFieldScore,
  riskDecision: riskField.riskDecision,
}, null, 2));
