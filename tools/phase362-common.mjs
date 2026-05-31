import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { approvalFiles, collectApprovalRecords, markdownList } from "./phase361-common.mjs";

export const repoRoot = resolve(".");

export const phase362RequiredRefs = [
  "docs/phase361abcdef-prerequisite-check.json",
  "docs/phase361a-launch-authorization-state.json",
  "docs/phase361b-human-approval-records-index.json",
  "docs/phase361b-human-approval-missing-records.md",
  "docs/phase361c-deploy-authorization-state.json",
  "docs/phase361d-signoff-verification-report.md",
  "docs/phase361d-missing-signoffs.md",
  "docs/phase361f-go-no-go-decision-state.json",
  "docs/phase361f-go-no-go-evidence-index.json",
  "docs/phase361abcdef-execution-report.md",
  "apps/ai-gateway-service/evidence/phase361a/production-launch-authorization-workflow-result.json",
  "apps/ai-gateway-service/evidence/phase361b/human-approval-record-collection-result.json",
  "apps/ai-gateway-service/evidence/phase361c/deploy-authorization-packet-result.json",
  "apps/ai-gateway-service/evidence/phase361d/tenant-admin-reviewer-signoff-verification-result.json",
  "apps/ai-gateway-service/evidence/phase361e/production-release-runbook-finalization-result.json",
  "apps/ai-gateway-service/evidence/phase361f/go-no-go-meeting-evidence-package-result.json",
];

export const approvalMeta = {
  human_launch_approval: {
    ownerRole: "launch owner",
    requestedFrom: "human approver",
    requiredEvidence: ["signed launch approval", "approved scope", "audit trace"],
    templateName: "human-launch-approval.template.json",
    collectedRecordPath: "docs/approvals/phase361/human-approval-record.json",
  },
  deploy_authorization: {
    ownerRole: "deploy owner",
    requestedFrom: "deployment approver",
    requiredEvidence: ["signed deploy authorization", "scope", "rollback acknowledgement"],
    templateName: "deploy-authorization.template.json",
    collectedRecordPath: "docs/approvals/phase361/deploy-authorization-record.json",
  },
  god_mode_quality_signoff: {
    ownerRole: "God Mode reviewer",
    requestedFrom: "quality reviewer",
    requiredEvidence: ["reviewer quality signoff", "benchmark evidence reference"],
    templateName: "god-mode-quality-signoff.template.json",
    collectedRecordPath: "docs/approvals/phase361/god-mode-reviewer-quality-signoff.json",
  },
  tianshu_policy_decision: {
    ownerRole: "Tianshu reviewer",
    requestedFrom: "policy reviewer",
    requiredEvidence: ["policy proposal id", "reviewer decision record"],
    templateName: "tianshu-policy-decision.template.json",
    collectedRecordPath: "docs/approvals/phase361/tianshu-reviewer-decision-record.json",
  },
  credential_vault_backend_approval: {
    ownerRole: "credential vault owner",
    requestedFrom: "vault approver",
    requiredEvidence: ["credentialRef", "access decision", "vault backend approval"],
    templateName: "credential-vault-backend-approval.template.json",
    collectedRecordPath: "docs/approvals/phase361/credential-vault-backend-approval-record.json",
  },
  tenant_admin_approval: {
    ownerRole: "tenant admin",
    requestedFrom: "tenant administrator",
    requiredEvidence: ["tenant admin approval", "reviewer checklist id"],
    templateName: "tenant-admin-approval.template.json",
    collectedRecordPath: "docs/approvals/phase361/tenant-admin-approval-record.json",
  },
  billing_warning_copy_approval: {
    ownerRole: "billing reviewer",
    requestedFrom: "billing warning copy approver",
    requiredEvidence: ["statement id", "warning copy approval record"],
    templateName: "billing-warning-copy-approval.template.json",
    collectedRecordPath: "docs/approvals/phase361/billing-warning-copy-approval-record.json",
  },
};

export async function exists(relativePath) {
  try {
    await access(resolve(repoRoot, relativePath), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function writeJson(relativePath, value) {
  const target = resolve(repoRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(relativePath, value) {
  const target = resolve(repoRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

export async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(repoRoot, relativePath), "utf8"));
}

export async function phase362PrerequisiteCheck() {
  const present = [];
  const missing = [];
  for (const ref of phase362RequiredRefs) {
    if (await exists(ref)) present.push(ref);
    else missing.push(ref);
  }
  const out = {
    phase: "Phase362A-F",
    checkedAt: new Date().toISOString(),
    missing,
    present,
    allowApprovalFollowUp: missing.length === 0,
  };
  await writeJson("docs/phase362abcdef-prerequisite-check.json", out);
  return out;
}

export function intakeSchema() {
  return {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    title: "Phase362 Approval Evidence Intake",
    type: "object",
    required: [
      "templateOnly",
      "notAnApproval",
      "approvalId",
      "approvalType",
      "approvalDecision",
      "approverNameRef",
      "approverRole",
      "approvedScope",
      "approvalTimestamp",
      "evidenceRefs",
      "conditions",
      "expiration",
      "revocationPolicy",
      "auditTrace",
    ],
    properties: {
      templateOnly: { const: true },
      notAnApproval: { const: true },
      approvalId: { type: ["string", "null"] },
      approvalType: { enum: Object.keys(approvalFiles) },
      approvalDecision: { enum: ["pending"] },
      approverNameRef: { type: "string" },
      approverRole: { type: "string" },
      approvedScope: { type: "array" },
      approvalTimestamp: { type: ["string", "null"] },
      evidenceRefs: { type: "array" },
      conditions: { type: "array" },
      expiration: { type: ["string", "null"] },
      revocationPolicy: { type: "string" },
      auditTrace: { type: "object" },
    },
  };
}

export function templateFor(approvalType) {
  return {
    templateOnly: true,
    notAnApproval: true,
    approvalId: null,
    approvalType,
    approvalDecision: "pending",
    approverNameRef: "",
    approverRole: approvalMeta[approvalType].ownerRole,
    approverOrgRef: "",
    approvedScope: [],
    approvalTimestamp: null,
    evidenceRefs: [],
    conditions: [],
    expiration: null,
    revocationPolicy: "",
    auditTrace: {},
  };
}

export async function trackerItems() {
  const approvals = await collectApprovalRecords();
  const collectedByType = new Map(approvals.collectedApprovals.map((item) => [item.approvalType, item]));
  const invalidByType = new Map(approvals.invalidApprovals.map((item) => [item.approvalType, item]));
  const items = Object.keys(approvalFiles).map((approvalType) => {
    const meta = approvalMeta[approvalType];
    const collected = collectedByType.get(approvalType);
    const invalid = invalidByType.get(approvalType);
    const status = collected ? "valid" : invalid ? "invalid" : "missing";
    return {
      approvalType,
      ownerRole: meta.ownerRole,
      requestedFrom: meta.requestedFrom,
      status,
      dueDate: null,
      blocker: status === "valid" ? null : approvalType,
      requiredEvidence: meta.requiredEvidence,
      sourceBlockerFromPhase361: approvalType,
      templatePath: `docs/approvals/phase362/templates/${meta.templateName}`,
      collectedRecordPath: meta.collectedRecordPath,
      validationStatus: collected ? "valid_real_record" : invalid ? "invalid_real_record" : "missing_real_record",
      nextAction: collected ? "review_conditions_if_any" : "request_real_signed_record",
    };
  });
  return { items, approvals };
}

export function mdSection(title, items) {
  return [`## ${title}`, markdownList(items), ""].join("\n");
}
