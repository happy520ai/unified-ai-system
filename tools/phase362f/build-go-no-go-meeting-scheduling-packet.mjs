import { exists, readJson, writeJson, writeText } from "../phase362-common.mjs";

const phase361Decision = await readJson("docs/phase361f-go-no-go-decision-state.json");
const meetingRecordExists = await exists("docs/approvals/phase362/go-no-go-meeting-schedule-record.json");
const requiredAttendees = [
  "launch owner",
  "deploy owner",
  "tenant admin",
  "God Mode reviewer",
  "Tianshu reviewer",
  "credential vault owner",
  "billing / warning copy reviewer",
  "incident response owner",
  "rollback owner",
].map((role) => ({ role, confirmed: false, confirmationRecordRef: null }));
const preReadEvidence = {
  phase: "Phase362F",
  preReadEvidenceReady: true,
  evidenceRefs: [
    "docs/phase360a-production-candidate-final-signoff-packet.md",
    "docs/phase361a-launch-authorization-state.json",
    "docs/phase361b-human-approval-records-index.json",
    "docs/phase361c-deploy-authorization-state.json",
    "docs/phase361d-signoff-verification-report.md",
    "docs/phase361f-go-no-go-decision-state.json",
    "docs/phase362a-reviewer-follow-up-tracker.json",
    "docs/phase362b-deploy-authorization-remediation-checklist.json",
    "docs/phase362c-tenant-admin-signoff-checklist.json",
    "docs/phase362d-vault-approval-checklist.json",
    "docs/phase362e-billing-warning-copy-checklist.json",
  ],
};
const schedulingBlockers = [
  ...(meetingRecordExists ? [] : ["meeting_schedule_record_missing"]),
  ...(phase361Decision.requiredApprovalsComplete ? [] : ["required_approvals_incomplete"]),
  ...(phase361Decision.deployAuthorized ? [] : ["deploy_authorization_missing"]),
];
const state = {
  phase: "Phase362F",
  meetingName: "production-go-no-go-meeting-scheduling",
  meetingScheduled: meetingRecordExists,
  meetingHeld: false,
  goDecision: "pending",
  goDecisionAllowed: false,
  requiredApprovalsComplete: false,
  requiredAttendeesConfirmed: false,
  preReadEvidenceReady: true,
  schedulingBlockers,
  decisionRecordRef: null,
  safety: {
    deployAuthorized: false,
    releaseAuthorized: false,
    productionGaAuthorized: false,
    deployExecuted: false,
    releaseExecuted: false,
  },
};
const result = {
  phase: "Phase362F",
  goNoGoSchedulingPacketGenerated: true,
  requiredAttendeesGenerated: true,
  preReadEvidenceIndexGenerated: true,
  meetingScheduled: state.meetingScheduled,
  meetingHeld: false,
  goDecision: "pending",
  goDecisionAllowed: false,
  requiredApprovalsComplete: false,
  requiredAttendeesConfirmed: false,
  deployAuthorized: false,
  releaseAuthorized: false,
  productionGaAuthorized: false,
  workspaceCleanClaimed: false,
};

await writeJson("docs/phase362f-go-no-go-required-attendees.json", { phase: "Phase362F", requiredAttendees });
await writeJson("docs/phase362f-go-no-go-pre-read-evidence-index.json", preReadEvidence);
await writeJson("docs/phase362f-go-no-go-scheduling-state.json", state);
await writeText("docs/phase362f-go-no-go-meeting-scheduling-design.md", [
  "# Phase362F Go/No-Go Meeting Scheduling Design",
  "",
  "This packet prepares meeting scheduling only. It does not schedule a real meeting without a real calendar or meeting record.",
].join("\n"));
await writeText("docs/phase362f-go-no-go-meeting-scheduling-packet.md", [
  "# Phase362F Go/No-Go Meeting Scheduling Packet",
  "",
  `- meetingScheduled: ${state.meetingScheduled}`,
  "- meetingHeld: false",
  "- goDecision: pending",
  "- goDecisionAllowed: false",
  "",
  "## Scheduling Blockers",
  ...schedulingBlockers.map((item) => `- ${item}`),
].join("\n"));
await writeText("docs/phase362f-go-no-go-meeting-agenda.md", [
  "# Phase362F Go/No-Go Meeting Agenda",
  "",
  "1. Phase360 production candidate recap",
  "2. Phase361 authorization blockers recap",
  "3. Phase362 approval evidence intake status",
  "4. deploy authorization review",
  "5. tenant/admin signoff review",
  "6. vault approval review",
  "7. billing warning copy approval review",
  "8. risk register review",
  "9. rollback readiness review",
  "10. monitoring readiness review",
  "11. Go / No-Go decision",
  "12. action items",
].join("\n"));
await writeText("docs/phase362f-execution-report.md", [
  "# Phase362F Execution Report",
  "",
  "- goNoGoSchedulingPacketGenerated: true",
  "- requiredAttendeesGenerated: true",
  "- preReadEvidenceIndexGenerated: true",
  `- meetingScheduled: ${state.meetingScheduled}`,
  "- goDecision: pending",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase362f/go-no-go-meeting-scheduling-packet-result.json", result);

console.log(JSON.stringify(result, null, 2));
