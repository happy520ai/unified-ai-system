import { ensurePhaseDirs, logResult, paths, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildIssueLedgerAutomation } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildIssueLedgerAutomation();
writeJson(paths.issueLedger, result);
writeDoc("docs/phase971-1000/phase988-issue-ledger-automation.md", {
  title: "Phase988 Issue Ledger Automation",
  goal: "Create local self-use issue ledger and severity policy.",
  facts: [`issueLedgerReady=${result.issueLedgerReady}`],
  boundaries: ["Ledger only."],
  outputs: [paths.issueLedger],
});
logResult(result);
