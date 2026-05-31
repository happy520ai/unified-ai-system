import { createHash } from "node:crypto";

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashText(value) {
  return createHash("sha256").update(normalizeText(value)).digest("hex");
}

function keywordSet(value) {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((word) => word.length >= 4 || /[\u4e00-\u9fff]/u.test(word)),
  );
}

function keywordOverlapScore(left, right) {
  const leftSet = keywordSet(left);
  const rightSet = keywordSet(right);
  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const word of leftSet) {
    if (rightSet.has(word)) {
      overlap += 1;
    }
  }

  return Number((overlap / Math.min(leftSet.size, rightSet.size)).toFixed(3));
}

function createIndexRecord(indexType, sourceId, documentId, title, text) {
  return {
    indexType,
    sourceId,
    documentId,
    normalizedTextHash: hashText(text),
    titleHash: hashText(title),
    sourceCanonicalId: `${sourceId}:${documentId}`,
    keywords: Array.from(keywordSet(`${title} ${text}`)).slice(0, 16),
    createdAt: "2026-05-01T00:00:00.000Z",
  };
}

export function buildPreviewDedupIndexes() {
  return {
    privateKnowledgeIndex: [
      createIndexRecord(
        "private",
        "project-evidence",
        "phase-status",
        "Current project phase status",
        "Phase 280A and Phase 279A are passed, while Phase 278A requires a local preview seal before it can be treated as complete.",
      ),
    ],
    publicKnowledgeIndex: [
      createIndexRecord(
        "public",
        "public-knowledge-library",
        "einstein-background",
        "Albert Einstein",
        "Albert Einstein was a theoretical physicist known for relativity and major contributions to modern physics.",
      ),
    ],
    currentBatchIndex: [
      createIndexRecord(
        "current_batch",
        "daily-preview-batch",
        "candidate-001",
        "Manual approval scheduler",
        "Daily enrichment scheduler remains disabled until a human grants manual approval for a local preview run.",
      ),
    ],
  };
}

function findExactDuplicate(candidateRecord, index) {
  return index.find((record) => {
    return record.normalizedTextHash === candidateRecord.normalizedTextHash
      || record.titleHash === candidateRecord.titleHash
      || record.sourceCanonicalId === candidateRecord.sourceCanonicalId;
  }) ?? null;
}

function findNearDuplicate(candidate, indexes) {
  const allRecords = [
    ...indexes.privateKnowledgeIndex,
    ...indexes.publicKnowledgeIndex,
    ...indexes.currentBatchIndex,
  ];
  let best = null;
  for (const record of allRecords) {
    const comparisonText = `${record.sourceId} ${record.documentId} ${record.keywords.join(" ")}`;
    const score = keywordOverlapScore(`${candidate.title} ${candidate.text}`, comparisonText);
    if (!best || score > best.score) {
      best = { record, score };
    }
  }
  return best && best.score >= 0.55 ? best : null;
}

export function evaluateEnrichmentCandidate(candidate, indexes = buildPreviewDedupIndexes()) {
  const candidateRecord = createIndexRecord(
    "candidate",
    candidate.sourceId ?? "candidate-source",
    candidate.documentId ?? "candidate-document",
    candidate.title ?? "",
    candidate.text ?? "",
  );

  const privateDuplicate = findExactDuplicate(candidateRecord, indexes.privateKnowledgeIndex);
  const publicDuplicate = findExactDuplicate(candidateRecord, indexes.publicKnowledgeIndex);
  const batchDuplicate = findExactDuplicate(candidateRecord, indexes.currentBatchIndex);
  const duplicateMatches = [
    privateDuplicate ? "private" : null,
    publicDuplicate ? "public" : null,
    batchDuplicate ? "current_batch" : null,
  ].filter(Boolean);

  if (duplicateMatches.length > 0) {
    const duplicateLayer = duplicateMatches.length > 1 ? "multiple" : duplicateMatches[0];
    const noveltyDecision = duplicateLayer === "private"
      ? "duplicate_private"
      : duplicateLayer === "public"
        ? "duplicate_public"
        : duplicateLayer === "current_batch"
          ? "duplicate_current_batch"
          : "duplicate_multiple";
    return {
      isNewKnowledge: false,
      existsInPrivateKnowledge: Boolean(privateDuplicate),
      existsInPublicKnowledge: Boolean(publicDuplicate),
      existsInCurrentBatch: Boolean(batchDuplicate),
      duplicateLayer,
      duplicateOf: privateDuplicate ?? publicDuplicate ?? batchDuplicate,
      similarityMethod: "deterministic-normalized-text-hash",
      normalizedTextHash: candidateRecord.normalizedTextHash,
      titleHash: candidateRecord.titleHash,
      sourceCanonicalId: candidateRecord.sourceCanonicalId,
      nearDuplicateScore: 1,
      noveltyDecision,
      reviewRequired: false,
      acceptedForImport: false,
    };
  }

  const nearDuplicate = findNearDuplicate(candidate, indexes);
  if (nearDuplicate) {
    return {
      isNewKnowledge: false,
      existsInPrivateKnowledge: false,
      existsInPublicKnowledge: false,
      existsInCurrentBatch: false,
      duplicateLayer: "none",
      duplicateOf: nearDuplicate.record,
      similarityMethod: "deterministic-keyword-overlap-preview",
      normalizedTextHash: candidateRecord.normalizedTextHash,
      titleHash: candidateRecord.titleHash,
      sourceCanonicalId: candidateRecord.sourceCanonicalId,
      nearDuplicateScore: nearDuplicate.score,
      noveltyDecision: "near_duplicate",
      reviewRequired: true,
      acceptedForImport: false,
    };
  }

  return {
    isNewKnowledge: true,
    existsInPrivateKnowledge: false,
    existsInPublicKnowledge: false,
    existsInCurrentBatch: false,
    duplicateLayer: "none",
    duplicateOf: null,
    similarityMethod: "deterministic-normalized-text-hash-and-keyword-overlap-preview",
    normalizedTextHash: candidateRecord.normalizedTextHash,
    titleHash: candidateRecord.titleHash,
    sourceCanonicalId: candidateRecord.sourceCanonicalId,
    nearDuplicateScore: 0,
    noveltyDecision: "new",
    reviewRequired: false,
    acceptedForImport: true,
  };
}

export function runDuplicateGuardPreview() {
  const indexes = buildPreviewDedupIndexes();
  const candidates = [
    {
      caseId: "new-authoritative-clean-knowledge",
      sourceId: "recognized-reference-preview",
      documentId: "daily-preview-new",
      title: "Free model daily learning boundary",
      text: "A local preview can record enrichment candidates, rate limits, source trust, duplicate decisions, and manual approval without calling any provider.",
    },
    {
      caseId: "private-duplicate",
      sourceId: "project-evidence",
      documentId: "phase-status",
      title: "Current project phase status",
      text: "Phase 280A and Phase 279A are passed, while Phase 278A requires a local preview seal before it can be treated as complete.",
    },
    {
      caseId: "public-duplicate",
      sourceId: "public-knowledge-library",
      documentId: "einstein-background",
      title: "Albert Einstein",
      text: "Albert Einstein was a theoretical physicist known for relativity and major contributions to modern physics.",
    },
    {
      caseId: "batch-duplicate",
      sourceId: "daily-preview-batch",
      documentId: "candidate-001",
      title: "Manual approval scheduler",
      text: "Daily enrichment scheduler remains disabled until a human grants manual approval for a local preview run.",
    },
    {
      caseId: "near-duplicate-review",
      sourceId: "recognized-reference-preview",
      documentId: "einstein-summary-variant",
      title: "Einstein physics summary",
      text: "Albert Einstein was a theoretical physicist remembered for relativity and important work in modern physics.",
    },
  ];

  return candidates.map((candidate) => ({
    caseId: candidate.caseId,
    ...evaluateEnrichmentCandidate(candidate, indexes),
  }));
}
