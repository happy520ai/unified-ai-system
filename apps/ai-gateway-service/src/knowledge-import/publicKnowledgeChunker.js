import { scorePublicKnowledgeSource } from "./publicKnowledgeSourceTrust.js";

export function chunkPublicKnowledgeDocument(document = {}, policy = {}) {
  const maxChunkChars = policy.maxChunkChars ?? 1200;
  const minChunkChars = policy.minChunkChars ?? 100;
  const maxChunks = policy.maxChunksPerSource ?? 20;
  const text = String(document.text ?? "");
  const trust = scorePublicKnowledgeSource({ family: document.sourceFamily, trustTier: document.trustTier });
  const chunks = [];
  let cursor = 0;

  while (cursor < text.length && chunks.length < maxChunks) {
    const next = text.slice(cursor, cursor + maxChunkChars);
    const trimmed = next.trim();
    if (trimmed.length >= minChunkChars || (chunks.length === 0 && trimmed.length > 0)) {
      chunks.push({
        chunkId: `${document.documentId || "doc"}:chunk-${chunks.length + 1}`,
        sourceId: document.sourceId,
        documentId: document.documentId,
        title: document.title,
        chunkIndex: chunks.length,
        text: trimmed,
        charLength: trimmed.length,
        estimatedTokens: estimateTokens(trimmed),
        sourceTrustScore: trust.trustScore,
        licenseNote: document.licenseNote,
        freshness: {
          snapshotDate: document.snapshotDate ?? "2026-05-01",
          freshnessPolicy: document.freshnessPolicy ?? "periodic_snapshot",
        },
      });
    }
    cursor += maxChunkChars;
  }

  return {
    documentId: document.documentId,
    chunks,
    chunkCount: chunks.length,
    embeddingApiCalled: false,
  };
}

export function estimateTokens(text = "") {
  return Math.max(1, Math.ceil(String(text).length / 4));
}
