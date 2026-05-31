import { exists, instructionPath, readJsonIfExists, validateInstruction, writeJson, writeText } from "../phase363-common.mjs";

const approvalTypes = [
  "human_launch_approval",
  "deploy_authorization",
  "god_mode_quality_signoff",
  "tianshu_policy_decision",
  "credential_vault_backend_approval",
  "tenant_admin_approval",
  "billing_warning_copy_approval",
];

const instruction = await readJsonIfExists(instructionPath);
const instructionValidation = instruction ? validateInstruction(instruction) : { valid: false, validationErrors: ["EXPLICIT_HUMAN_INSTRUCTION_MISSING_OR_INVALID"] };
const findings = [];
let validApprovalRecords = 0;

for (const approvalType of approvalTypes) {
  const filePath = `docs/approvals/phase361/${approvalTypeToFile(approvalType)}`;
  const record = await readJsonIfExists(filePath);
  const localFindings = [];
  if (!record) {
    findings.push({ approvalType, code: "APPROVAL_RECORD_MISSING" });
    continue;
  }
  if (record.auditTrace?.approvalSource !== "explicit_human_instruction") localFindings.push({ approvalType, code: "APPROVAL_SOURCE_INVALID" });
  if (record.auditTrace?.codexIsApprover !== false) localFindings.push({ approvalType, code: "CODEX_AS_APPROVER_DETECTED" });
  if (!record.auditTrace?.humanInstructionRef || !(await exists(record.auditTrace.humanInstructionRef))) localFindings.push({ approvalType, code: "HUMAN_INSTRUCTION_REF_INVALID" });
  if (record.auditTrace?.forged !== false) localFindings.push({ approvalType, code: "APPROVAL_FORGED" });
  if (!instruction || !instructionValidation.valid) localFindings.push({ approvalType, code: "INSTRUCTION_MISSING_OR_INVALID" });
  if (instruction && record.approvalDecision !== instruction.decision) localFindings.push({ approvalType, code: "DECISION_MISMATCH" });
  if (instruction && record.approverNameRef !== instruction.givenBy) localFindings.push({ approvalType, code: "APPROVER_NAME_MISMATCH" });
  if (instruction && record.approverRole !== instruction.givenRole) localFindings.push({ approvalType, code: "APPROVER_ROLE_MISMATCH" });
  if (instruction && record.approvalTimestamp !== instruction.instructionTimestamp) localFindings.push({ approvalType, code: "TIMESTAMP_MISMATCH" });
  if (instruction && JSON.stringify(record.conditions) !== JSON.stringify(instruction.conditions)) localFindings.push({ approvalType, code: "CONDITIONS_MISMATCH" });
  if (instruction && (!Array.isArray(record.evidenceRefs) || !instruction.evidenceRefs.every((ref) => record.evidenceRefs.includes(ref)))) localFindings.push({ approvalType, code: "EVIDENCE_MISMATCH" });
  if (containsSecretLikeText(record)) localFindings.push({ approvalType, code: "SECRET_VALUE_EXPOSED" });
  if (record.draftOnly === true || record.notAnApproval === true) localFindings.push({ approvalType, code: "DRAFT_MARKER_PERSISTED" });
  if (localFindings.length === 0) validApprovalRecords += 1;
  findings.push(...localFindings);
}

const result = {
  phase: "Phase363C",
  auditExecuted: true,
  approvalRecordsAudited: approvalTypes.length,
  validApprovalRecords: validApprovalRecords,
  invalidApprovalRecords: findings.length,
  sourceVerified: findings.length === 0,
  approvalForged: findings.some((item) => item.code === "APPROVAL_FORGED"),
  codexAsApproverDetected: findings.some((item) => item.code === "CODEX_AS_APPROVER_DETECTED"),
  secretValueExposed: findings.some((item) => item.code === "SECRET_VALUE_EXPOSED"),
  findings,
  workspaceCleanClaimed: false,
};

await writeJson("docs/phase363c-approval-source-audit-rules.json", {
  phase: "Phase363C",
  approvalTypes,
  instructionRef: instructionPath,
  requiredApprovalSource: "explicit_human_instruction",
  codexIsApprover: false,
});
await writeText("docs/phase363c-approval-source-audit-report.md", [
  "# Phase363C Approval Source Audit Report",
  "",
  `- sourceVerified: ${result.sourceVerified}`,
  `- validApprovalRecords: ${result.validApprovalRecords}`,
  `- invalidApprovalRecords: ${result.invalidApprovalRecords}`,
  `- codexAsApproverDetected: ${result.codexAsApproverDetected}`,
].join("\n"));
await writeText("docs/phase363c-execution-report.md", [
  "# Phase363C Execution Report",
  "",
  "- audit executed",
  `- sourceVerified: ${result.sourceVerified}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase363c/approval-source-audit-verification-result.json", result);

console.log(JSON.stringify(result, null, 2));

function approvalTypeToFile(approvalType) {
  switch (approvalType) {
    case "human_launch_approval":
      return "human-approval-record.json";
    case "deploy_authorization":
      return "deploy-authorization-record.json";
    case "god_mode_quality_signoff":
      return "god-mode-reviewer-quality-signoff.json";
    case "tianshu_policy_decision":
      return "tianshu-reviewer-decision-record.json";
    case "credential_vault_backend_approval":
      return "credential-vault-backend-approval-record.json";
    case "tenant_admin_approval":
      return "tenant-admin-approval-record.json";
    case "billing_warning_copy_approval":
      return "billing-warning-copy-approval-record.json";
    default:
      return `${approvalType}.json`;
  }
}

function containsSecretLikeText(value) {
  const texts = collectStringValues(value);
  return texts.some((text) =>
    [
      /api[_-]?key\s*[:=]/i,
      /\.env\s*[:=]/i,
      /sk-[A-Za-z0-9]{12,}/i,
      /secret\s*[:=]/i,
      /token\s*[:=]/i,
    ].some((pattern) => pattern.test(text)),
  );
}

function collectStringValues(value, acc = []) {
  if (typeof value === "string") {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStringValues(item, acc);
  }
  return acc;
}
