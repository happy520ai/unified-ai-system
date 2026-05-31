import { collectApprovalRecords, exists, markdownList, phase360PrerequisiteCheck, readJsonIfExists, writeJson, writeText } from "../phase361-common.mjs";

const prereq = await phase360PrerequisiteCheck();
const approvals = await collectApprovalRecords();
const deployState = (await readJsonIfExists("docs/phase361c-deploy-authorization-state.json")) || { deployAuthorized: false, blockers: [] };
const meetingRecordRef = "docs/approvals/phase361/go-no-go-meeting-record.json";
const meetingRecordExists = await exists(meetingRecordRef);
const unresolvedBlockers = [
  ...prereq.missing.map((ref) => `missing_phase360_ref:${ref}`),
  ...approvals.missingApprovals.map((item) => item.approvalType),
  ...approvals.invalidApprovals.map((item) => `invalid_${item.approvalType}`),
  ...(Array.isArray(deployState.blockers) ? deployState.blockers : []),
];
let meetingRecord = null;
if (meetingRecordExists) meetingRecord = await readJsonIfExists(meetingRecordRef);
const requiredApprovalsComplete = approvals.missingApprovals.length === 0 && approvals.invalidApprovals.length === 0;
const goDecisionAllowed = meetingRecordExists && requiredApprovalsComplete && unresolvedBlockers.length === 0 && deployState.deployAuthorized === true;
const goDecision = goDecisionAllowed ? meetingRecord?.goDecision || "pending" : "pending";

const decisionState = {
  phase: "Phase361F",
  meetingName: "production-go-no-go-meeting",
  meetingHeld: meetingRecordExists && meetingRecord?.meetingHeld === true,
  goDecision,
  goDecisionAllowed,
  deployAuthorized: deployState.deployAuthorized === true,
  releaseAuthorized: false,
  productionGaAuthorized: false,
  requiredAttendeesPresent: meetingRecordExists && meetingRecord?.requiredAttendeesPresent === true,
  requiredApprovalsComplete,
  unresolvedBlockers,
  decisionRecordRef: meetingRecordExists ? meetingRecordRef : null,
  safety: {
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    secretValueExposed: false,
  },
};
const evidenceIndex = {
  phase: "Phase361F",
  evidenceRefs: [
    ...prereq.present,
    "docs/phase361a-launch-authorization-state.json",
    "docs/phase361b-human-approval-records-index.json",
    "docs/phase361c-deploy-authorization-state.json",
    "docs/phase361d-signoff-verification-report.md",
    "docs/phase361e-production-release-runbook.md",
  ],
  approvalRefs: approvals.collectedApprovals.map((item) => item.recordRef),
  missingApprovalRefs: approvals.missingApprovals,
};
const result = {
  phase: "Phase361F",
  goNoGoEvidencePackageGenerated: true,
  ...decisionState,
  workspaceCleanClaimed: false,
};

await writeJson("docs/phase361f-go-no-go-decision-state.json", decisionState);
await writeJson("docs/phase361f-go-no-go-evidence-index.json", evidenceIndex);
await writeText("docs/phase361f-go-no-go-meeting-evidence-package.md", [
  "# Phase361F Go/No-Go Meeting Evidence Package",
  "",
  "This package prepares Go/No-Go meeting evidence. It does not mark a GO decision without a real meeting record and complete approvals.",
  "",
  "## Agenda",
  "- Review Phase360 final signoff refs.",
  "- Review Phase361 approval records.",
  "- Review unresolved blockers.",
  "- Review deploy authorization state.",
  "- Review rollback and monitoring readiness.",
  "",
  "## Evidence Index",
  markdownList(evidenceIndex.evidenceRefs),
  "",
  "## Unresolved Blockers",
  markdownList(unresolvedBlockers),
  "",
  "## Decision State",
  `- meetingHeld: ${decisionState.meetingHeld}`,
  `- goDecision: ${decisionState.goDecision}`,
  `- goDecisionAllowed: ${decisionState.goDecisionAllowed}`,
].join("\n"));
await writeText("docs/phase361f-go-no-go-agenda.md", [
  "# Phase361F Go/No-Go Agenda",
  "",
  "- Evidence bundle review",
  "- Approval completeness review",
  "- Deploy authorization review",
  "- Signoff verification review",
  "- Rollback readiness review",
  "- Monitoring readiness review",
  "- Decision record capture",
].join("\n"));
await writeText("docs/phase361f-go-no-go-required-attendees.md", [
  "# Phase361F Go/No-Go Required Attendees",
  "",
  "- Launch owner",
  "- Tenant admin",
  "- Security reviewer",
  "- Credential vault owner",
  "- Billing owner",
  "- Operations owner",
].join("\n"));
await writeText("docs/phase361f-execution-report.md", [
  "# Phase361F Execution Report",
  "",
  "- goNoGoEvidencePackageGenerated: true",
  `- meetingHeld: ${decisionState.meetingHeld}`,
  `- goDecision: ${decisionState.goDecision}`,
  `- goDecisionAllowed: ${decisionState.goDecisionAllowed}`,
  `- unresolvedBlockerCount: ${unresolvedBlockers.length}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase361f/go-no-go-meeting-evidence-package-result.json", result);

console.log(JSON.stringify(result, null, 2));
