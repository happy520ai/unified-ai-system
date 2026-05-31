const fs = require("node:fs");
const path = require("node:path");

const instructionPath = "docs/approvals/phase363/explicit-human-approval-instruction.json";

const approvalFiles = [
  "docs/approvals/phase361/human-approval-record.json",
  "docs/approvals/phase361/deploy-authorization-record.json",
  "docs/approvals/phase361/god-mode-reviewer-quality-signoff.json",
  "docs/approvals/phase361/tianshu-reviewer-decision-record.json",
  "docs/approvals/phase361/credential-vault-backend-approval-record.json",
  "docs/approvals/phase361/tenant-admin-approval-record.json",
  "docs/approvals/phase361/billing-warning-copy-approval-record.json"
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function removeDraftMarkers(obj) {
  if (!obj || typeof obj !== "object") return;

  delete obj.draftOnly;
  delete obj.notAnApproval;
  delete obj.requiresHumanCompletion;
  delete obj.templateOnly;
  delete obj.notDecisionRecord;
  delete obj.notAuthorization;
  delete obj.humanInstructions;

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) removeDraftMarkers(item);
    } else if (value && typeof value === "object") {
      removeDraftMarkers(value);
    }
  }
}

if (!fs.existsSync(instructionPath)) {
  throw new Error(`Missing instruction file: ${instructionPath}`);
}

const instruction = readJson(instructionPath);

if (instruction.codexMayTranscribeApprovalFiles !== true) {
  throw new Error("codexMayTranscribeApprovalFiles must be true.");
}

if (instruction.codexIsApprover !== false) {
  throw new Error("codexIsApprover must be false.");
}

if (!["approved", "approved_with_conditions"].includes(instruction.decision)) {
  throw new Error("instruction decision must be approved or approved_with_conditions.");
}

for (const file of approvalFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing approval record: ${file}`);
  }

  const record = readJson(file);

  if (!instruction.approvedApprovalTypes.includes(record.approvalType)) {
    throw new Error(`${file}: approvalType not covered by explicit human instruction.`);
  }

  if (record.approvalDecision !== instruction.decision) {
    throw new Error(`${file}: approvalDecision does not match explicit human instruction.`);
  }

  const backup = `${file}.backup.${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}.json`;
  fs.copyFileSync(file, backup);

  removeDraftMarkers(record);

  record.auditTrace = record.auditTrace || {};
  record.auditTrace.createdBy = record.auditTrace.createdBy || "codex";
  record.auditTrace.recordedBy = "codex";
  record.auditTrace.approvalSource = "explicit_human_instruction";
  record.auditTrace.humanInstructionRef = instructionPath;
  record.auditTrace.codexIsApprover = false;
  record.auditTrace.secretValueIncluded = false;
  record.auditTrace.forged = false;
  record.auditTrace.draftMarkerRemovedAfterHumanInstruction = true;
  record.auditTrace.draftMarkerRemovalReason = "Phase363C reported DRAFT_MARKER_PERSISTED after explicit human instruction transcription.";

  writeJson(file, record);
  console.log(`cleaned: ${file}`);
}

console.log("phase363 approval draft markers cleaned");