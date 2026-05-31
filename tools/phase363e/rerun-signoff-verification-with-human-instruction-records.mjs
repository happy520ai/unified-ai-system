import { allowedApprovalTypes, containsSecretLikeText, readJsonIfExists, validateInstruction, writeJson, writeText } from "../phase363-common.mjs";

const instruction = await readJsonIfExists("docs/approvals/phase363/explicit-human-approval-instruction.json");
const instructionValidation = instruction ? validateInstruction(instruction) : { valid: false };
const signoffFiles = {
  human_launch_approval: "docs/approvals/phase361/human-approval-record.json",
  deploy_authorization: "docs/approvals/phase361/deploy-authorization-record.json",
  god_mode_quality_signoff: "docs/approvals/phase361/god-mode-reviewer-quality-signoff.json",
  tianshu_policy_decision: "docs/approvals/phase361/tianshu-reviewer-decision-record.json",
  credential_vault_backend_approval: "docs/approvals/phase361/credential-vault-backend-approval-record.json",
  tenant_admin_approval: "docs/approvals/phase361/tenant-admin-approval-record.json",
  billing_warning_copy_approval: "docs/approvals/phase361/billing-warning-copy-approval-record.json",
};

const missingSignoffs = [];
const invalidSignoffs = [];
const conditionalSignoffs = [];
let verifiedCount = 0;

for (const approvalType of allowedApprovalTypes) {
  const record = await readJsonIfExists(signoffFiles[approvalType]);
  if (!record) {
    missingSignoffs.push({ approvalType, reason: "record_missing" });
    continue;
  }
  const approved = record.approvalDecision === "approved" || record.approvalDecision === "approved_with_conditions";
  const sourceOk = record.auditTrace?.approvalSource === "explicit_human_instruction";
  const codexOk = record.auditTrace?.codexIsApprover === false;
  const scopeOk = record.approvedScope?.length > 0;
  const noSecret = !containsSecretLikeText(record);
  if (!approved || !sourceOk || !codexOk || !scopeOk || !noSecret || record.draftOnly || record.notAnApproval) {
    invalidSignoffs.push({ approvalType, reason: "verification_failed" });
    continue;
  }
  verifiedCount += 1;
  if (record.approvalDecision === "approved_with_conditions") {
    conditionalSignoffs.push({ approvalType, recordRef: signoffFiles[approvalType] });
  }
}

const signoffsVerified = missingSignoffs.length === 0 && invalidSignoffs.length === 0;
const result = {
  phase: "Phase363E",
  signoffVerificationRerun: true,
  signoffsVerified,
  verifiedCount,
  missingCount: missingSignoffs.length,
  invalidCount: invalidSignoffs.length,
  conditionalCount: conditionalSignoffs.length,
  conditionalSignoffs,
  invalidSignoffs,
  launchBlockedBySignoff: !signoffsVerified,
  workspaceCleanClaimed: false,
};

await writeJson("docs/phase363e-signoff-verification-rerun-state.json", result);
await writeText("docs/phase363e-signoff-verification-rerun-report.md", [
  "# Phase363E Signoff Verification Rerun Report",
  "",
  `- signoffsVerified: ${signoffsVerified}`,
  `- verifiedCount: ${verifiedCount}`,
  `- missingCount: ${missingSignoffs.length}`,
  `- invalidCount: ${invalidSignoffs.length}`,
].join("\n"));
await writeText("docs/phase363e-execution-report.md", [
  "# Phase363E Execution Report",
  "",
  "- signoff verification rerun completed",
  `- signoffsVerified: ${signoffsVerified}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase363e/signoff-verification-rerun-result.json", result);

console.log(JSON.stringify(result, null, 2));
