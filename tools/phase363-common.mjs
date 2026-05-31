import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";

export const repoRoot = resolve(".");
export const phase363Dir = "docs/approvals/phase363";
export const instructionPath = `${phase363Dir}/explicit-human-approval-instruction.json`;
export const instructionTemplatePath = `${phase363Dir}/explicit-human-approval-instruction.template.json`;

export const allowedApprovalTypes = [
  "human_launch_approval",
  "deploy_authorization",
  "god_mode_quality_signoff",
  "tianshu_policy_decision",
  "credential_vault_backend_approval",
  "tenant_admin_approval",
  "billing_warning_copy_approval",
];

export async function exists(relativePath) {
  try {
    await access(resolve(repoRoot, relativePath), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonIfExists(relativePath) {
  if (!(await exists(relativePath))) return null;
  return JSON.parse(await readFile(resolve(repoRoot, relativePath), "utf8"));
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

export function collectStringValues(value, acc = []) {
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

export function containsSecretLikeText(value) {
  return collectStringValues(value).some((text) =>
    [
      /api[_-]?key\s*[:=]/i,
      /\.env\s*[:=]/i,
      /sk-[A-Za-z0-9]{12,}/i,
      /secret\s*[:=]/i,
      /token\s*[:=]/i,
    ].some((pattern) => pattern.test(text)),
  );
}

export function instructionSchema() {
  return {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    title: "Explicit Human Approval Instruction",
    type: "object",
    required: [
      "instructionType",
      "instructionId",
      "givenBy",
      "givenRole",
      "givenOrgRef",
      "decision",
      "approvedApprovalTypes",
      "conditions",
      "instructionTimestamp",
      "evidenceRefs",
      "codexMayTranscribeApprovalFiles",
      "codexIsApprover",
      "approvalRecordOutputDirectory",
      "safety",
    ],
    properties: {
      instructionType: { const: "explicit_human_launch_approval_instruction" },
      instructionId: { type: "string", minLength: 1 },
      givenBy: { type: "string", minLength: 1 },
      givenRole: { type: "string", minLength: 1 },
      givenOrgRef: { type: "string", minLength: 1 },
      decision: { enum: ["approved", "approved_with_conditions", "rejected", "pending"] },
      approvedApprovalTypes: { type: "array", items: { enum: allowedApprovalTypes }, uniqueItems: true },
      conditions: { type: "array", items: { type: "string" } },
      instructionTimestamp: { type: "string", minLength: 1 },
      evidenceRefs: { type: "array", items: { type: "string" }, minItems: 1 },
      codexMayTranscribeApprovalFiles: { type: "boolean" },
      codexIsApprover: { type: "boolean" },
      approvalRecordOutputDirectory: { const: "docs/approvals/phase361" },
      safety: {
        type: "object",
        required: ["secretValueIncluded", "apiKeyIncluded", "deployExecuted", "releaseExecuted", "tagCreated", "artifactUploaded"],
        properties: {
          secretValueIncluded: { const: false },
          apiKeyIncluded: { const: false },
          deployExecuted: { const: false },
          releaseExecuted: { const: false },
          tagCreated: { const: false },
          artifactUploaded: { const: false },
        },
      },
    },
  };
}

export function approvalRecordTemplate(approvalType) {
  return {
    draftOnly: true,
    notAnApproval: true,
    requiresHumanCompletion: true,
    approvalId: null,
    approvalType,
    approvalDecision: "pending",
    approverNameRef: "",
    approverRole: "",
    approverOrgRef: "",
    approvedScope: [],
    approvalTimestamp: null,
    evidenceRefs: [],
    conditions: [],
    expiration: null,
    revocationPolicy: "",
    auditTrace: {
      createdBy: "codex",
      recordedBy: "codex",
      approvalSource: "explicit_human_instruction",
      humanInstructionRef: "docs/approvals/phase363/explicit-human-approval-instruction.json",
      codexIsApprover: false,
      secretValueIncluded: false,
      forged: false,
    },
  };
}

export function instructionTemplate() {
  return {
    instructionType: "explicit_human_launch_approval_instruction",
    instructionId: "human-instruction-20260507-001",
    givenBy: "",
    givenRole: "",
    givenOrgRef: "",
    decision: "pending",
    approvedApprovalTypes: [],
    conditions: [],
    instructionTimestamp: "",
    evidenceRefs: [],
    codexMayTranscribeApprovalFiles: true,
    codexIsApprover: false,
    approvalRecordOutputDirectory: "docs/approvals/phase361",
    safety: {
      secretValueIncluded: false,
      apiKeyIncluded: false,
      deployExecuted: false,
      releaseExecuted: false,
      tagCreated: false,
      artifactUploaded: false,
    },
  };
}

export function validateInstruction(instruction) {
  const missingFields = [];
  for (const field of [
    "instructionType",
    "instructionId",
    "givenBy",
    "givenRole",
    "givenOrgRef",
    "decision",
    "approvedApprovalTypes",
    "conditions",
    "instructionTimestamp",
    "evidenceRefs",
    "codexMayTranscribeApprovalFiles",
    "codexIsApprover",
    "approvalRecordOutputDirectory",
    "safety",
  ]) {
    if (!(field in instruction)) missingFields.push(field);
  }
  const validationErrors = [];
  if (instruction.instructionType !== "explicit_human_launch_approval_instruction") validationErrors.push("INSTRUCTION_TYPE_INVALID");
  if (!instruction.givenBy || !instruction.givenRole || !instruction.givenOrgRef) validationErrors.push("HUMAN_IDENTITY_MISSING");
  if (!["approved", "approved_with_conditions", "rejected", "pending"].includes(instruction.decision)) validationErrors.push("DECISION_INVALID");
  if (instruction.codexMayTranscribeApprovalFiles !== true) validationErrors.push("CODEX_TRANSCRIPTION_NOT_ALLOWED");
  if (instruction.codexIsApprover !== false) validationErrors.push("CODEX_IS_APPROVER_TRUE");
  if (!instruction.instructionTimestamp) validationErrors.push("TIMESTAMP_MISSING");
  if (!Array.isArray(instruction.evidenceRefs) || instruction.evidenceRefs.length === 0) validationErrors.push("EVIDENCE_REFS_MISSING");
  if (!Array.isArray(instruction.approvedApprovalTypes) || instruction.approvedApprovalTypes.some((type) => !allowedApprovalTypes.includes(type))) validationErrors.push("APPROVAL_TYPE_NOT_ALLOWED");
  if (!instruction.safety || instruction.safety.secretValueIncluded !== false || instruction.safety.apiKeyIncluded !== false) validationErrors.push("SAFETY_NOT_SET");
  if (containsSecretLikeText(instruction)) validationErrors.push("SECRET_VALUE_INCLUDED");
  return { missingFields, validationErrors, valid: missingFields.length === 0 && validationErrors.length === 0 };
}
