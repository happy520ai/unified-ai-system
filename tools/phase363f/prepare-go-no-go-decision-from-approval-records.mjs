import { readJsonIfExists, writeJson, writeText } from "../phase363-common.mjs";

const signoffState = await readJsonIfExists("docs/phase363e-signoff-verification-rerun-state.json");
const deployState = await readJsonIfExists("docs/phase363d-deploy-authorization-state-rerun.json");
const approvalRecordsComplete = Boolean(signoffState?.verifiedCount === 7);

const state = {
  phase: "Phase363F",
  approvalRecordsComplete,
  signoffsVerified: Boolean(signoffState?.signoffsVerified),
  deployAuthorized: Boolean(deployState?.deployAuthorized),
  meetingHeld: false,
  goDecision: "pending",
  goDecisionAllowed: approvalRecordsComplete && Boolean(signoffState?.signoffsVerified) && Boolean(deployState?.deployAuthorized),
  decisionRecordRequired: true,
  decisionRecordPresent: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  productionGaAuthorized: false,
  remainingBlockers: [
    ...(approvalRecordsComplete ? [] : ["approval_records_incomplete"]),
    ...(signoffState?.signoffsVerified ? [] : ["signoffs_not_verified"]),
    ...(deployState?.deployAuthorized ? [] : ["deploy_not_authorized"]),
    "meeting_record_missing",
  ],
  safety: {
    codexIsApprover: false,
    approvalForged: false,
    secretValueExposed: false,
  },
};

const result = {
  phase: "Phase363F",
  decisionPreparationGenerated: true,
  approvalRecordsComplete,
  signoffsVerified: state.signoffsVerified,
  deployAuthorized: state.deployAuthorized,
  meetingHeld: false,
  goDecision: "pending",
  goDecisionAllowed: state.goDecisionAllowed,
  decisionRecordRequired: true,
  decisionRecordPresent: false,
  remainingBlockers: state.remainingBlockers,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  workspaceCleanClaimed: false,
};

await writeJson("docs/phase363f-go-no-go-decision-preparation-state.json", state);
await writeJson("docs/phase363f-go-no-go-decision-record.template.json", {
  templateOnly: true,
  notDecisionRecord: true,
  meetingId: "",
  meetingHeld: false,
  attendees: [],
  decision: "pending",
  decisionTimestamp: null,
  decisionBy: "",
  conditions: [],
  evidenceRefs: [],
  rollbackAcknowledged: false,
  monitoringAcknowledged: false,
  deployAuthorizationRef: "docs/phase363d-deploy-authorization-state-rerun.json",
});
await writeText("docs/phase363f-go-no-go-decision-preparation.md", [
  "# Phase363F Go/No-Go Decision Preparation",
  "",
  "- This package prepares decision material only.",
  "- It does not claim GO.",
  "- It does not claim a meeting was held.",
  "- It does not authorize deploy.",
].join("\n"));
await writeText("docs/phase363f-go-no-go-remaining-blockers.md", [
  "# Phase363F Remaining Blockers",
  "",
  ...state.remainingBlockers.map((blocker) => `- ${blocker}`),
].join("\n"));
await writeText("docs/phase363f-execution-report.md", [
  "# Phase363F Execution Report",
  "",
  "- decision preparation generated",
  `- goDecision: ${state.goDecision}`,
  `- goDecisionAllowed: ${state.goDecisionAllowed}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase363f/go-no-go-decision-preparation-result.json", result);

console.log(JSON.stringify(result, null, 2));
