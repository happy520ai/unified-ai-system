import { exists, ensurePhaseDirs, logResult, paths, readJsonIfPresent, sealFromChecks, writeDoc, writeJson } from "./phase971-1000-common.mjs";

ensurePhaseDirs();
const regression = readJsonIfPresent(paths.regressionRoutineJson) || {};
const evidenceLedgerReady = exists(paths.evidenceLedger);
const issueLedgerReady = exists(paths.issueLedger);
const dailyUseJournalReady = exists(paths.dailyJournalTemplate);
const result = sealFromChecks("Phase986-990", {
  localRegressionRoutineReady: regression.localRegressionRoutineReady === true,
  evidenceLedgerReady,
  issueLedgerReady,
  dailyUseJournalReady,
}, {});
writeJson(paths.automationSeal, result);
writeDoc("docs/phase971-1000/phase990-local-operation-automation-seal.md", {
  title: "Phase990 Local Operation Automation Seal",
  goal: "Seal local regression, evidence ledger, issue ledger, and daily journal readiness.",
  facts: [`recommended_sealed=${result.recommended_sealed}`],
  boundaries: ["No Provider calls."],
  outputs: [paths.automationSeal],
});
logResult(result);
