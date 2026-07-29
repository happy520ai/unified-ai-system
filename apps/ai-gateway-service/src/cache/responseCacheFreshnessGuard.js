import { createStableHash } from "./responseCacheAnswerContract.js";

export function evaluateResponseCacheFreshness(input = {}) {
  const query = String(input.query ?? "");
  const latestEvidenceHash = input.latestEvidenceHash ?? createStableHash(input.latestEvidenceSnapshot ?? {});
  const freshnessRequired = requiresFreshness(query);
  const ttlValid = input.ttlValid ?? true;
  const invalidated = Boolean(input.invalidated);
  const evidenceChanged = Boolean(input.recordLatestEvidenceHash && input.recordLatestEvidenceHash !== latestEvidenceHash);
  const freshnessValid = !invalidated && ttlValid && !evidenceChanged;

  return {
    freshnessRequired,
    freshnessValid,
    ttlValid,
    invalidated,
    latestEvidenceHash,
    staleReason: freshnessValid ? null : createReason({ invalidated, ttlValid, evidenceChanged }),
  };
}

function requiresFreshness(query) {
  const text = query.toLowerCase();
  return ["current", "latest", "today", "next", "blocker", "passed", "ready", "available", "status", "now", "当前", "现在", "最新", "下一步", "阻塞", "可用"].some((term) => text.includes(term));
}

function createReason({ invalidated, ttlValid, evidenceChanged }) {
  if (invalidated) return "cache_record_invalidated";
  if (!ttlValid) return "cache_record_expired";
  if (evidenceChanged) return "latest_evidence_changed";
  return "freshness_guard_failed";
}
