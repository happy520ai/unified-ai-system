import {
  boundary,
  makeResult,
  paths,
  readJson,
  writeJson,
} from "../phase1506_1530/phase1506-1530-common.mjs";

const failure = readJson(paths.failureFrictionLedger, { ledgerItems: [] });
const items = failure.ledgerItems ?? [];
const severityBuckets = ["P0", "P1", "P2", "P3"];
const classifiedIssues = items.map((item) => ({
  id: item.id,
  category: item.category,
  severity: severityBuckets.includes(item.severity) ? item.severity : "P3",
  source: "automated_observation",
  ownerManualFeedback: false,
  repairPolicy:
    item.severity === "P0" || item.severity === "P1"
      ? "approval_required"
      : "docs_or_read_only_ui_preview_allowed",
}));

const repairQueue = {
  P0: classifiedIssues.filter((item) => item.severity === "P0"),
  P1: classifiedIssues.filter((item) => item.severity === "P1"),
  P2: classifiedIssues.filter((item) => item.severity === "P2"),
  P3: classifiedIssues.filter((item) => item.severity === "P3"),
};

const result = makeResult("Phase1522", {
  phaseName: "Dogfooding Issue Classifier",
  issueClassifierReady: true,
  severityBuckets,
  classifiedIssues,
  ...boundary,
});

writeJson(paths.issueClassifier, result);
writeJson(paths.repairQueue, makeResult("Phase1523", {
  phaseName: "Dogfooding P0/P1/P2/P3 Repair Queue",
  repairQueueReady: true,
  repairQueue,
  p0AutoRepairAllowed: false,
  p1AutoRepairAllowed: false,
  p2DocsOrReadOnlyUiRepairAllowed: true,
  p3DocsOrReadOnlyUiRepairAllowed: true,
  ...boundary,
}));

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  issueClassifierReady: result.issueClassifierReady,
}, null, 2));
