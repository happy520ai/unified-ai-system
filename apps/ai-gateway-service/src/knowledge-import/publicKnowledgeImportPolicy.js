import { PUBLIC_KNOWLEDGE_MODE, PUBLIC_KNOWLEDGE_POLICY_VERSION } from "./publicKnowledgeImportTypes.js";

export function createPublicKnowledgeImportPolicy() {
  return {
    policyVersion: PUBLIC_KNOWLEDGE_POLICY_VERSION,
    mode: "local-preview-only",
    pipelineMode: PUBLIC_KNOWLEDGE_MODE,
    autoDownloadEnabled: false,
    fullDatasetImportEnabled: false,
    paidApiCallAllowed: false,
    embeddingCallAllowed: false,
    llmCleaningAllowed: false,
    maxFixtureBytes: 200000,
    maxChunksPerSource: 20,
    maxChunkChars: 1200,
    minChunkChars: 100,
    requireSourceAttribution: true,
    requireLicenseNote: true,
    requireSourceTrustScore: true,
    requireFreshnessPolicy: true,
    blockSecretLikeContent: true,
    requireMultiLayerNoveltyCheck: true,
    checkPrivateKnowledgeIndex: true,
    checkPublicKnowledgeIndex: true,
    checkCurrentBatchIndex: true,
    rejectPrivateDuplicate: true,
    rejectPublicDuplicate: true,
    rejectBatchDuplicate: true,
    nearDuplicateRequiresReview: true,
    nearDuplicateAutoIngestAllowed: false,
    onlyNewKnowledgeCanBeImported: true,
  };
}

export function createPublicKnowledgePriorityRules() {
  return {
    projectEvidenceOverridesPublicKnowledge: true,
    publicKnowledgeUsedAsBackground: true,
    publicKnowledgeAllowedForCurrentProjectState: false,
    privateKnowledgeCheckedBeforeImport: true,
    publicKnowledgeCheckedBeforeImport: true,
    currentBatchCheckedBeforeImport: true,
    onlyNewKnowledgeCanBeImported: true,
    publicKnowledgeDuplicatesRejected: true,
    privateKnowledgeDuplicatesRejected: true,
    batchDuplicatesRejected: true,
    nearDuplicateRequiresReview: true,
  };
}
