import { createKnowledgePersistence } from "./knowledgePersistence.js";
import {
  DEFAULT_PHASE,
  DEFAULT_DOCUMENTS,
  normalizeDocuments,
  markSystemDocument,
  markUserDocument,
  isUserDocument,
  mergeDocuments,
  normalizeRequiredString,
  normalizeOptionalString,
  toDocumentKey,
  toDocumentRef,
  toScoredChunk,
  compareChunks,
  normalizeQuery,
  tokenize,
  clampTopK,
} from "./localKnowledgeHelpers.js";

export function createLocalKnowledgeService(options = {}) {
  const phase = options.phase ?? DEFAULT_PHASE;
  const persistence = createKnowledgePersistence(options);
  const defaultDocuments = normalizeDocuments(options.documents ?? DEFAULT_DOCUMENTS).map(markSystemDocument);
  const persistedDocuments = normalizeDocuments(persistence.loadDocuments()).map(markUserDocument);
  let documents = mergeDocuments(defaultDocuments, persistedDocuments);

  // Query result cache (LRU-like, max 100 entries, 5 minute TTL)
  const queryCache = new Map();
  const CACHE_MAX_SIZE = 100;
  const CACHE_TTL_MS = 5 * 60 * 1000;

  return {
    getHealth() {
      const persistenceStatus = persistence.getStatus();

      return {
        status: "ready",
        phase,
        mode: "local-keyword",
        storage: persistence.storageLabel,
        embedding: "not-configured",
        sourceCount: new Set(documents.map((document) => document.sourceId)).size,
        documentCount: documents.length,
        chunkCount: documents.length,
        supportedModes: ["keyword"],
        quality: {
          queryNormalization: "unicode-nfkc-lowercase-collapse",
          ranking: "weighted-keyword-v2",
          snippets: true,
          highlights: true,
          stopwords: true,
          fieldWeights: {
            title: 0.18,
            sourceId: 0.08,
            documentId: 0.08,
            body: 0.56,
            phrase: 0.1,
          },
        },
        persistence: persistenceStatus,
        providerBoundary: "knowledge is not a provider lane",
      };
    },

    listSources() {
      const sources = new Map();

      for (const document of documents) {
        const source = sources.get(document.sourceId) ?? {
          sourceId: document.sourceId,
          title: document.sourceTitle ?? document.sourceId,
          documentCount: 0,
          documents: [],
        };

        source.documentCount += 1;
        source.documents.push(toDocumentRef(document));
        sources.set(document.sourceId, source);
      }

      return {
        phase,
        sources: Array.from(sources.values()),
      };
    },

    loadDocuments(request = {}) {
      const sourceId = normalizeRequiredString(request.sourceId, "Knowledge load sourceId is required.");
      const sourceTitle = normalizeOptionalString(request.sourceTitle);
      const inputDocuments = Array.isArray(request.documents) ? request.documents : [];

      if (inputDocuments.length === 0) {
        const error = new Error("Knowledge load documents must contain at least one document.");
        error.code = "KNOWLEDGE_LOAD_DOCUMENTS_REQUIRED";
        error.category = "validation";
        throw error;
      }

      const loadedDocuments = normalizeDocuments(
        inputDocuments.map((document, index) => ({
          sourceId,
          sourceTitle,
          documentId: document.documentId ?? `loaded-document-${index + 1}`,
          title: document.title,
          uri: document.uri,
          text: document.text ?? document.content ?? document.body,
          metadata: {
            ...(request.metadata ?? {}),
            ...(document.metadata ?? {}),
          },
        })),
      ).map(markUserDocument);
      const loadedKeys = new Set(loadedDocuments.map((document) => toDocumentKey(document)));
      documents = [
        ...documents.filter((document) => !loadedKeys.has(toDocumentKey(document))),
        ...loadedDocuments,
      ];
      persistence.saveDocuments(documents.filter(isUserDocument));

      return {
        phase,
        status: "loaded",
        sourceId,
        loadedCount: loadedDocuments.length,
        sourceCount: new Set(documents.map((document) => document.sourceId)).size,
        documentCount: documents.length,
        documents: loadedDocuments.map(toDocumentRef),
        persistence: persistence.getStatus(),
      };
    },

    retrieve(request = {}) {
      const rawQuery = typeof request.query === "string" ? request.query : "";
      const query = rawQuery.trim();
      const normalizedQuery = normalizeQuery(rawQuery);

      if (!normalizedQuery) {
        const error = new Error("Knowledge retrieve query is required.");
        error.code = "KNOWLEDGE_QUERY_REQUIRED";
        error.category = "validation";
        throw error;
      }

      const mode = request.mode ?? "keyword";

      if (mode !== "keyword") {
        const error = new Error(`Knowledge retrieve mode '${mode}' is not supported by the local keyword baseline.`);
        error.code = "KNOWLEDGE_MODE_NOT_SUPPORTED";
        error.category = "knowledge";
        error.details = {
          supportedModes: ["keyword"],
        };
        throw error;
      }

      // Check cache
      const cacheKey = `${normalizedQuery}:${(request.sourceIds || []).join(",")}:${request.topK || "default"}:${request.minScore || 0}`;
      const cached = queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return { ...cached.result, metadata: { ...cached.result.metadata, cacheHit: true } };
      }

      const sourceIds = Array.isArray(request.sourceIds)
        ? new Set(request.sourceIds.filter((sourceId) => typeof sourceId === "string"))
        : null;
      const queryTerms = tokenize(normalizedQuery);
      const topK = clampTopK(request.topK);
      const minScore = Number.isFinite(Number(request.minScore)) ? Number(request.minScore) : 0;
      const candidates = documents.filter((document) => !sourceIds || sourceIds.has(document.sourceId));
      const chunks = candidates
        .map((document) => toScoredChunk(document, { normalizedQuery, queryTerms }))
        .filter((chunk) => chunk.score > minScore)
        .sort(compareChunks)
        .slice(0, topK)
        .map((chunk, index) => ({
          ...chunk,
          rank: index + 1,
        }));

      const result = {
        query,
        normalizedQuery,
        mode: "keyword",
        chunks,
        topHit: chunks[0] ?? null,
        topChunk: chunks[0] ?? null,
        topDocument: chunks[0]?.document ?? null,
        traceId: request.context?.traceId,
        metadata: {
          phase,
          storage: persistence.storageLabel,
          embedding: "not-configured",
          persistence: persistence.getStatus(),
          queryNormalization: "unicode-nfkc-lowercase-collapse",
          ranking: "weighted-keyword-v2",
          snippet: "first-match-window",
          stopwordsApplied: true,
          requestedMode: mode,
          sourceFilterApplied: Boolean(sourceIds),
          candidateCount: candidates.length,
          resultCount: chunks.length,
          requestedTopK: topK,
          cacheHit: false,
        },
      };

      // Store in cache
      if (queryCache.size >= CACHE_MAX_SIZE) {
        const oldestKey = queryCache.keys().next().value;
        queryCache.delete(oldestKey);
      }
      queryCache.set(cacheKey, { result, timestamp: Date.now() });

      return result;
    },

    deleteDocument(docId) {
      if (!docId || typeof docId !== "string") {
        const error = new Error("Knowledge delete requires a valid documentId.");
        error.code = "KNOWLEDGE_DELETE_DOCID_REQUIRED";
        error.category = "validation";
        throw error;
      }
      const beforeCount = documents.length;
      documents = documents.filter((document) => toDocumentKey(document) !== docId);
      const deleted = beforeCount - documents.length;
      if (deleted === 0) {
        const error = new Error(`Document '${docId}' not found.`);
        error.code = "KNOWLEDGE_DOCUMENT_NOT_FOUND";
        error.category = "knowledge";
        throw error;
      }
      persistence.saveDocuments(documents.filter(isUserDocument));
      return {
        phase,
        status: "deleted",
        documentId: docId,
        remainingCount: documents.length,
      };
    },

    close() {
      persistence.close();
    },
  };
}
