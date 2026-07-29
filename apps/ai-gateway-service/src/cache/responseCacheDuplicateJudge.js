export function judgeResponseCacheDuplicate(candidate = {}, record = {}) {
  const sameKey = Boolean(candidate.cacheKey && candidate.cacheKey === record.cacheKey);
  const sameIntent = Boolean(candidate.intentSignature && candidate.intentSignature === record.intentSignature);
  const sameContext = Boolean(candidate.selectedSourcesHash && candidate.selectedSourcesHash === record.selectedSourcesHash);
  const sameEvidence = Boolean(candidate.latestEvidenceHash && candidate.latestEvidenceHash === record.latestEvidenceHash);
  const sameContract = Boolean(candidate.answerContractHash && candidate.answerContractHash === record.answerContractHash);
  const canServe = sameKey && sameContext && sameEvidence && sameContract;

  return {
    duplicate: canServe || (sameIntent && sameContext && sameEvidence && sameContract),
    canServeFromCache: canServe,
    cacheHitType: canServe ? "exact_hit" : sameIntent ? "intent_soft_hit" : "hard_miss",
    duplicateConfidence: canServe ? "high" : sameIntent ? "medium" : "low",
    duplicateReason: canServe ? "deterministic_key_match" : sameIntent ? "same_intent_preview_candidate" : "deterministic_context_mismatch",
  };
}
