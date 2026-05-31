export const localSelfUseIssueLedgerCopy = Object.freeze({
  title: "Local Issue Ledger",
  subtitle: "Local issue severity policy for self-use routing v1.",
  severitySummary: "P0: safety/data loss, P1: route/gate/rollback, P2: UX/scoring/fallback, P3: docs/polish.",
  safetyLines: [
    "Issue entries are local records, not production incident reports.",
    "P0 issues should stop local self-use until reviewed.",
  ],
});
