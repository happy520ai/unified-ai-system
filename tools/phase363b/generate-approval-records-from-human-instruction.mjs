import { readFile } from "node:fs/promises";
import { allowedApprovalTypes, approvalRecordTemplate, instructionPath, readJsonIfExists, validateInstruction, writeJson, writeText } from "../phase363-common.mjs";

const instruction = await readJsonIfExists(instructionPath);
const validation = instruction ? validateInstruction(instruction) : { valid: false, missingFields: [], validationErrors: ["EXPLICIT_HUMAN_INSTRUCTION_MISSING_OR_INVALID"] };
const outputFiles = {
  human_launch_approval: "docs/approvals/phase361/human-approval-record.json",
  deploy_authorization: "docs/approvals/phase361/deploy-authorization-record.json",
  god_mode_quality_signoff: "docs/approvals/phase361/god-mode-reviewer-quality-signoff.json",
  tianshu_policy_decision: "docs/approvals/phase361/tianshu-reviewer-decision-record.json",
  credential_vault_backend_approval: "docs/approvals/phase361/credential-vault-backend-approval-record.json",
  tenant_admin_approval: "docs/approvals/phase361/tenant-admin-approval-record.json",
  billing_warning_copy_approval: "docs/approvals/phase361/billing-warning-copy-approval-record.json",
};

const generationAllowed =
  Boolean(instruction) &&
  validation.valid &&
  instruction.codexMayTranscribeApprovalFiles === true &&
  instruction.codexIsApprover === false &&
  (instruction.decision === "approved" || instruction.decision === "approved_with_conditions" || instruction.decision === "rejected");

const generatedApprovalTypes = [];
const skippedApprovalTypes = [];
const blockedApprovalTypes = [];

if (generationAllowed) {
  for (const approvalType of allowedApprovalTypes) {
    if (!instruction.approvedApprovalTypes.includes(approvalType)) {
      skippedApprovalTypes.push(approvalType);
      continue;
    }
    const approval = approvalRecordTemplate(approvalType);
    approval.approvalId = `${instruction.instructionId}-${approvalType}`;
    approval.approvalDecision = instruction.decision;
    approval.approverNameRef = instruction.givenBy;
    approval.approverRole = instruction.givenRole;
    approval.approverOrgRef = instruction.givenOrgRef;
    approval.approvedScope = approval.approvedScope.length ? approval.approvedScope : [];
    approval.approvedScope = approvalScopesByType(approvalType);
    approval.approvalTimestamp = instruction.instructionTimestamp;
    approval.evidenceRefs = instruction.evidenceRefs;
    approval.conditions = instruction.conditions;
    approval.expiration = null;
    approval.revocationPolicy = "human-controlled revocation policy applies";
    approval.auditTrace.humanInstructionRef = instructionPath;
    await writeJson(outputFiles[approvalType], approval);
    generatedApprovalTypes.push(approvalType);
  }
} else {
  blockedApprovalTypes.push(...allowedApprovalTypes);
}

const result = {
  phase: "Phase363B",
  approvalRecordsGenerated: generationAllowed,
  generatedApprovalCount: generatedApprovalTypes.length,
  generatedApprovalTypes,
  skippedApprovalTypes,
  blockedApprovalTypes,
  approvalSource: "explicit_human_instruction",
  codexIsApprover: false,
  approvalForged: false,
  secretValueExposed: false,
  instructionValid: Boolean(instruction && validation.valid),
  instructionDecision: instruction ? instruction.decision : "pending",
  workspaceCleanClaimed: false,
};

await writeJson("docs/phase363b-generated-approval-records-index.json", {
  phase: "Phase363B",
  approvalSource: "explicit_human_instruction",
  codexIsApprover: false,
  generatedApprovalTypes,
  skippedApprovalTypes,
  blockedApprovalTypes,
  instructionRef: instructionPath,
});
await writeText("docs/phase363b-approval-record-generation-report.md", [
  "# Phase363B Approval Record Generation Report",
  "",
  `- generatedApprovalCount: ${result.generatedApprovalCount}`,
  `- skippedApprovalTypes: ${skippedApprovalTypes.join(", ") || "none"}`,
  `- blockedApprovalTypes: ${blockedApprovalTypes.join(", ") || "none"}`,
  "- approvalSource: explicit_human_instruction",
  "- codexIsApprover: false",
].join("\n"));
await writeText("docs/phase363b-execution-report.md", [
  "# Phase363B Execution Report",
  "",
  `- approvalRecordsGenerated: ${generationAllowed}`,
  `- generatedApprovalCount: ${result.generatedApprovalCount}`,
  `- instructionDecision: ${result.instructionDecision}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase363b/approval-record-generation-result.json", result);

console.log(JSON.stringify(result, null, 2));

function approvalScopesByType(approvalType) {
  switch (approvalType) {
    case "human_launch_approval":
      return ["production_launch_authorization_review", "phase360_production_candidate", "phase361_launch_authorization", "phase362_approval_follow_up"];
    case "deploy_authorization":
      return ["deploy_authorization", "release_command_preflight", "production_launch_runbook", "rollback_plan_review"];
    case "god_mode_quality_signoff":
      return ["god_mode_runtime_quality", "god_mode_benchmark_review", "god_mode_conflict_resolution_review", "god_mode_production_candidate_risk"];
    case "tianshu_policy_decision":
      return ["tianshu_planner_policy_review", "tianshu_model_selection_governance", "tianshu_reviewer_workflow", "tianshu_feedback_policy_boundary"];
    case "credential_vault_backend_approval":
      return ["credential_vault_backend", "credential_ref_resolution", "secret_redaction_policy", "vault_access_audit", "credential_revoke_rotation_policy"];
    case "tenant_admin_approval":
      return ["tenant_scope", "allowed_providers", "allowed_models", "quota_budget_policy", "user_owned_provider_boundary", "billing_estimate_only_boundary"];
    case "billing_warning_copy_approval":
      return ["mock_statement_warning_copy", "estimate_only_copy", "not_legal_invoice_copy", "actual_billing_not_connected_copy", "no_tax_or_payment_settlement_copy"];
    default:
      return [];
  }
}
