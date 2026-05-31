export function buildPublicKnowledgeIndexPreview({ documents = [], chunks = [], manifest }) {
  const keywordIndex = {};
  const metadataIndex = {};
  const sourceFamilyIndex = {};
  const trustScoreIndex = {};

  for (const chunk of chunks) {
    metadataIndex[chunk.chunkId] = {
      sourceId: chunk.sourceId,
      documentId: chunk.documentId,
      title: chunk.title,
      sourceTrustScore: chunk.sourceTrustScore,
      licenseNote: chunk.licenseNote,
    };
    trustScoreIndex[chunk.chunkId] = chunk.sourceTrustScore;
    for (const keyword of extractKeywords(chunk.text)) {
      keywordIndex[keyword] = keywordIndex[keyword] ?? [];
      keywordIndex[keyword].push(chunk.chunkId);
    }
  }

  for (const document of documents) {
    sourceFamilyIndex[document.sourceFamily] = sourceFamilyIndex[document.sourceFamily] ?? [];
    sourceFamilyIndex[document.sourceFamily].push(document.documentId);
  }

  return {
    indexMode: "local-keyword-metadata-preview",
    keywordIndexBuilt: true,
    metadataIndexBuilt: true,
    sourceFamilyIndexBuilt: true,
    trustScoreIndexBuilt: true,
    embeddingIndexBuilt: false,
    vectorIndexBuilt: false,
    chunkCount: chunks.length,
    documentCount: documents.length,
    sourceFamilyCount: new Set((manifest?.sources ?? documents).map((item) => item.family ?? item.sourceFamily)).size,
    keywordCount: Object.keys(keywordIndex).length,
    keywordIndexPreview: Object.fromEntries(Object.entries(keywordIndex).slice(0, 12)),
    metadataIndexPreview: Object.fromEntries(Object.entries(metadataIndex).slice(0, 4)),
    trustScoreIndexPreview: Object.fromEntries(Object.entries(trustScoreIndex).slice(0, 4)),
  };
}

export function createRagSourceSelectionBridge({ query, chunks = [], projectEvidenceSources = [] }) {
  const isProjectStatus = /project status|current project|blocker|phase/i.test(query);
  if (isProjectStatus) {
    return {
      query,
      selectedSources: [
        ...projectEvidenceSources,
        ...chunks.slice(0, 1).map((chunk) => ({ path: chunk.sourceId, rank: "background-low", chunkId: chunk.chunkId })),
      ],
      projectEvidenceOverridesPublicKnowledge: true,
      publicKnowledgeSelectedAsBackground: true,
      publicKnowledgeAllowedForCurrentProjectState: false,
      modelCalled: false,
    };
  }

  return {
    query,
    selectedSources: chunks.slice(0, 3).map((chunk, index) => ({
      path: chunk.sourceId,
      chunkId: chunk.chunkId,
      rank: index + 1,
      sourceTrustScore: chunk.sourceTrustScore,
    })),
    selectedContextPack: chunks.slice(0, 3).map((chunk) => ({
      chunkId: chunk.chunkId,
      title: chunk.title,
      sourceId: chunk.sourceId,
      textPreview: chunk.text.slice(0, 160),
    })),
    projectEvidenceOverridesPublicKnowledge: true,
    publicKnowledgeSelectedAsBackground: true,
    modelCalled: false,
  };
}

function extractKeywords(text = "") {
  return [...new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 5),
  )].slice(0, 20);
}
