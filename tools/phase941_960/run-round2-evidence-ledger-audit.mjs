import { auditRound2EvidenceLedger } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, readModeResults, writeDoc, writeJson } from "./phase941-960-common.mjs";

ensurePhaseDirs();
const finalEvidence = readJsonIfPresent(paths.final) || readJsonIfPresent(paths.authenticity) || {};
const result = {
  ...auditRound2EvidenceLedger({
    finalEvidence,
    modeResults: readModeResults(),
  }),
  ...baseSafety(),
};
writeJson(paths.ledger, result);
writeJson(paths.qualityRound2Ledger, result);
writeDoc("phase958-round2-evidence-ledger-audit.md", {
  title: "Phase958 Round 2 Evidence Ledger Audit",
  goal: "Audit Round 2 route evidence count, source, safety, and no-default-route-change claims.",
  facts: [`realRouteEvidenceCount=${result.realRouteEvidenceCount}`, `eachRealRequestHasEvidence=${result.eachRealRequestHasEvidence}`],
  boundaries: ["No evidence deletion.", "No secret exposure."],
  outputs: [paths.ledger, paths.qualityRound2Ledger],
});
console.log(JSON.stringify(result, null, 2));
