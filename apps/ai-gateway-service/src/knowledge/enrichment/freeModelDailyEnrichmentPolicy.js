export const freeModelDailyEnrichmentPolicy = {
  phase: "278A",
  policyVersion: "phase278a-v1",
  mode: "local-preview-only",
  pipelineName: "free-model-assisted-daily-knowledge-enrichment",
  freeModelOnly: true,
  paidApiCallAllowed: false,
  mimoAllowed: false,
  embeddingAllowed: false,
  semanticModelAllowed: false,
  externalProviderCallAllowed: false,
  realLearningAllowed: false,
  productionReadyClaimed: false,
  schedulerMode: "manual-approval-required",
  schedulerEnabled: false,
  manualApprovalRequired: true,
  rateLimitRequestsPerMinute: 40,
  dailyTimeBudgetHours: 2,
  sourceTrustPolicy: {
    enabled: true,
    minimumTrustScore: 0.7,
    requiredSourceTypes: [
      "official_docs",
      "academic_or_standard",
      "government_or_public_institution",
      "recognized_reference",
      "public_knowledge_fixture",
    ],
    rejectUnknownSource: true,
    rejectLowTrustSource: true,
    requireAttribution: true,
    requireFreshnessMetadata: true,
  },
  cleanDataRequirements: {
    enabled: true,
    requireSanitizedText: true,
    rejectSecretLikeContent: true,
    rejectUncleanContent: true,
    noRawProviderSecretsInLedger: true,
  },
  duplicateGuards: {
    enabled: true,
    privateKnowledge: {
      enabled: true,
      rejectDuplicates: true,
    },
    publicKnowledge: {
      enabled: true,
      rejectDuplicates: true,
    },
    currentBatch: {
      enabled: true,
      rejectDuplicates: true,
    },
  },
  nearDuplicateGuard: {
    enabled: true,
    method: "deterministic-keyword-overlap-preview",
    reviewRequired: true,
    autoImportAllowed: false,
  },
  enrichmentLedger: {
    enabled: true,
    mode: "local-preview-ledger",
    recordsProviderCalls: false,
    recordsModelOutputs: false,
    recordsDuplicateDecisions: true,
    recordsManualApprovalState: true,
  },
};

export function getFreeModelDailyEnrichmentPolicy() {
  return JSON.parse(JSON.stringify(freeModelDailyEnrichmentPolicy));
}
