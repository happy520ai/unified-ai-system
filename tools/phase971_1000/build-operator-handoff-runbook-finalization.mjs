import { ensurePhaseDirs, logResult, paths, writeDoc, writeJson } from "./phase971-1000-common.mjs";

ensurePhaseDirs();
const facts = [
  "start: run local service and inspect Mission Control read-only panels",
  "stop: stop local service normally",
  "safe mode: disable route policy preview and provider route preview",
  "evidence check: inspect local-self-use/v1/evidence-ledger.json",
  "issue logging: add issues to local-self-use/v1/issues/issue-ledger.json",
  "mode choice: Normal for simple work, God for important review, Tianshu for complex planning",
  "when to stop: secret risk, unexpected deploy signal, route mutation, provider gate failure, or budget concern",
];
writeDoc(paths.operatorHandoffDoc, {
  title: "Phase998 Local Self-use Routing v1 Operator Handoff",
  goal: "Finalize operator handoff for local self-use routing v1.",
  facts,
  boundaries: ["Local-only handoff.", "No production claim."],
  outputs: [paths.operatorHandoffRunbook],
});
writeDoc(paths.operatorHandoffRunbook, {
  title: "Operator Handoff",
  goal: "Runbook for local self-use routing v1.",
  facts,
  boundaries: ["No deploy, release, push, or production traffic."],
  outputs: [paths.operatorHandoffDoc],
});
const result = {
  phase: "Phase998",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  operatorHandoffReady: true,
  runbookFinalized: true,
};
writeJson("model-routing/v1-closure/operator/operator-handoff-finalization.json", result);
logResult(result);
