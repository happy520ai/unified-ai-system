export function createPreviewLedgerEntry({
  candidateId,
  sourceId,
  title,
  sourceTrustScore,
  noveltyDecision,
  acceptedForImport,
  reviewRequired,
  manualApprovalRequired = true,
}) {
  return {
    ledgerMode: "local-preview-ledger",
    candidateId,
    sourceId,
    title,
    sourceTrustScore,
    noveltyDecision,
    acceptedForImport,
    reviewRequired,
    manualApprovalRequired,
    providerCalled: false,
    paidApiCalled: false,
    mimoCalled: false,
    embeddingCalled: false,
    externalProviderCalled: false,
    schedulerExecuted: false,
    recordedAt: "2026-05-01T00:00:00.000Z",
  };
}

export function buildPreviewEnrichmentLedger(duplicateGuardResults) {
  const entries = duplicateGuardResults.map((result, index) => {
    return createPreviewLedgerEntry({
      candidateId: `phase278a-preview-${String(index + 1).padStart(2, "0")}`,
      sourceId: result.sourceCanonicalId,
      title: result.caseId,
      sourceTrustScore: result.caseId === "new-authoritative-clean-knowledge" ? 0.82 : 0.75,
      noveltyDecision: result.noveltyDecision,
      acceptedForImport: result.acceptedForImport,
      reviewRequired: result.reviewRequired,
    });
  });

  return {
    enabled: true,
    mode: "local-preview-ledger",
    entryCount: entries.length,
    acceptedEntryCount: entries.filter((entry) => entry.acceptedForImport).length,
    reviewRequiredCount: entries.filter((entry) => entry.reviewRequired).length,
    schedulerMode: "manual-approval-required",
    entries,
  };
}
