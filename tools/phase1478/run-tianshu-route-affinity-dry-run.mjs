import {
  createConceptFieldSyntheticSpace,
  rankConceptFieldRoutes,
  scoreConceptFieldRouteAffinity,
} from "../../packages/taiji-beidou-engine/src/index.js";
import { cases, paths, phaseResult, writeJson } from "../phase1476_1485/phase1476-1485-common.mjs";

const space = createConceptFieldSyntheticSpace();
const input = cases.find((entry) => entry.caseId === "tianshu-route-scoring").input;
const tianshuRouteAffinity = scoreConceptFieldRouteAffinity(input, { space, targetRoute: "tianshu" });
const routeRanking = rankConceptFieldRoutes(input, { space });
const result = phaseResult("Phase1478", {
  phaseName: "Tianshu Route Affinity Dry-Run",
  tianshuRouteAffinityDryRun: true,
  routeAffinityScoreGenerated: true,
  tianshuRouteAffinity,
  routeRanking,
});

writeJson(paths.phase1478, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  routeAffinityScore: tianshuRouteAffinity.routeAffinityScore,
}, null, 2));
