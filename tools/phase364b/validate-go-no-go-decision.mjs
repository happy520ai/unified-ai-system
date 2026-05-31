import { readJson, readJsonIfExists, writeJson, writeText } from "../phase364-common.mjs";

const phase363c = await readJson("apps/ai-gateway-service/evidence/phase363c/approval-source-audit-verification-result.json");
const phase363d = await readJson("docs/phase363d-deploy-authorization-state-rerun.json");
const phase363e = await readJson("docs/phase363e-signoff-verification-rerun-state.json");
const phase363f = await readJson("docs/phase363f-go-no-go-decision-preparation-state.json");
const phase364a = await readJson("apps/ai-gateway-service/evidence/phase364a/go-no-go-meeting-record-intake-result.json");
const decisionRecord = await readJsonIfExists("docs/approvals/phase364/go-no-go-decision-record.json");

const goDecisionAllowed =
  phase363f.approvalRecordsComplete === true &&
  phase363c.sourceVerified === true &&
  phase363e.signoffsVerified === true &&
  phase363d.deployAuthorized === true &&
  phase364a.decisionRecordValid === true &&
  (decisionRecord?.decision === "go" || decisionRecord?.decision === "conditional_go");

const launchAuthorizationEligible = goDecisionAllowed;
const conditions = decisionRecord?.decision === "conditional_go" ? decisionRecord.conditions || [] : decisionRecord?.conditions || [];
const remainingBlockers = [
  ...(phase363f.approvalRecordsComplete ? [] : ["approval_records_incomplete"]),
  ...(phase363c.sourceVerified ? [] : ["approval_source_not_verified"]),
  ...(phase363e.signoffsVerified ? [] : ["signoffs_not_verified"]),
  ...(phase363d.deployAuthorized ? [] : ["deploy_not_authorized"]),
  ...(phase364a.decisionRecordValid ? [] : ["decision_record_invalid"]),
  ...(goDecisionAllowed ? [] : ["final_manual_execution_confirmation"]),
];

const state = {
  phase: "Phase364B",
  goNoGoDecisionValidated: phase364a.decisionRecordValid === true,
  goDecision: decisionRecord?.decision || "pending",
  goDecisionAllowed,
  launchAuthorizationEligible,
  approvalRecordsComplete: phase363f.approvalRecordsComplete === true,
  signoffsVerified: phase363e.signoffsVerified === true,
  deployAuthorized: phase363d.deployAuthorized === true,
  decisionRecordValid: phase364a.decisionRecordValid === true,
  remainingBlockers,
  conditions,
  safety: {
    codexIsDecisionMaker: false,
    secretValueExposed: false,
    deployExecuted: false,
    releaseExecuted: false,
  },
};

await writeJson("docs/phase364b-go-no-go-decision-validation-state.json", state);
await writeText("docs/phase364b-go-no-go-decision-validation-report.md", [
  "# Phase364B Go/No-Go Decision Validation Report",
  "",
  `- goNoGoDecisionValidated: ${state.goNoGoDecisionValidated}`,
  `- goDecisionAllowed: ${state.goDecisionAllowed}`,
  `- launchAuthorizationEligible: ${state.launchAuthorizationEligible}`,
].join("\n"));
await writeText("docs/phase364b-execution-report.md", [
  "# Phase364B Execution Report",
  "",
  "- decision validation executed",
  `- launchAuthorizationEligible: ${state.launchAuthorizationEligible}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase364b/go-no-go-decision-validation-result.json", state);

console.log(JSON.stringify(state, null, 2));
