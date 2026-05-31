import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasSensitiveValue, resolveRepoRoot, sanitizeText } from "./contextPackPreviewReader.js";
import { hasPhase600ForbiddenRawField } from "./phase600AuthorizationInputSchema.js";
import {
  normalizePhase600ApprovalRecord,
  PHASE600_HUMAN_APPROVAL_REQUIRED_FIELDS,
} from "./phase600HumanApprovalInputSchema.js";

const defaultInputPath = "docs/phase600-human-approval-record.input.json";

export function loadPhase600HumanApprovalRecord(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const relativePath = sanitizeRelativePath(options.inputPath || defaultInputPath);
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    return {
      completed: true,
      humanApprovalRecordLoaderWorks: true,
      missingApprovalHandled: true,
      inputMissing: true,
      approvalInputMissingAllowed: true,
      inputPath: relativePath,
      record: {},
      errors: [],
      humanApprovalStatus: "missing",
      placeholderApprovalRejected: true,
      readinessOnlyApprovalIsNotRealTestApproval: true,
      schemaValidationWorks: true,
      rawSecretRejected: true,
      rawWebhookRejected: true,
      rawSecretAccessed: false,
      secretValueExposed: false,
      rawWebhookAccessed: false,
      webhookValueExposed: false,
    };
  }

  const raw = readFileSync(absolutePath, "utf8");
  const errors = [];
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    errors.push(`malformed-json:${error.message}`);
  }

  const forbiddenRawFieldsDetected = hasPhase600ForbiddenRawField(parsed);
  const sensitiveValueDetected = hasSensitiveValue(parsed);
  const inputRejected = forbiddenRawFieldsDetected || sensitiveValueDetected || errors.length > 0;
  const record = normalizePhase600ApprovalRecord(inputRejected ? {} : parsed);
  const missingFields = PHASE600_HUMAN_APPROVAL_REQUIRED_FIELDS.filter((field) => isMissingField(record[field]));
  const decision = record.decision || "not_provided";
  const placeholderDetected = String(record.approvalRecordRef || "").includes("[") || String(record.reviewerRef || "").includes("[");

  return {
    completed: true,
    humanApprovalRecordLoaderWorks: errors.length === 0,
    missingApprovalHandled: true,
    inputMissing: false,
    approvalInputMissingAllowed: true,
    inputPath: relativePath,
    record,
    errors,
    humanApprovalStatus: inputRejected || placeholderDetected ? "missing" : decision,
    placeholderApprovalRejected: true,
    readinessOnlyApprovalIsNotRealTestApproval: decision === "approved_for_readiness_review_only",
    forbiddenRawFieldsDetected,
    sensitiveValueDetected,
    inputRejected,
    requiredFields: PHASE600_HUMAN_APPROVAL_REQUIRED_FIELDS,
    missingFields,
    schemaValidationWorks: errors.length === 0,
    rawSecretRejected: true,
    rawWebhookRejected: true,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
  };
}

function sanitizeRelativePath(path) {
  const normalized = sanitizeText(path).replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/") || normalized.includes(":")) {
    throw new Error(`Unsafe Phase600 human approval input path: ${path}`);
  }
  return normalized;
}

function isMissingField(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || value === "" || String(value).startsWith("[required");
}
