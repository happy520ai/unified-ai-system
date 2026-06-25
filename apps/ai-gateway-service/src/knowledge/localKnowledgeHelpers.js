export const DEFAULT_PHASE = "phase-21a-knowledge-entry";
export const DEFAULT_TOP_K = 3;
export const MAX_TOP_K = 10;

export const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "by",
  "for",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "with",
  "\u4e00\u4e2a",
  "\u4ee5\u53ca",
  "\u548c",
  "\u7684",
]);

export const DEFAULT_DOCUMENTS = [
  {
    sourceId: "unified-ai-system-defaults",
    documentId: "default-command-set",
    title: "PME \u79fb\u52a8\u5730\u7403 frozen default command set",
    uri: "unified-ai-system://docs/default-command-set",
    text:
      "PME \u79fb\u52a8\u5730\u7403 frozen default command set includes help:phase14a, dev:phase7b, status:phase10a, " +
      "health:phase12a, doctor:phase13a, logs:phase16a, restart:phase11a, idle:phase15a, " +
      "stop:phase9c, verify:phase7a, verify:phase8a-4, verify:phase21, verify:phase21a, " +
      "verify:phase21b, and verify:phase21c. dev:phase7b and restart:phase11a are " +
      "long-running managed entries. status, doctor, logs, and help are read-only entries.",
  },
  {
    sourceId: "unified-ai-system-boundaries",
    documentId: "nvidia-single-provider-boundary",
    title: "NVIDIA single-provider boundary",
    uri: "unified-ai-system://docs/nvidia-single-provider-boundary",
    text:
      "The current PME \u79fb\u52a8\u5730\u7403 AI Gateway baseline remains NVIDIA single provider only. The real-operation " +
      "chain is agent-console to ai-gateway-service to NVIDIA. This does not complete or enter " +
      "DataEyes, multi-provider execution, fallback execution, scoring/evaluation, governance, " +
      "dashboard, streaming, release automation, or production knowledge platform scope.",
  },
  {
    sourceId: "unified-ai-system-operations",
    documentId: "managed-startup-and-logs",
    title: "Managed startup, status, logs, and idle",
    uri: "unified-ai-system://docs/managed-operations",
    text:
      "Phase 9C manages startup with PID ownership. status:phase10a reads only the managed state. " +
      "logs:phase16a reads only the managed logPath recorded in state. idle:phase15a composes " +
      "stop:phase9c followed by status:phase10a, returning the chain to stopped.",
  },
  {
    sourceId: "unified-ai-system-defect-standby",
    documentId: "defect-report-template",
    title: "Defect-driven standby template",
    uri: "unified-ai-system://docs/defect-report-template",
    text:
      "Daily use is now in defect-driven standby. Report one concrete issue at a time with: " +
      "reproduction command, actual failure, expected behavior, single failure point, and key output.",
  },
];

export function normalizeDocuments(documents) {
  return documents.map((document, index) => ({
    sourceId: document.sourceId ?? "default",
    sourceTitle: document.sourceTitle,
    documentId: document.documentId ?? `document-${index + 1}`,
    title: document.title ?? `Document ${index + 1}`,
    uri: document.uri,
    text: String(document.text ?? document.content ?? ""),
    metadata: document.metadata ?? {},
  }));
}

export function markSystemDocument(document) {
  return { ...document, persistenceScope: "system" };
}

export function markUserDocument(document) {
  return { ...document, persistenceScope: "user" };
}

export function isUserDocument(document) {
  return document.persistenceScope === "user";
}

export function mergeDocuments(baseDocuments, extraDocuments) {
  const merged = new Map();
  for (const document of [...baseDocuments, ...extraDocuments]) {
    merged.set(toDocumentKey(document), document);
  }
  return Array.from(merged.values());
}

export function normalizeRequiredString(value, message) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    const error = new Error(message);
    error.code = "KNOWLEDGE_LOAD_VALIDATION_ERROR";
    error.category = "validation";
    throw error;
  }
  return normalized;
}

export function normalizeOptionalString(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

export function toDocumentKey(document) {
  return `${document.sourceId}:${document.documentId}`;
}

export function toDocumentRef(document) {
  return {
    sourceId: document.sourceId,
    documentId: document.documentId,
    title: document.title,
    uri: document.uri,
    metadata: document.metadata,
  };
}

export function toScoredChunk(document, { normalizedQuery, queryTerms }) {
  const normalizedTitle = normalizeSearchText(document.title);
  const normalizedSourceId = normalizeSearchText(document.sourceId);
  const normalizedDocumentId = normalizeSearchText(document.documentId);
  const normalizedText = normalizeSearchText(document.text);
  const titleTerms = tokenize(normalizedTitle);
  const sourceTerms = tokenize(normalizedSourceId);
  const documentIdTerms = tokenize(normalizedDocumentId);
  const textTerms = tokenize(normalizedText);
  const searchableTerms = new Set([...titleTerms, ...sourceTerms, ...documentIdTerms, ...textTerms]);
  const matchedTerms = queryTerms.filter((term) => searchableTerms.has(term));
  const titleMatchedTerms = queryTerms.filter((term) => titleTerms.includes(term));
  const sourceMatchedTerms = queryTerms.filter((term) => sourceTerms.includes(term));
  const documentIdMatchedTerms = queryTerms.filter((term) => documentIdTerms.includes(term));
  const bodyMatchedTerms = queryTerms.filter((term) => textTerms.includes(term));
  const uniqueMatches = new Set(matchedTerms).size;
  const queryTermCount = new Set(queryTerms).size;
  const termCoverage = queryTermCount === 0 ? 0 : uniqueMatches / queryTermCount;
  const titleCoverage = queryTermCount === 0 ? 0 : new Set(titleMatchedTerms).size / queryTermCount;
  const sourceCoverage = queryTermCount === 0 ? 0 : new Set(sourceMatchedTerms).size / queryTermCount;
  const documentIdCoverage = queryTermCount === 0 ? 0 : new Set(documentIdMatchedTerms).size / queryTermCount;
  const bodyCoverage = queryTermCount === 0 ? 0 : new Set(bodyMatchedTerms).size / queryTermCount;
  const phraseMatch = normalizedQuery.length > 0 && (normalizedText.includes(normalizedQuery) || normalizedTitle.includes(normalizedQuery));
  const exactMatch = normalizedQuery.length > 0 && (normalizedText === normalizedQuery || normalizedTitle === normalizedQuery);
  const contiguousMatch = hasContiguousTerms([...titleTerms, ...textTerms], queryTerms);
  const scoreBreakdown = {
    termCoverage: Number(termCoverage.toFixed(4)),
    titleCoverage: Number(titleCoverage.toFixed(4)),
    sourceCoverage: Number(sourceCoverage.toFixed(4)),
    documentIdCoverage: Number(documentIdCoverage.toFixed(4)),
    bodyCoverage: Number(bodyCoverage.toFixed(4)),
    phraseMatch,
    contiguousMatch,
    exactMatch,
    matchedTermCount: uniqueMatches,
    fieldWeights: {
      title: 0.18,
      sourceId: 0.08,
      documentId: 0.08,
      body: 0.56,
      phrase: 0.1,
      exact: 0.1,
    },
  };
  const score = Number(
    Math.min(
      1,
      bodyCoverage * 0.56 +
        titleCoverage * 0.18 +
        sourceCoverage * 0.08 +
        documentIdCoverage * 0.08 +
        (phraseMatch || contiguousMatch ? 0.1 : 0) +
        (exactMatch ? 0.1 : 0),
    ).toFixed(4),
  );
  const highlights = findHighlights(document.text, matchedTerms);

  return {
    id: `${document.sourceId}:${document.documentId}:chunk-1`,
    text: document.text,
    score,
    snippet: createSnippet(document.text, highlights),
    highlights,
    matchedTerms: Array.from(new Set(matchedTerms)),
    scoreBreakdown,
    document: toDocumentRef(document),
    citations: [
      {
        label: document.title,
        uri: document.uri,
        startOffset: 0,
        endOffset: document.text.length,
      },
    ],
    metadata: {
      matchedTerms: Array.from(new Set(matchedTerms)),
      retrievalMode: "keyword",
      normalizedTitle,
      normalizedSourceId,
      normalizedDocumentId,
      sourceTitle: document.sourceTitle,
    },
  };
}

export function compareChunks(left, right) {
  return (
    right.score - left.score ||
    Number(Boolean(right.scoreBreakdown?.exactMatch)) - Number(Boolean(left.scoreBreakdown?.exactMatch)) ||
    Number(Boolean(right.scoreBreakdown?.phraseMatch)) - Number(Boolean(left.scoreBreakdown?.phraseMatch)) ||
    Number(Boolean(right.scoreBreakdown?.contiguousMatch)) - Number(Boolean(left.scoreBreakdown?.contiguousMatch)) ||
    right.matchedTerms.length - left.matchedTerms.length ||
    String(left.document.title ?? "").localeCompare(String(right.document.title ?? "")) ||
    left.document.sourceId.localeCompare(right.document.sourceId) ||
    left.document.documentId.localeCompare(right.document.documentId)
  );
}

export function normalizeQuery(text) {
  return normalizeSearchText(text);
}

export function normalizeSearchText(text) {
  return String(text)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}:.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text) {
  return normalizeSearchText(text)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term && !STOPWORDS.has(term));
}

export function findHighlights(text, matchedTerms) {
  const lowerText = String(text).toLowerCase();
  const highlights = [];

  for (const term of Array.from(new Set(matchedTerms))) {
    const lowerTerm = term.toLowerCase();
    const startOffset = lowerText.indexOf(lowerTerm);

    if (startOffset === -1) {
      continue;
    }

    highlights.push({
      term,
      startOffset,
      endOffset: startOffset + lowerTerm.length,
    });
  }

  return highlights.sort((left, right) => left.startOffset - right.startOffset).slice(0, 8);
}

export function createSnippet(text, highlights) {
  const content = String(text);

  if (content.length <= 220) {
    return content;
  }

  const anchor = highlights[0]?.startOffset ?? 0;
  const start = Math.max(0, anchor - 80);
  const end = Math.min(content.length, anchor + 140);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";

  return `${prefix}${content.slice(start, end)}${suffix}`;
}

export function hasContiguousTerms(terms, queryTerms) {
  if (queryTerms.length === 0 || terms.length < queryTerms.length) {
    return false;
  }

  const uniqueQueryTerms = Array.from(new Set(queryTerms));

  for (let index = 0; index <= terms.length - uniqueQueryTerms.length; index += 1) {
    const window = terms.slice(index, index + uniqueQueryTerms.length);

    if (uniqueQueryTerms.every((term, termIndex) => window[termIndex] === term)) {
      return true;
    }
  }

  return false;
}

export function clampTopK(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_TOP_K;
  }

  return Math.max(1, Math.min(MAX_TOP_K, Math.trunc(parsed)));
}
