import { collectApprovalRecords, markdownList, phase360PrerequisiteCheck, writeJson, writeText } from "../phase361-common.mjs";

const prereq = await phase360PrerequisiteCheck();
const approvals = await collectApprovalRecords();
const deployRecord = approvals.collectedApprovals.find((item) => item.approvalType === "deploy_authorization");
const missingAuthorizationRecords = deployRecord ? [] : ["deploy_authorization"];
const blockers = [
  ...prereq.missing.map((ref) => `missing_phase360_ref:${ref}`),
  ...missingAuthorizationRecords,
  ...approvals.invalidApprovals.map((item) => `invalid_${item.approvalType}`),
];
const deployAuthorized = prereq.allowLaunchAuthorizationWorkflow && Boolean(deployRecord) && blockers.length === 0;

const state = {
  phase: "Phase361C",
  packetName: "deploy-authorization-packet",
  deployAuthorized,
  releaseAuthorized: false,
  tagAuthorized: false,
  artifactUploadAuthorized: false,
  productionGaAuthorized: false,
  authorizationRecordRef: deployRecord?.recordRef || null,
  missingAuthorizationRecords,
  conditions: deployRecord?.validation?.conditional ? deployRecord.conditions || [] : [],
  blockers,
  safety: {
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    secretValueExposed: false,
  },
};

const result = {
  phase: "Phase361C",
  deployAuthorizationPacketGenerated: true,
  ...state,
  workspaceCleanClaimed: false,
};

await writeJson("docs/phase361c-deploy-authorization-state.json", state);
await writeText("docs/phase361c-deploy-authorization-packet.md", [
  "# Phase361C Deploy Authorization Packet",
  "",
  "This packet prepares deployment authorization review material only. It does not execute deploy or release.",
  "",
  "## Production Candidate Evidence Refs",
  markdownList(prereq.present),
  "",
  "## Required Approval Refs",
  markdownList(["deploy_authorization", "human_launch_approval", "tenant_admin_approval", "god_mode_quality_signoff", "tianshu_policy_decision", "credential_vault_backend_approval", "billing_warning_copy_approval"]),
  "",
  "## Collected Approval Refs",
  markdownList(approvals.collectedApprovals.map((item) => item.recordRef)),
  "",
  "## Missing Approval Refs",
  markdownList([...approvals.missingApprovals, ...missingAuthorizationRecords]),
  "",
  "## Known Blockers",
  markdownList(blockers),
  "",
  "## Explicit State",
  `- deployAuthorized: ${deployAuthorized}`,
  "- deployExecuted: false",
].join("\n"));
await writeText("docs/phase361c-deploy-scope-and-boundary.md", [
  "# Phase361C Deploy Scope And Boundary",
  "",
  "## Deploy Scope",
  "- Documentation-only authorization packet.",
  "- Future production deploy requires explicit authorization.",
  "",
  "## Excluded Scope",
  "- No deploy.",
  "- No release.",
  "- No tag creation.",
  "- No artifact upload.",
].join("\n"));
await writeText("docs/phase361c-deploy-risk-register.md", ["# Phase361C Deploy Risk Register", "", markdownList(blockers)].join("\n"));
await writeText("docs/phase361c-deploy-rollback-plan.md", [
  "# Phase361C Deploy Rollback Plan",
  "",
  "- Rollback is a runbook requirement only in Phase361C.",
  "- No production state is changed in this phase.",
  "- A future rollback must reference the exact authorized deploy version and operator record.",
].join("\n"));
await writeText("docs/phase361c-execution-report.md", [
  "# Phase361C Execution Report",
  "",
  "- deployAuthorizationPacketGenerated: true",
  `- deployAuthorized: ${deployAuthorized}`,
  "- deployExecuted: false",
  "- releaseExecuted: false",
  "- tagCreated: false",
  "- artifactUploaded: false",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase361c/deploy-authorization-packet-result.json", result);

console.log(JSON.stringify(result, null, 2));
