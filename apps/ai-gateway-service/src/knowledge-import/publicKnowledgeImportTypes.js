export const PUBLIC_KNOWLEDGE_PHASE = "277A-public-knowledge-import-preview";
export const PUBLIC_KNOWLEDGE_MODE = "local-import-preview-only";
export const PUBLIC_KNOWLEDGE_POLICY_VERSION = "phase277a-v1";
export const PUBLIC_KNOWLEDGE_MANIFEST_VERSION = "phase277a-v1";

export const PUBLIC_KNOWLEDGE_EVIDENCE_JSON = "apps/ai-gateway-service/evidence/phase-277a-public-knowledge-import-preview.json";
export const PUBLIC_KNOWLEDGE_EVIDENCE_MD = "apps/ai-gateway-service/evidence/phase-277a-public-knowledge-import-preview.md";

export const PUBLIC_KNOWLEDGE_FIXTURE_DIR = "apps/ai-gateway-service/fixtures/public-knowledge";

export const PUBLIC_KNOWLEDGE_SAFETY = {
  plainTextApiKeyWritten: false,
  apiKeyPrinted: false,
  paidApiCallExecuted: false,
  externalApiCalled: false,
  mimoApiCalled: false,
  embeddingApiCalled: false,
  llmCleaningCalled: false,
  defaultNvidiaChatLaneChanged: false,
  mimoSetAsDefault: false,
  longContextSentToPaidApi: false,
  largeDatasetDownloaded: false,
  fullDatasetImported: false,
  privateDuplicateKnowledgeImported: false,
  publicDuplicateKnowledgeImported: false,
  batchDuplicateKnowledgeImported: false,
  nearDuplicateAutoImported: false,
  lowTrustKnowledgeImported: false,
  uncleanKnowledgeImported: false,
  legacyModified: false,
  projectContextCreated: false,
  codexCliInvoked: false,
  codexExecInvoked: false,
  workflowRunnerEnabled: false,
  worktreeCreated: false,
  autoCommit: false,
  autoPush: false,
};

export function createEmptyCase(caseId, sourceFamily = "n/a") {
  return {
    caseId,
    mode: PUBLIC_KNOWLEDGE_MODE,
    sourceFamily,
    documentsImported: 0,
    chunksCreated: 0,
    entitiesParsed: 0,
    keywordIndexBuilt: true,
    embeddingIndexBuilt: false,
    vectorIndexBuilt: false,
    noveltyDecision: "unknown",
    acceptedForImport: false,
    existsInPrivateKnowledge: false,
    existsInPublicKnowledge: false,
    existsInCurrentBatch: false,
    reviewRequired: false,
    paidApiCallCount: 0,
    externalApiCalled: false,
    embeddingApiCalled: false,
    llmCleaningCalled: false,
    secretRejected: false,
    status: "pass",
    warnings: [],
  };
}
