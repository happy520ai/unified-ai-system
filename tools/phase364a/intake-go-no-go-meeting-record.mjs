import { goNoGoDecisionRecordPath, readJsonIfExists, writeJson, writeText, containsSecretLikeText } from "../phase364-common.mjs";

const record = await readJsonIfExists(goNoGoDecisionRecordPath);
const validationErrors = [];

if (record) {
  if (record.meetingHeld !== true) validationErrors.push("MEETING_NOT_HELD");
  if (!["go", "no_go", "conditional_go", "postponed"].includes(record.decision)) validationErrors.push("DECISION_INVALID");
  if (!record.decisionBy) validationErrors.push("DECISION_BY_MISSING");
  if (!record.decisionRole) validationErrors.push("DECISION_ROLE_MISSING");
  if (!record.decisionTimestamp) validationErrors.push("DECISION_TIMESTAMP_MISSING");
  if (!Array.isArray(record.attendees) || !record.attendees.some((item) => item.present === true)) validationErrors.push("ATTENDEES_NOT_PRESENT");
  if (!Array.isArray(record.evidenceRefs) || record.evidenceRefs.length === 0) validationErrors.push("EVIDENCE_REFS_MISSING");
  if (record.rollbackAcknowledged !== true) validationErrors.push("ROLLBACK_NOT_ACKNOWLEDGED");
  if (record.monitoringAcknowledged !== true) validationErrors.push("MONITORING_NOT_ACKNOWLEDGED");
  if (!record.deployAuthorizationRef) validationErrors.push("DEPLOY_AUTH_REF_MISSING");
  if (record.auditTrace?.codexIsDecisionMaker !== false) validationErrors.push("CODEX_AS_DECISION_MAKER");
  if (record.auditTrace?.forged !== false) validationErrors.push("DECISION_RECORD_FORGED");
  if (record.auditTrace?.secretValueIncluded !== false) validationErrors.push("SECRET_FLAG_TRUE");
  if (containsSecretLikeText(record)) validationErrors.push("SECRET_VALUE_EXPOSED");
}

const result = {
  phase: "Phase364A",
  decisionRecordPresent: Boolean(record),
  decisionRecordValid: Boolean(record && validationErrors.length === 0),
  meetingHeld: Boolean(record?.meetingHeld),
  decision: record?.decision || "pending",
  decisionBy: record?.decisionBy || null,
  codexIsDecisionMaker: false,
  validationErrors,
  blocked: !record || validationErrors.length > 0,
  blockReason: !record || validationErrors.length > 0 ? "GO_NO_GO_DECISION_RECORD_MISSING_OR_INVALID" : null,
  safety: {
    secretValueExposed: false,
    approvalForged: false,
    deployExecuted: false,
    releaseExecuted: false,
  },
};

await writeJson("docs/phase364a-go-no-go-decision-record.schema.json", {
  phase: "Phase364A",
  required: [
    "decisionRecordId",
    "meetingName",
    "meetingHeld",
    "decision",
    "decisionTimestamp",
    "decisionBy",
    "decisionRole",
    "attendees",
    "evidenceRefs",
    "conditions",
    "rollbackAcknowledged",
    "monitoringAcknowledged",
    "deployAuthorizationRef",
    "auditTrace",
  ],
  decisionEnum: ["go", "no_go", "conditional_go", "postponed"],
});
await writeText("docs/phase364a-go-no-go-meeting-record-intake-report.md", [
  "# Phase364A Go/No-Go Meeting Record Intake Report",
  "",
  `- decisionRecordPresent: ${result.decisionRecordPresent}`,
  `- decisionRecordValid: ${result.decisionRecordValid}`,
  `- meetingHeld: ${result.meetingHeld}`,
  `- decision: ${result.decision}`,
].join("\n"));
await writeText("docs/phase364a-execution-report.md", [
  "# Phase364A Execution Report",
  "",
  "- intake executed",
  `- blocked: ${result.blocked}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase364a/go-no-go-meeting-record-intake-result.json", result);

console.log(JSON.stringify(result, null, 2));
