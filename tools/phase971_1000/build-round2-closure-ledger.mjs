import { ensurePhaseDirs, logResult, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildRound2ClosureLedger } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildRound2ClosureLedger({ clearance: readJsonIfPresent(paths.blockerClearance) || {} });
writeJson(paths.closureLedger, result);
writeDoc("docs/phase971-1000/phase973-round2-closure-ledger.md", {
  title: "Phase973 Round2 Closure Ledger",
  goal: "Record the supplemental rebind method for Round 2 closure.",
  facts: [`closureMethod=${result.closureMethod}`, `round2CanBeClosedWithSupplement=${result.round2CanBeClosedWithSupplement}`],
  boundaries: ["Ledger only.", "No old evidence mutation."],
  outputs: [paths.closureLedger],
});
logResult(result);
