import { createModelVerificationStateStore } from "./modelVerificationStateStore.js";
import { MODEL_CAPABILITY_BUCKETS } from "./modelCapabilityBuckets.js";
import { MODEL_VERIFICATION_STATUSES, canEnterChatModelDropdown } from "./modelSelectableGate.js";

export function buildModelUsabilityMatrix({ registry, verificationStore = createModelVerificationStateStore() } = {}) {
  const records = verificationStore.buildVerificationRecords(registry);
  const chatSelectableModels = records.filter((record) => canEnterChatModelDropdown(record));
  const directChatModels = records.filter((record) => record.directChatAllowed);
  const taskToolModels = records.filter((record) => record.taskToolAllowed);
  const failedStatuses = new Set(["smoke_failed", "blocked", "wrong_endpoint", "rate_limited", "not_supported", "manual_review_required"]);

  return {
    phase: "Phase313A",
    generatedAt: new Date().toISOString(),
    summary: {
      totalModels: records.length,
      smokePassedModels: countWhere(records, (record) => record.verificationStatus === "smoke_passed"),
      selectableModels: countWhere(records, (record) => record.selectable),
      unverifiedModels: countWhere(records, (record) => record.verificationStatus === "unverified"),
      failedModels: countWhere(records, (record) => failedStatuses.has(record.verificationStatus)),
      blockedModels: countWhere(records, (record) => record.verificationStatus === "blocked"),
      rateLimitedModels: countWhere(records, (record) => record.verificationStatus === "rate_limited"),
      deprecatedModels: countWhere(records, (record) => record.verificationStatus === "deprecated" || record.capabilityBucket === "deprecated"),
      directChatModels: directChatModels.length,
      directChatSelectableModels: chatSelectableModels.length,
      taskToolModels: taskToolModels.length,
      chatDropdownModels: chatSelectableModels.length,
      providerCalledModels: countWhere(records, (record) => record.providerCalled),
    },
    statusCounts: countByKnown(records, "verificationStatus", MODEL_VERIFICATION_STATUSES),
    bucketCounts: countByKnown(records, "capabilityBucket", MODEL_CAPABILITY_BUCKETS),
    directChatModels,
    chatSelectableModels,
    taskToolModels,
    records,
  };
}

export function summarizeModelUsabilityMatrix(matrix) {
  return {
    ...matrix.summary,
    statusCounts: matrix.statusCounts,
    bucketCounts: matrix.bucketCounts,
    chatSelectableModelIds: matrix.chatSelectableModels.map((record) => record.modelId),
    taskToolModelCount: matrix.taskToolModels.length,
  };
}

function countWhere(items, predicate) {
  return items.reduce((count, item) => count + (predicate(item) ? 1 : 0), 0);
}

function countByKnown(items, field, knownValues) {
  const counts = Object.fromEntries(knownValues.map((value) => [value, 0]));
  for (const item of items) {
    const key = item[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
