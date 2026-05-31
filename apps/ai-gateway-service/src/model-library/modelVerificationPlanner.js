import { buildModelUsabilityMatrix } from "./modelUsabilityMatrix.js";
import { DIRECT_CHAT_BUCKETS, normalizeCapabilityBucket } from "./modelCapabilityBuckets.js";

const RETRYABLE_FAILED_STATUSES = new Set(["smoke_failed", "rate_limited"]);
const DEFAULT_MAX_MODELS = 5;
const DEFAULT_RPM_LIMIT = 40;

export function createModelVerificationPlan({
  registry,
  matrix = buildModelUsabilityMatrix({ registry }),
  maxModels = DEFAULT_MAX_MODELS,
  bucket = "",
  includeUnverified = true,
  includeFailedRetry = false,
  realSmokeEnabled = false,
  rpmLimit = DEFAULT_RPM_LIMIT,
  providerId = "nvidia",
  env = process.env,
} = {}) {
  const policyWarnings = [];
  const normalizedProviderId = String(providerId || "nvidia").trim().toLowerCase();
  const requestedMaxModels = readInteger(maxModels, DEFAULT_MAX_MODELS);
  const safeMaxModels = clamp(requestedMaxModels, 1, DEFAULT_MAX_MODELS);
  const requestedRpmLimit = readInteger(rpmLimit, DEFAULT_RPM_LIMIT);
  const safeRpmLimit = clamp(requestedRpmLimit, 1, DEFAULT_RPM_LIMIT);
  const normalizedBucket = normalizeCapabilityBucket(bucket);
  const bucketFilterActive = Boolean(bucket) && normalizedBucket !== "unknown";

  if (requestedMaxModels > DEFAULT_MAX_MODELS) {
    policyWarnings.push("maxModels clamped to 5 for Phase313A.");
  }
  if (requestedRpmLimit > DEFAULT_RPM_LIMIT) {
    policyWarnings.push("rpmLimit clamped to 40 for NVIDIA free API safety.");
  }
  if (normalizedProviderId !== "nvidia") {
    policyWarnings.push("Phase313A verification plans only allow providerId=nvidia.");
  }
  if (realSmokeEnabled && env.PHASE313A_NVIDIA_REAL_SMOKE !== "1") {
    policyWarnings.push("PHASE313A_NVIDIA_REAL_SMOKE=1 is required before any real NVIDIA call.");
  }

  const allowedDefaultBuckets = new Set(DIRECT_CHAT_BUCKETS);
  const candidates = [];
  const skippedModels = [];
  const skipReasons = {};

  for (const record of matrix.records ?? []) {
    const reasons = [];
    if (record.providerId !== normalizedProviderId) reasons.push("provider_mismatch");
    if (bucketFilterActive && record.capabilityBucket !== normalizedBucket) reasons.push("bucket_mismatch");
    if (!bucketFilterActive && !allowedDefaultBuckets.has(record.capabilityBucket)) reasons.push("default_bucket_not_prioritized");
    if (record.verificationStatus === "smoke_passed") reasons.push("already_smoke_passed");
    if (!includeUnverified && record.verificationStatus === "unverified") reasons.push("unverified_excluded");
    if (!includeFailedRetry && RETRYABLE_FAILED_STATUSES.has(record.verificationStatus)) reasons.push("failed_retry_excluded");
    if (!isPlanEligibleEndpoint(record)) reasons.push("endpoint_not_small_chat_smoke");

    if (reasons.length === 0 && candidates.length < safeMaxModels) {
      candidates.push(record);
    } else {
      const finalReasons = reasons.length ? reasons : ["max_models_reached"];
      skippedModels.push({
        providerId: record.providerId,
        modelId: record.modelId,
        capabilityBucket: record.capabilityBucket,
        verificationStatus: record.verificationStatus,
        reasons: finalReasons,
      });
      for (const reason of finalReasons) {
        skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
      }
    }
  }

  const willCallProvider = Boolean(
    realSmokeEnabled === true &&
      env.PHASE313A_NVIDIA_REAL_SMOKE === "1" &&
      normalizedProviderId === "nvidia" &&
      candidates.length > 0,
  );
  const estimatedRequests = candidates.length;

  return {
    candidateModels: candidates.map(summarizePlanModel),
    skippedModels,
    skipReasons,
    estimatedRequests,
    estimatedMinimumDurationSeconds: estimateMinimumDurationSeconds(estimatedRequests, safeRpmLimit),
    policyWarnings,
    willCallProvider,
    providerCalled: false,
    options: {
      maxModels: safeMaxModels,
      bucket: bucketFilterActive ? normalizedBucket : "default_chat_reasoning_code",
      includeUnverified: Boolean(includeUnverified),
      includeFailedRetry: Boolean(includeFailedRetry),
      realSmokeEnabled: Boolean(realSmokeEnabled),
      rpmLimit: safeRpmLimit,
      providerId: normalizedProviderId,
    },
  };
}

function summarizePlanModel(record) {
  return {
    providerId: record.providerId,
    modelId: record.modelId,
    displayName: record.displayName,
    capabilityBucket: record.capabilityBucket,
    verificationStatus: record.verificationStatus,
    endpointUsed: record.endpointUsed,
    directChatAllowed: record.directChatAllowed,
    taskToolAllowed: record.taskToolAllowed,
    selectable: record.selectable,
  };
}

function isPlanEligibleEndpoint(record) {
  return (
    record.endpointType === "chat_completions" &&
    record.directChatAllowed === true &&
    record.downloadableOnly !== true &&
    record.requiresSpecialPayload !== true
  );
}

function estimateMinimumDurationSeconds(estimatedRequests, rpmLimit) {
  if (estimatedRequests <= 1) return estimatedRequests;
  const delaySeconds = 60 / Math.max(1, rpmLimit);
  return Math.ceil((estimatedRequests - 1) * delaySeconds);
}

function readInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
