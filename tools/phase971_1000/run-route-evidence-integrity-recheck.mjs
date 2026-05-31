import { ensurePhaseDirs, exists, logResult, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { recheckRouteEvidenceIntegrity } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = recheckRouteEvidenceIntegrity({
  phase941960FinalPresent: exists(paths.phase941960Final),
  phase966970FinalPresent: exists(paths.phase966970Final),
  closureLedgerPresent: exists(paths.closureLedger),
  closureLedger: readJsonIfPresent(paths.closureLedger) || {},
});
writeJson(paths.integrity, result);
writeDoc("docs/phase971-1000/phase974-route-evidence-integrity-recheck.md", {
  title: "Phase974 Route Evidence Integrity Recheck",
  goal: "Check original and supplemental route evidence integrity.",
  facts: [`routeEvidenceIntegrityPassed=${result.routeEvidenceIntegrityPassed}`],
  boundaries: ["No mutation of Phase941-960 evidence."],
  outputs: [paths.integrity],
});
logResult(result);
