import {
  createConceptFieldSyntheticSpace,
  rankConceptFieldRoutes,
  runConceptFieldKernel,
} from "../../packages/taiji-beidou-engine/src/index.js";
import { cases, paths, phaseResult, writeJson } from "../phase1476_1485/phase1476-1485-common.mjs";

const space = createConceptFieldSyntheticSpace();
const input = cases.find((entry) => entry.caseId === "god-mode-arbitration").input;
const kernel = runConceptFieldKernel(input, { space });
const routeRanking = rankConceptFieldRoutes(input, { space });
const result = phaseResult("Phase1479", {
  phaseName: "God Mode Field Arbitration Dry-Run",
  godModeFieldArbitrationDryRun: true,
  routeAffinityScoreGenerated: Number.isFinite(kernel.routeAffinityScore),
  evidenceCoherenceScoreGenerated: Number.isFinite(kernel.evidenceCoherenceScore),
  surpriseScoreGenerated: Number.isFinite(kernel.surpriseScore),
  riskFieldScoreGenerated: Number.isFinite(kernel.riskFieldScore),
  selectedSyntheticRoute: routeRanking[0]?.targetRoute ?? null,
  arbitrationDecision: "dry_run_review_only",
  kernel,
  routeRanking,
});

writeJson(paths.phase1479, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  selectedSyntheticRoute: result.selectedSyntheticRoute,
}, null, 2));
