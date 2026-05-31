import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";

export const repoRoot = resolve(".");
export const approvalsDir = resolve(repoRoot, "docs/approvals/phase361");

export const approvalFiles = {
  human_launch_approval: "human-approval-record.json",
  deploy_authorization: "deploy-authorization-record.json",
  god_mode_quality_signoff: "god-mode-reviewer-quality-signoff.json",
  tianshu_policy_decision: "tianshu-reviewer-decision-record.json",
  credential_vault_backend_approval: "credential-vault-backend-approval-record.json",
  tenant_admin_approval: "tenant-admin-approval-record.json",
  billing_warning_copy_approval: "billing-warning-copy-approval-record.json",
};

export const requiredPhase360Refs = [
  "docs/phase360a-production-candidate-final-signoff-packet.md",
  "docs/phase360a-deploy-not-authorized-boundary.json",
  "docs/phase360abcdef-execution-report.md",
  "apps/ai-gateway-service/evidence/phase360a/production-candidate-final-signoff-result.json",
  "apps/ai-gateway-service/evidence/phase360b/god-mode-production-candidate-signoff-result.json",
  "apps/ai-gateway-service/evidence/phase360c/tianshu-production-candidate-signoff-result.json",
  "apps/ai-gateway-service/evidence/phase360d/credential-vault-production-candidate-signoff-result.json",
  "apps/agent-console/evidence/phase360e/provider-onboarding-production-candidate-signoff-result.json",
  "apps/ai-gateway-service/evidence/phase360f/billing-production-candidate-signoff-result.json",
];

export const secretPatterns = [
  /api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_\-]{12,}/i,
  /secret\s*[:=]\s*["']?[A-Za-z0-9_\-]{12,}/i,
  /token\s*[:=]\s*["']?[A-Za-z0-9_\-]{12,}/i,
  /sk-[A-Za-z0-9]{12,}/i,
];

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

export async function readJsonIfExists(relativePath) {
  if (!(await exists(relativePath))) return null;
  return JSON.parse(await readFile(resolve(repoRoot, relativePath), "utf8"));
}

export async function phase360PrerequisiteCheck() {
  const present = [];
  const missing = [];
  for (const ref of requiredPhase360Refs) {
    if (await exists(ref)) present.push(ref);
    else missing.push(ref);
  }
  const out = {
    phase: "Phase361A-F",
    checkedAt: new Date().toISOString(),
    missing,
    present,
    allowLaunchAuthorizationWorkflow: missing.length === 0,
  };
  await writeJson("docs/phase361abcdef-prerequisite-check.json", out);
  return out;
}

export function approvalSchema() {
  return {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    title: "Phase361 Human Approval Record",
    type: "object",
    required: [
      "approvalId",
      "approvalType",
      "approverNameRef",
      "approverRole",
      "approverOrgRef",
      "approvalDecision",
      "approvedScope",
      "approvalTimestamp",
      "evidenceRefs",
      "conditions",
      "expiration",
      "revocationPolicy",
      "auditTrace",
    ],
    properties: {
      approvalId: { type: "string", minLength: 1 },
      approvalType: { enum: Object.keys(approvalFiles) },
      approverNameRef: { type: "string", minLength: 1 },
      approverRole: { type: "string", minLength: 1 },
      approverOrgRef: { type: "string", minLength: 1 },
      approvalDecision: {
        enum: ["approved", "approved_with_conditions", "rejected", "pending", "revoked"],
      },
      approvedScope: { type: "array", items: { type: "string" }, minItems: 1 },
      approvalTimestamp: { type: "string", minLength: 1 },
      evidenceRefs: { type: "array", items: { type: "string" }, minItems: 1 },
      conditions: { type: "array", items: { type: "string" } },
      expiration: { type: ["string", "null"] },
      revocationPolicy: { type: "string", minLength: 1 },
      auditTrace: { type: "object" },
    },
    additionalProperties: true,
  };
}

export function containsSecretValue(text) {
  return secretPatterns.some((pattern) => pattern.test(text));
}

export function validateApprovalRecord(record, expectedType, requiredScope) {
  const errors = [];
  const required = approvalSchema().required;
  for (const field of required) {
    if (!(field in record)) errors.push(`missing_field:${field}`);
  }
  if (record.approvalType !== expectedType) errors.push(`approval_type_mismatch:${expectedType}`);
  if (!["approved", "approved_with_conditions", "rejected", "pending", "revoked"].includes(record.approvalDecision)) {
    errors.push("invalid_approval_decision");
  }
  if (!Array.isArray(record.approvedScope) || !record.approvedScope.includes(requiredScope)) {
    errors.push(`scope_missing:${requiredScope}`);
  }
  if (!Array.isArray(record.evidenceRefs) || record.evidenceRefs.length === 0) errors.push("missing_evidence_refs");
  if (record.approvalTimestamp && Number.isNaN(Date.parse(record.approvalTimestamp))) {
    errors.push("invalid_approval_timestamp");
  }
  if (record.expiration && !Number.isNaN(Date.parse(record.expiration)) && Date.parse(record.expiration) <= Date.now()) {
    errors.push("approval_expired");
  }
  if (record.approvalDecision === "revoked") errors.push("approval_revoked");
  if (containsSecretValue(JSON.stringify(record))) errors.push("secret_like_value_detected");
  return {
    valid: errors.length === 0,
    accepted: errors.length === 0 && ["approved", "approved_with_conditions"].includes(record.approvalDecision),
    conditional: errors.length === 0 && record.approvalDecision === "approved_with_conditions",
    errors,
  };
}

export async function collectApprovalRecords() {
  const scopes = approvalScopes();
  const collectedApprovals = [];
  const missingApprovals = [];
  const invalidApprovals = [];
  const conditionalApprovals = [];
  for (const [approvalType, fileName] of Object.entries(approvalFiles)) {
    const relativePath = `docs/approvals/phase361/${fileName}`;
    if (!(await exists(relativePath))) {
      missingApprovals.push({ approvalType, recordRef: relativePath, reason: "record_missing" });
      continue;
    }
    const text = await readFile(resolve(repoRoot, relativePath), "utf8");
    if (containsSecretValue(text)) {
      invalidApprovals.push({ approvalType, recordRef: relativePath, reason: "secret_like_value_detected" });
      continue;
    }
    try {
      const record = JSON.parse(text);
      const validation = validateApprovalRecord(record, approvalType, scopes[approvalType]);
      const item = {
        approvalType,
        approvalId: record.approvalId || null,
        approvalDecision: record.approvalDecision || null,
        recordRef: relativePath,
        evidenceRefs: Array.isArray(record.evidenceRefs) ? record.evidenceRefs : [],
        validation,
      };
      if (validation.accepted) collectedApprovals.push(item);
      else invalidApprovals.push({ ...item, reason: validation.errors.join(",") || "not_approved" });
      if (validation.conditional) conditionalApprovals.push(item);
    } catch (error) {
      invalidApprovals.push({ approvalType, recordRef: relativePath, reason: `invalid_json:${error.message}` });
    }
  }
  return {
    collectedApprovals,
    missingApprovals,
    invalidApprovals,
    conditionalApprovals,
  };
}

export function approvalScopes() {
  return {
    human_launch_approval: "production_launch",
    deploy_authorization: "production_deploy",
    god_mode_quality_signoff: "god_mode",
    tianshu_policy_decision: "tianshu_policy",
    credential_vault_backend_approval: "credential_vault",
    tenant_admin_approval: "tenant_admin",
    billing_warning_copy_approval: "billing_warning_copy",
  };
}

export function markdownList(items) {
  if (!items || items.length === 0) return "- none";
  return items.map((item) => `- ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n");
}
