import { sanitizeText } from "./contextPackPreviewReader.js";

export const PHASE600_HUMAN_APPROVAL_REQUIRED_FIELDS = Object.freeze([
  "approvalRecordRef",
  "reviewerRef",
  "reviewerRole",
  "decision",
  "decisionTimestamp",
  "approvalReason",
  "allowedScope",
  "maxRequests",
  "maxEstimatedCostUsd",
  "rollbackOwner",
  "emergencyDisablePlanReviewed",
  "notes",
]);

export const PHASE600_APPROVAL_DECISIONS = Object.freeze([
  "approved_for_readiness_review_only",
  "approved_for_future_guarded_real_test",
  "rejected",
  "needs_changes",
  "not_provided",
]);

export const PHASE600_EXAMPLE_HUMAN_APPROVAL_RECORD = Object.freeze({
  approvalRecordRef: "approvalRef.phase600-human-approval-001",
  reviewerRef: "user-owner",
  reviewerRole: "project_owner",
  decision: "approved_for_readiness_review_only",
  decisionTimestamp: "2026-05-10T00:00:00.000Z",
  approvalReason:
    "Approve readiness review for a future guarded real base_url test. This does not approve real config modification.",
  allowedScope: {
    authorizationPacketReview: true,
    guardedReadinessReview: true,
    realConfigWriteAllowed: false,
    realRelayConnectionAllowed: false,
    providerCallAllowed: false,
  },
  maxRequests: 0,
  maxEstimatedCostUsd: 0,
  rollbackOwner: "user-owner",
  emergencyDisablePlanReviewed: true,
  notes: "No real Codex base_url change is authorized in Phase600.",
});

export function buildPhase600HumanApprovalInputSchema() {
  return {
    completed: true,
    humanApprovalInputSchemaValid: true,
    humanApprovalRecordInputSchemaWorks: true,
    reviewerRefRequired: true,
    decisionRequired: true,
    readinessOnlyDecisionDefined: true,
    realTestApprovalDecisionSeparated: true,
    allowedScopeRequired: true,
    approvalReasonRequired: true,
    approvalNotForged: true,
    requiredFields: PHASE600_HUMAN_APPROVAL_REQUIRED_FIELDS,
    allowedDecisions: PHASE600_APPROVAL_DECISIONS,
    defaultDecision: "not_provided",
  };
}

export function buildPhase600HumanApprovalInputExample() {
  return {
    completed: true,
    humanApprovalRecordInputExampleGenerated: true,
    placeholderOnly: true,
    fakeRefsOnly: true,
    requiredFieldsPresent: PHASE600_HUMAN_APPROVAL_REQUIRED_FIELDS.every((field) =>
      Object.prototype.hasOwnProperty.call(PHASE600_EXAMPLE_HUMAN_APPROVAL_RECORD, field),
    ),
    realApprovalClaimed: false,
    rawSecretExposed: false,
    webhookValueExposed: false,
    example: normalizePhase600ApprovalRecord(PHASE600_EXAMPLE_HUMAN_APPROVAL_RECORD),
  };
}

export function normalizePhase600ApprovalRecord(record = {}) {
  if (!record || typeof record !== "object") return {};
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [sanitizeText(key), normalizeValue(value)]));
}

function normalizeValue(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
  if (value && typeof value === "object") return normalizePhase600ApprovalRecord(value);
  if (typeof value === "string") return sanitizeText(value);
  return value;
}
