import {
  collectApprovalRecords,
  markdownList,
  phase360PrerequisiteCheck,
  writeJson,
  writeText,
} from "../phase361-common.mjs";

const workflowStages = [
  "production_candidate_ready",
  "evidence_bundle_review",
  "human_approval_collection",
  "deploy_authorization_review",
  "tenant_admin_signoff",
  "reviewer_quality_signoff",
  "credential_vault_approval",
  "billing_warning_copy_approval",
  "go_no_go_meeting",
  "launch_authorization_decision",
  "deploy_handoff",
  "post_launch_monitoring_plan",
];

const prereq = await phase360PrerequisiteCheck();
const approvals = await collectApprovalRecords();
const blockers = [
  ...prereq.missing.map((ref) => `missing_phase360_ref:${ref}`),
  ...approvals.missingApprovals.map((item) => item.approvalType),
  ...approvals.invalidApprovals.map((item) => `invalid_${item.approvalType}`),
];
const deployApproval = approvals.collectedApprovals.find((item) => item.approvalType === "deploy_authorization");
const humanApproval = approvals.collectedApprovals.find((item) => item.approvalType === "human_launch_approval");
const launchAuthorized = prereq.allowLaunchAuthorizationWorkflow && blockers.length === 0;
const deployAuthorized = Boolean(deployApproval) && prereq.allowLaunchAuthorizationWorkflow;

const state = {
  phase: "Phase361A",
  workflowName: "production-launch-authorization-workflow",
  productionCandidateReady: prereq.allowLaunchAuthorizationWorkflow,
  launchAuthorized,
  deployAuthorized,
  releaseAuthorized: false,
  productionGaAuthorized: false,
  humanApprovalRequired: true,
  goNoGoRequired: true,
  currentState: launchAuthorized ? "launch_authorization_ready_for_go_no_go" : "authorization_pending",
  requiredApprovals: Object.keys({
    human_launch_approval: true,
    deploy_authorization: true,
    god_mode_quality_signoff: true,
    tianshu_policy_decision: true,
    credential_vault_backend_approval: true,
    tenant_admin_approval: true,
    billing_warning_copy_approval: true,
  }),
  collectedApprovals: approvals.collectedApprovals,
  missingApprovals: approvals.missingApprovals,
  blockers,
  safety: {
    noDeployExecuted: true,
    noReleaseExecuted: true,
    noTagCreated: true,
    noArtifactUploaded: true,
    noSecretExposed: true,
  },
};

const result = {
  phase: "Phase361A",
  workflowGenerated: true,
  productionCandidateReady: state.productionCandidateReady,
  launchAuthorized: state.launchAuthorized,
  deployAuthorized: state.deployAuthorized,
  releaseAuthorized: false,
  productionGaAuthorized: false,
  humanApprovalRequired: true,
  goNoGoRequired: true,
  currentState: state.currentState,
  humanApprovalRecordRef: humanApproval?.recordRef || null,
  deployAuthorizationRecordRef: deployApproval?.recordRef || null,
  missingApprovals: state.missingApprovals,
  blockers,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

await writeJson("docs/phase361a-launch-authorization-workflow.schema.json", {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  title: "Phase361A Launch Authorization Workflow",
  type: "object",
  required: ["phase", "workflowName", "workflowStages", "authorizationRules", "safety"],
});
await writeJson("docs/phase361a-launch-authorization-state.json", state);
await writeText("docs/phase361a-production-launch-authorization-workflow.md", [
  "# Phase361A Production Launch Authorization Workflow",
  "",
  "This workflow converts the Phase360 production-candidate signoff into a launch authorization process. It does not authorize deploy, release, tag creation, artifact upload, or production GA.",
  "",
  "## Workflow Stages",
  markdownList(workflowStages),
  "",
  "## Current Allowed States",
  "- production_candidate_ready",
  "- evidence_bundle_review",
  "- human_approval_collection_pending",
  "- deploy_authorization_pending",
  "",
  "## Blocked States",
  "- launch_authorized",
  "- deploy_handoff",
  "- production_ga",
].join("\n"));
await writeText("docs/phase361a-launch-authorization-risk-register.md", [
  "# Phase361A Launch Authorization Risk Register",
  "",
  "## Blockers",
  markdownList(blockers),
  "",
  "## Boundary",
  "- launchAuthorized remains false unless real approvals are present and valid.",
  "- deployAuthorized remains false unless a real deploy authorization record is present and valid.",
].join("\n"));
await writeText("docs/phase361a-execution-report.md", [
  "# Phase361A Execution Report",
  "",
  `- workflowGenerated: ${result.workflowGenerated}`,
  `- productionCandidateReady: ${result.productionCandidateReady}`,
  `- launchAuthorized: ${result.launchAuthorized}`,
  `- deployAuthorized: ${result.deployAuthorized}`,
  `- blockerCount: ${blockers.length}`,
  "- deployExecuted: false",
  "- releaseExecuted: false",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase361a/production-launch-authorization-workflow-result.json", result);

console.log(JSON.stringify(result, null, 2));
