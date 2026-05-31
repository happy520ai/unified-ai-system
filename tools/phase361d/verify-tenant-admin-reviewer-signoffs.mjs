import { collectApprovalRecords, markdownList, writeJson, writeText } from "../phase361-common.mjs";

const requiredSignoffs = [
  { id: "tenant_admin_approval_record", approvalType: "tenant_admin_approval" },
  { id: "reviewer_quality_signoff", approvalType: "god_mode_quality_signoff" },
  { id: "reviewer_decision_record", approvalType: "tianshu_policy_decision" },
  { id: "reviewerChecklistId", approvalType: "tenant_admin_approval" },
  { id: "vault_backend_approval_record", approvalType: "credential_vault_backend_approval" },
  { id: "warning_copy_approval_record", approvalType: "billing_warning_copy_approval" },
];

const approvals = await collectApprovalRecords();
const collectedByType = new Map(approvals.collectedApprovals.map((item) => [item.approvalType, item]));
const missingSignoffs = [];
const invalidSignoffs = [...approvals.invalidApprovals];
const conditionalSignoffs = [];
const verifiedSignoffs = [];

for (const signoff of requiredSignoffs) {
  const record = collectedByType.get(signoff.approvalType);
  if (!record) {
    missingSignoffs.push({ signoffId: signoff.id, approvalType: signoff.approvalType, reason: "record_missing_or_not_accepted" });
    continue;
  }
  verifiedSignoffs.push({ signoffId: signoff.id, approvalType: signoff.approvalType, recordRef: record.recordRef });
  if (record.validation.conditional) conditionalSignoffs.push({ signoffId: signoff.id, approvalType: signoff.approvalType, recordRef: record.recordRef });
}

const signoffsVerified = missingSignoffs.length === 0 && invalidSignoffs.length === 0;
const result = {
  phase: "Phase361D",
  signoffVerificationExecuted: true,
  signoffsVerified,
  verifiedCount: verifiedSignoffs.length,
  missingCount: missingSignoffs.length,
  invalidCount: invalidSignoffs.length,
  conditionalCount: conditionalSignoffs.length,
  missingSignoffs,
  invalidSignoffs,
  conditionalSignoffs,
  launchBlockedBySignoff: !signoffsVerified,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

await writeJson("docs/phase361d-signoff-verification-rules.json", {
  phase: "Phase361D",
  rules: [
    "file_exists",
    "json_valid_or_markdown_frontmatter_parseable",
    "approval_type_matches",
    "approval_decision_approved_or_approved_with_conditions",
    "approved_scope_covers_module",
    "timestamp_exists",
    "evidence_refs_exist",
    "not_expired",
    "not_revoked",
    "no_secret",
    "no_api_key",
  ],
  requiredSignoffs,
});
await writeText("docs/phase361d-signoff-verification-report.md", [
  "# Phase361D Signoff Verification Report",
  "",
  `- signoffsVerified: ${result.signoffsVerified}`,
  `- verifiedCount: ${result.verifiedCount}`,
  `- missingCount: ${result.missingCount}`,
  `- invalidCount: ${result.invalidCount}`,
  `- conditionalCount: ${result.conditionalCount}`,
  `- launchBlockedBySignoff: ${result.launchBlockedBySignoff}`,
].join("\n"));
await writeText("docs/phase361d-missing-signoffs.md", ["# Phase361D Missing Signoffs", "", markdownList(missingSignoffs)].join("\n"));
await writeText("docs/phase361d-signoff-risk-register.md", [
  "# Phase361D Signoff Risk Register",
  "",
  "## Missing Signoffs",
  markdownList(missingSignoffs),
  "",
  "## Invalid Signoffs",
  markdownList(invalidSignoffs),
].join("\n"));
await writeText("docs/phase361d-execution-report.md", [
  "# Phase361D Execution Report",
  "",
  "- signoffVerificationExecuted: true",
  `- signoffsVerified: ${result.signoffsVerified}`,
  `- launchBlockedBySignoff: ${result.launchBlockedBySignoff}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase361d/tenant-admin-reviewer-signoff-verification-result.json", result);

console.log(JSON.stringify(result, null, 2));
