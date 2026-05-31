import { checkCandidateAgainstIndexes, createDedupRecord } from "./publicKnowledgeDedupIndex.js";

const NEAR_DUPLICATE_THRESHOLD = 0.50;

export function evaluatePublicKnowledgeNovelty(input = {}) {
  const candidateChunk = input.candidateChunk ?? {};
  const privateKnowledgeIndex = input.privateKnowledgeIndex ?? [];
  const publicKnowledgeIndex = input.publicKnowledgeIndex ?? [];
  const currentBatchIndex = input.currentBatchIndex ?? [];
  const candidateRecord = createDedupRecord({
    indexType: "candidate",
    sourceId: candidateChunk.sourceId,
    documentId: candidateChunk.documentId,
    chunkId: candidateChunk.chunkId,
    title: candidateChunk.title,
    text: candidateChunk.text,
    sourceCanonicalId: candidateChunk.sourceCanonicalId,
    trustScore: candidateChunk.sourceTrustScore,
  });

  if (!candidateChunk.text || candidateRecord.keywords.length === 0) {
    return createDecision({
      candidateRecord,
      noveltyDecision: "unknown",
      duplicateLayer: "none",
      nearDuplicateScore: 0,
    });
  }

  const privateCheck = checkCandidateAgainstIndexes(candidateChunk, { privateKnowledgeIndex });
  const publicCheck = checkCandidateAgainstIndexes(candidateChunk, { publicKnowledgeIndex });
  const batchCheck = checkCandidateAgainstIndexes(candidateChunk, { currentBatchIndex });
  const existsInPrivateKnowledge = privateCheck.exactMatches.length > 0;
  const existsInPublicKnowledge = publicCheck.exactMatches.length > 0;
  const existsInCurrentBatch = batchCheck.exactMatches.length > 0;
  const duplicateLayers = [
    existsInPrivateKnowledge ? "private" : null,
    existsInPublicKnowledge ? "public" : null,
    existsInCurrentBatch ? "current_batch" : null,
  ].filter(Boolean);

  if (duplicateLayers.length > 0) {
    const duplicateLayer = duplicateLayers.length > 1 ? "multiple" : duplicateLayers[0];
    const noveltyDecision = duplicateLayer === "private"
      ? "duplicate_private"
      : duplicateLayer === "public"
        ? "duplicate_public"
        : duplicateLayer === "current_batch"
          ? "duplicate_current_batch"
          : "unknown";
    return createDecision({
      candidateRecord,
      noveltyDecision,
      existsInPrivateKnowledge,
      existsInPublicKnowledge,
      existsInCurrentBatch,
      duplicateLayer,
      duplicateOf: [
        ...privateCheck.exactMatches,
        ...publicCheck.exactMatches,
        ...batchCheck.exactMatches,
      ][0] ?? null,
      nearDuplicateScore: Math.max(privateCheck.nearDuplicateScore, publicCheck.nearDuplicateScore, batchCheck.nearDuplicateScore),
    });
  }

  const nearDuplicateScore = Math.max(privateCheck.nearDuplicateScore, publicCheck.nearDuplicateScore, batchCheck.nearDuplicateScore);
  if (nearDuplicateScore >= NEAR_DUPLICATE_THRESHOLD) {
    return createDecision({
      candidateRecord,
      noveltyDecision: "near_duplicate",
      duplicateLayer: "none",
      nearDuplicateScore,
      reviewRequired: true,
    });
  }

  return createDecision({
    candidateRecord,
    noveltyDecision: "new",
    duplicateLayer: "none",
    nearDuplicateScore,
  });
}

function createDecision(input = {}) {
  const noveltyDecision = input.noveltyDecision ?? "unknown";
  const acceptedForImport = noveltyDecision === "new";
  return {
    isNewKnowledge: acceptedForImport,
    existsInPrivateKnowledge: input.existsInPrivateKnowledge === true,
    existsInPublicKnowledge: input.existsInPublicKnowledge === true,
    existsInCurrentBatch: input.existsInCurrentBatch === true,
    duplicateLayer: input.duplicateLayer ?? "none",
    duplicateOf: input.duplicateOf ?? null,
    similarityMethod: "deterministic-normalized-text-hash",
    normalizedTextHash: input.candidateRecord?.normalizedTextHash ?? "",
    titleHash: input.candidateRecord?.titleHash ?? "",
    sourceCanonicalId: input.candidateRecord?.sourceCanonicalId ?? "unknown-canonical-id",
    nearDuplicateScore: input.nearDuplicateScore ?? 0,
    noveltyDecision,
    reviewRequired: input.reviewRequired === true || noveltyDecision === "near_duplicate",
    acceptedForImport,
  };
}
