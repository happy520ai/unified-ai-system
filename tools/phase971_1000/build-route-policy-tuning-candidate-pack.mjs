import { ensurePhaseDirs, logResult, paths, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildRoutePolicyTuningCandidatePack } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildRoutePolicyTuningCandidatePack();
writeJson(paths.tuningCandidates, result);
writeDoc("docs/phase971-1000/phase977-route-policy-tuning-candidate-pack.md", {
  title: "Phase977 Route Policy Tuning Candidate Pack",
  goal: "Prepare candidate tuning values for future approved runtime policy work.",
  facts: [`routePolicyTuningCandidatePackReady=${result.routePolicyTuningCandidatePackReady}`],
  boundaries: ["Candidate pack only.", "No runtime application."],
  outputs: [paths.tuningCandidates],
});
logResult(result);
