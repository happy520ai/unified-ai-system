import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { exists, writeJson, writeText } from "../phase362-common.mjs";

const repoRoot = resolve(".");
const draftDir = "docs/approvals/phase361/drafts";
const readyDir = "docs/approvals/phase361/ready-for-human-review";
const approvalsDir = "docs/approvals/phase361";

const draftSpecs = [
  {
    file: "human-approval-record.draft.json",
    approvalType: "human_launch_approval",
    scope: [
      "production_launch_authorization_review",
      "phase360_production_candidate",
      "phase361_launch_authorization",
      "phase362_approval_follow_up",
    ],
    evidenceRefs: commonEvidenceRefs(),
    humanInstructions: [
      "Open this draft and fill only by a human reviewer.",
      "Set approvalId, approver fields, scope, decision, timestamp, and conditions with real values.",
      "Remove or set draftOnly/notAnApproval/requiresHumanCompletion to false before promoting.",
      "Copy the completed file to docs/approvals/phase361/human-approval-record.json.",
    ],
  },
  {
    file: "deploy-authorization-record.draft.json",
    approvalType: "deploy_authorization",
    scope: [
      "deploy_authorization",
      "release_command_preflight",
      "production_launch_runbook",
      "rollback_plan_review",
    ],
    evidenceRefs: commonEvidenceRefs(),
    humanInstructions: [
      "This draft is the only future path to deployAuthorized=true, but it is not authorization now.",
      "Fill with real sign-off only and promote manually.",
      "Copy the completed file to docs/approvals/phase361/deploy-authorization-record.json.",
    ],
  },
  {
    file: "god-mode-reviewer-quality-signoff.draft.json",
    approvalType: "god_mode_quality_signoff",
    scope: [
      "god_mode_runtime_quality",
      "god_mode_benchmark_review",
      "god_mode_conflict_resolution_review",
      "god_mode_production_candidate_risk",
    ],
    evidenceRefs: [
      "docs/phase360b-god-mode-production-candidate-signoff.md",
      "apps/ai-gateway-service/evidence/phase360b/god-mode-production-candidate-signoff-result.json",
      ...commonEvidenceRefs(),
    ],
    humanInstructions: [
      "Use only real reviewer judgment and evidence.",
      "Do not write approved unless the human actually approved.",
      "Copy the completed file to docs/approvals/phase361/god-mode-reviewer-quality-signoff.json.",
    ],
  },
  {
    file: "tianshu-reviewer-decision-record.draft.json",
    approvalType: "tianshu_policy_decision",
    scope: [
      "tianshu_planner_policy_review",
      "tianshu_model_selection_governance",
      "tianshu_reviewer_workflow",
      "tianshu_feedback_policy_boundary",
    ],
    evidenceRefs: [
      "docs/phase360c-tianshu-production-candidate-signoff.md",
      "apps/ai-gateway-service/evidence/phase360c/tianshu-production-candidate-signoff-result.json",
      ...commonEvidenceRefs(),
    ],
    humanInstructions: [
      "Use real policy review notes only.",
      "Keep approvalDecision pending until a human fills it.",
      "Copy the completed file to docs/approvals/phase361/tianshu-reviewer-decision-record.json.",
    ],
  },
  {
    file: "credential-vault-backend-approval-record.draft.json",
    approvalType: "credential_vault_backend_approval",
    scope: [
      "credential_vault_backend",
      "credential_ref_resolution",
      "secret_redaction_policy",
      "vault_access_audit",
      "credential_revoke_rotation_policy",
    ],
    evidenceRefs: [
      "docs/phase360d-credential-vault-production-candidate-signoff.md",
      "apps/ai-gateway-service/evidence/phase360d/credential-vault-production-candidate-signoff-result.json",
      "docs/phase362d-vault-approval-follow-up-report.md",
      ...commonEvidenceRefs(),
    ],
    humanInstructions: [
      "Do not include API keys, .env values, or raw secrets.",
      "Use only redacted evidence refs.",
      "Copy the completed file to docs/approvals/phase361/credential-vault-backend-approval-record.json.",
    ],
  },
  {
    file: "tenant-admin-approval-record.draft.json",
    approvalType: "tenant_admin_approval",
    scope: [
      "tenant_scope",
      "allowed_providers",
      "allowed_models",
      "quota_budget_policy",
      "user_owned_provider_boundary",
      "billing_estimate_only_boundary",
    ],
    evidenceRefs: [
      "docs/phase360e-provider-onboarding-production-candidate-signoff.md",
      "apps/agent-console/evidence/phase360e/provider-onboarding-production-candidate-signoff-result.json",
      "docs/phase362c-tenant-admin-follow-up-report.md",
      ...commonEvidenceRefs(),
    ],
    humanInstructions: [
      "Keep the scope limited to tenant/admin approval only.",
      "Do not imply deploy or release approval.",
      "Copy the completed file to docs/approvals/phase361/tenant-admin-approval-record.json.",
    ],
  },
  {
    file: "billing-warning-copy-approval-record.draft.json",
    approvalType: "billing_warning_copy_approval",
    scope: [
      "mock_statement_warning_copy",
      "estimate_only_copy",
      "not_legal_invoice_copy",
      "actual_billing_not_connected_copy",
      "no_tax_or_payment_settlement_copy",
    ],
    evidenceRefs: [
      "docs/phase360f-billing-production-candidate-signoff.md",
      "apps/ai-gateway-service/evidence/phase360f/billing-production-candidate-signoff-result.json",
      "docs/phase362e-billing-warning-copy-follow-up-report.md",
      ...commonEvidenceRefs(),
    ],
    humanInstructions: [
      "Preserve the warning labels exactly.",
      "Do not turn this into a billing approval or invoice.",
      "Copy the completed file to docs/approvals/phase361/billing-warning-copy-approval-record.json.",
    ],
  },
];

await mkdir(resolve(repoRoot, draftDir), { recursive: true });
await mkdir(resolve(repoRoot, readyDir), { recursive: true });
await mkdir(resolve(repoRoot, approvalsDir), { recursive: true });

const drafts = draftSpecs.map((spec) => ({
  draftOnly: true,
  notAnApproval: true,
  requiresHumanCompletion: true,
  approvalId: null,
  approvalType: spec.approvalType,
  approvalDecision: "pending",
  approverNameRef: "",
  approverRole: "",
  approverOrgRef: "",
  approvedScope: spec.scope,
  approvalTimestamp: null,
  evidenceRefs: spec.evidenceRefs,
  conditions: [],
  expiration: null,
  revocationPolicy: "",
  humanInstructions: spec.humanInstructions,
  auditTrace: {
    createdBy: "codex",
    source: "approval_draft_preparation",
    secretValueIncluded: false,
    forged: false,
    draftOnly: true,
  },
}));

for (let i = 0; i < draftSpecs.length; i += 1) {
  const spec = draftSpecs[i];
  await writeJson(`${draftDir}/${spec.file}`, drafts[i]);
}

await writeText("docs/approvals/phase361/REAL_APPROVAL_FILLING_GUIDE.md", [
  "# Real Approval Filling Guide",
  "",
  "1. Open the draft file in `docs/approvals/phase361/drafts/`.",
  "2. Fill `approvalId`, `approvalDecision`, `approverNameRef`, `approverRole`, `approverOrgRef`, `approvalTimestamp`, `approvedScope`, `conditions`, `expiration`, and `revocationPolicy` with real human-entered values.",
  "3. Remove `draftOnly`, `notAnApproval`, and `requiresHumanCompletion`, or set them to `false` before promotion.",
  "4. Copy the completed file into `docs/approvals/phase361/` with the matching non-draft filename.",
  "5. Run the validation and Phase361 verifiers again.",
].join("\n"));
await writeText("docs/approvals/phase361/APPROVAL_EVIDENCE_REFERENCE_INDEX.md", [
  "# Approval Evidence Reference Index",
  "",
  ...draftSpecs.map((spec) => `- ${spec.approvalType}: ${spec.evidenceRefs[0]}`),
].join("\n"));
await writeText("docs/approvals/phase361/APPROVAL_SAFETY_RULES.md", [
  "# Approval Safety Rules",
  "",
  "- Draft files are not approvals.",
  "- `approvalDecision` must stay `pending` in drafts.",
  "- No secret, key, token, or .env value may appear in drafts.",
  "- No `approved` or `approved_with_conditions` values are allowed in drafts.",
].join("\n"));
await writeText("docs/approvals/phase361/APPROVAL_PROMOTION_STEPS.md", [
  "# Approval Promotion Steps",
  "",
  "1. Human reviews the draft.",
  "2. Human fills the required fields.",
  "3. Human removes or false-flips draft markers.",
  "4. Human copies the file into the formal approval path.",
  "5. Validation is rerun before any downstream verifier is trusted.",
].join("\n"));
await writeText("docs/phase363a-pre-approval-draft-preparation-report.md", [
  "# Phase363A-pre Approval Draft Preparation Report",
  "",
  `- draftCount: ${drafts.length}`,
  "- approvalDecision: pending",
  "- draftOnly: true",
  "- notAnApproval: true",
  "- requiresHumanCompletion: true",
  "- secretValueIncluded: false",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase363a-pre/approval-draft-preparation-result.json", {
  phase: "Phase363A-pre",
  draftCount: drafts.length,
  draftOnly: true,
  notAnApproval: true,
  requiresHumanCompletion: true,
  approvalDecision: "pending",
  realApprovalCreated: false,
  secretValueIncluded: false,
  forged: false,
  workspaceCleanClaimed: false,
});

console.log(JSON.stringify({ phase: "Phase363A-pre", draftCount: drafts.length, realApprovalCreated: false }, null, 2));

function commonEvidenceRefs() {
  return [
    "docs/phase360a-production-candidate-final-signoff-packet.md",
    "docs/phase360a-deploy-not-authorized-boundary.json",
    "docs/phase360abcdef-execution-report.md",
    "docs/phase361a-launch-authorization-state.json",
    "docs/phase361b-human-approval-records-index.json",
    "docs/phase361c-deploy-authorization-state.json",
    "docs/phase361d-signoff-verification-report.md",
    "docs/phase361f-go-no-go-decision-state.json",
    "docs/phase362a-reviewer-follow-up-tracker.json",
    "docs/phase362a-approval-evidence-intake-report.md",
  ];
}
