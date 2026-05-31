import { ensurePhaseDirs, logResult, paths, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildEvidenceLedgerAutomation } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildEvidenceLedgerAutomation();
writeJson(paths.evidenceLedger, result);
writeDoc("docs/phase971-1000/phase987-evidence-ledger-automation.md", {
  title: "Phase987 Evidence Ledger Automation",
  goal: "Create local self-use evidence ledger schema and starter entry.",
  facts: [`evidenceLedgerReady=${result.evidenceLedgerReady}`, `schema=${result.schema.join(",")}`],
  boundaries: ["No external upload."],
  outputs: [paths.evidenceLedger],
});
logResult(result);
