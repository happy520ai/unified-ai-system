import { createHash } from "node:crypto";

const CREATED_AT = "2026-05-01T00:00:00.000Z";

export function buildPrivateKnowledgePreviewIndex() {
  return [
    createDedupRecord({
      indexType: "private",
      sourceId: "phase-evidence-preview",
      documentId: "phase-274a-system-capability-benchmark",
      chunkId: "phase-274a-system-capability-benchmark:status",
      title: "Current project status",
      text: "Phase 274A Unified System Capability Benchmark records totalScore 95 grade A productionReadiness not-production-ready and blocker none.",
      sourceCanonicalId: "project-status-phase-274a",
      trustScore: 0.95,
    }),
  ];
}

export function buildPublicKnowledgePreviewIndex() {
  return [
    createDedupRecord({
      indexType: "public",
      sourceId: "kiwix-wikipedia-preview",
      documentId: "wikipedia-albert-einstein-preview",
      chunkId: "wikipedia-albert-einstein-preview:chunk-1",
      title: "Albert Einstein",
      text: "Albert Einstein was a theoretical physicist who developed the theory of relativity.",
      sourceCanonicalId: "public:albert-einstein",
      trustScore: 0.75,
    }),
  ];
}

export function buildCurrentBatchIndex(candidates = []) {
  return candidates.map((candidate, index) => createDedupRecord({
    indexType: "current_batch",
    sourceId: candidate.sourceId ?? "current-batch-preview",
    documentId: candidate.documentId ?? `current-batch-doc-${index + 1}`,
    chunkId: candidate.chunkId ?? `current-batch-doc-${index + 1}:chunk-1`,
    title: candidate.title ?? "Current batch candidate",
    text: candidate.text ?? candidate.candidateText ?? "",
    sourceCanonicalId: candidate.sourceCanonicalId ?? candidate.documentId ?? `current-batch-doc-${index + 1}`,
    trustScore: candidate.sourceTrustScore ?? candidate.trustScore ?? 0.75,
  }));
}

export function checkCandidateAgainstIndexes(candidate = {}, indexes = {}) {
  const candidateRecord = createDedupRecord({
    indexType: "candidate",
    sourceId: candidate.sourceId,
    documentId: candidate.documentId,
    chunkId: candidate.chunkId,
    title: candidate.title,
    text: candidate.text,
    sourceCanonicalId: candidate.sourceCanonicalId,
    trustScore: candidate.sourceTrustScore ?? candidate.trustScore,
  });
  const allIndexes = [
    ...(indexes.privateKnowledgeIndex ?? []),
    ...(indexes.publicKnowledgeIndex ?? []),
    ...(indexes.currentBatchIndex ?? []),
  ];
  return {
    candidateRecord,
    exactMatches: allIndexes.filter((record) => recordsMatch(candidateRecord, record)),
    nearDuplicateScore: Math.max(0, ...allIndexes.map((record) => keywordOverlap(candidateRecord.keywords, record.keywords))),
  };
}

export function addAcceptedCandidateToBatchIndex(currentBatchIndex = [], candidate = {}) {
  return [
    ...currentBatchIndex,
    createDedupRecord({
      indexType: "current_batch",
      sourceId: candidate.sourceId,
      documentId: candidate.documentId,
      chunkId: candidate.chunkId,
      title: candidate.title,
      text: candidate.text,
      sourceCanonicalId: candidate.sourceCanonicalId,
      trustScore: candidate.sourceTrustScore ?? candidate.trustScore,
    }),
  ];
}

export function createDedupRecord(input = {}) {
  const normalizedText = normalizeKnowledgeText(input.text ?? "");
  const normalizedTitle = normalizeKnowledgeText(input.title ?? "");
  return {
    indexType: input.indexType ?? "public",
    sourceId: input.sourceId ?? "unknown-source",
    documentId: input.documentId ?? "unknown-document",
    chunkId: input.chunkId ?? "unknown-chunk",
    normalizedTextHash: hashString(normalizedText),
    titleHash: hashString(normalizedTitle),
    sourceCanonicalId: input.sourceCanonicalId ?? input.documentId ?? "unknown-canonical-id",
    keywords: extractPreviewKeywords(normalizedText),
    trustScore: input.trustScore ?? 0.30,
    createdAt: input.createdAt ?? CREATED_AT,
  };
}

export function normalizeKnowledgeText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashString(value = "") {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function extractPreviewKeywords(normalizedText = "") {
  return [...new Set(
    String(normalizedText)
      .split(/\s+/)
      .filter((token) => token.length >= 4),
  )].slice(0, 32);
}

function recordsMatch(candidate, record) {
  return candidate.normalizedTextHash === record.normalizedTextHash
    || candidate.titleHash === record.titleHash && candidate.sourceCanonicalId === record.sourceCanonicalId
    || candidate.sourceCanonicalId !== "unknown-canonical-id" && candidate.sourceCanonicalId === record.sourceCanonicalId;
}

function keywordOverlap(left = [], right = []) {
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const intersectionCount = left.filter((keyword) => rightSet.has(keyword)).length;
  return Number((intersectionCount / Math.min(left.length, right.length)).toFixed(3));
}
