import { bucketForModel, isDirectChatBucket, isTaskToolBucket, normalizeCapabilityBucket } from "./modelCapabilityBuckets.js";

export const MODEL_VERIFICATION_STATUSES = Object.freeze([
  "smoke_passed",
  "unverified",
  "smoke_failed",
  "blocked",
  "wrong_endpoint",
  "rate_limited",
  "not_supported",
  "skipped_by_policy",
  "deprecated",
  "manual_review_required",
]);

const STATUS_SET = new Set(MODEL_VERIFICATION_STATUSES);
const HARD_BLOCKED_STATUSES = new Set([
  "blocked",
  "wrong_endpoint",
  "not_supported",
  "deprecated",
  "skipped_by_policy",
  "manual_review_required",
]);

export function normalizeVerificationStatus(status) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return STATUS_SET.has(normalized) ? normalized : "manual_review_required";
}

export function evaluateModelSelectable(modelOrRecord = {}) {
  const verificationStatus = normalizeVerificationStatus(modelOrRecord.verificationStatus ?? modelOrRecord.testStatus);
  const capabilityBucket = normalizeCapabilityBucket(modelOrRecord.capabilityBucket ?? bucketForModel(modelOrRecord));
  const directChatAllowed = isDirectChatBucket(capabilityBucket) && verificationStatus !== "deprecated";
  const taskToolAllowed = !directChatAllowed && isTaskToolBucket(capabilityBucket);
  const evidenceId = String(modelOrRecord.evidenceId ?? "").trim();
  const reasons = [];

  if (verificationStatus !== "smoke_passed") {
    reasons.push(`verificationStatus=${verificationStatus}`);
  }
  if (HARD_BLOCKED_STATUSES.has(verificationStatus)) {
    reasons.push(`blocked_status=${verificationStatus}`);
  }
  if (capabilityBucket === "unknown") {
    reasons.push("capabilityBucket=unknown");
  }
  if (capabilityBucket === "deprecated") {
    reasons.push("capabilityBucket=deprecated");
  }
  if (!evidenceId && verificationStatus === "smoke_passed") {
    reasons.push("missing_evidenceId");
  }

  const selectable = reasons.length === 0;
  const chatDropdownSelectable = selectable && directChatAllowed;
  const taskToolSelectable = selectable && taskToolAllowed;

  return {
    verificationStatus,
    capabilityBucket,
    selectable,
    selectableReason: selectable
      ? directChatAllowed
        ? "smoke_passed_with_direct_chat_evidence"
        : "smoke_passed_task_tool_evidence"
      : reasons.join("; "),
    directChatAllowed,
    taskToolAllowed,
    chatDropdownSelectable,
    taskToolSelectable,
  };
}

export function canEnterChatModelDropdown(modelOrRecord = {}) {
  return evaluateModelSelectable(modelOrRecord).chatDropdownSelectable === true;
}
