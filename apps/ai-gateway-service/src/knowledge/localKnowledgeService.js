import { createKnowledgePersistence } from "./knowledgePersistence.js";
import { createDeterministicEmbeddingProvider } from "./deterministicEmbeddingProvider.ts";
import { createSqliteVecStore } from "./sqliteVecStore.js";
import {
  isKnowledgeTenantScopeKey,
  resolveKnowledgeTenantScope,
} from "./knowledgeTenantScope.ts";
import {
  clampTopK,
  compareChunks,
  normalizeQuery,
  tokenize,
  toDocumentRef,
  toScoredChunk,
} from "./localKnowledgeRetrieval.js";

const DEFAULT_PHASE = "phase-21a-knowledge-entry";
const SYSTEM_QUERY_SCOPE = "knowledge-system:v1";
const DEFAULT_DOCUMENTS = [
  {
    sourceId: "unified-ai-system-defaults",
    documentId: "default-command-set",
    title: "PME 移动地球 frozen default command set",
    uri: "unified-ai-system://docs/default-command-set",
    text:
      "PME 移动地球 frozen default command set includes help:phase14a, dev:phase7b, status:phase10a, " +
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
      "The current PME 移动地球 AI Gateway baseline remains NVIDIA single provider only. The real-operation " +
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

export function createLocalKnowledgeService(options = {}) {
  const phase = options.phase ?? DEFAULT_PHASE;
  const persistence = createKnowledgePersistence(options);
  // Vector augmentation (KNOWLEDGE_INFRA_MODE=sqlite-vec)：零凭证确定性
  // embedding + 本地向量库；关键词基线行为不变。
  const vectorEnabled = options.vectorEnabled
    ?? String(options.env?.KNOWLEDGE_INFRA_MODE ?? "").trim().toLowerCase() === "sqlite-vec";
  if (options.embeddingProvider
    && options.embeddingProvider.credentialFree !== true
    && options.embeddingProvider.governedProviderOperation !== true) {
    throw Object.assign(
      new Error("External knowledge embeddings must enter the governed provider-operation lifecycle."),
      { code: "KNOWLEDGE_EMBEDDING_GOVERNANCE_REQUIRED", category: "configuration" },
    );
  }
  // The application path stays credential-free unless a caller injects an
  // already-governed provider. Environment credentials alone must never create
  // a direct external sink outside GatewayService billing/audit/dispatch.
  const embeddingProvider = options.embeddingProvider
    ?? (vectorEnabled ? createDeterministicEmbeddingProvider() : null);
  const externalEmbeddingConfigured = Boolean(
    String(options.env?.KNOWLEDGE_EMBEDDING_PROVIDER ?? "").trim(),
  );
  const externalEmbeddingBlocked = vectorEnabled
    && externalEmbeddingConfigured
    && !options.embeddingProvider;
  const vectorStore = options.vectorStore
    ?? (vectorEnabled ? createSqliteVecStore({
      dbPath: options.env?.KNOWLEDGE_SQLITE_VEC_PATH ?? ".data/knowledge/vectors.sqlite",
      dimension: embeddingProvider?.dimensions,
    }) : null);
  const vectorStoreReady = Boolean(vectorStore?.isAvailable?.());
  const defaultDocuments = normalizeDocuments(options.documents ?? DEFAULT_DOCUMENTS).map(markSystemDocument);
  const persistedDocuments = normalizeDocuments(persistence.loadDocuments())
    .filter((document) => isKnowledgeTenantScopeKey(document.tenantScopeKey))
    .map((document) => markUserDocument(document, document.tenantScopeKey));
  let documents = mergeDocuments(defaultDocuments, persistedDocuments);
  const embeddedDocumentKeys = new Set();

  // Best-effort vector upsert: embedding failures must never break loads.
  // 支持同步（确定性）与异步（HTTP 真实嵌入）两种 provider。
  async function upsertVectorsFor(documentsToEmbed, tenantScopeKey) {
    if (!vectorEnabled || !vectorStoreReady || !embeddingProvider) return;
    try {
      const texts = documentsToEmbed.map(
        (document) => `${document.title ?? ""}\n${document.text ?? ""}`,
      );
      const embeddings = await embedMany(embeddingProvider, texts);
      const payload = documentsToEmbed.map((document, index) => ({
        id: `kv:${tenantScopeKey}:${toDocumentKey(document)}`,
        sourceId: document.sourceId,
        title: document.title,
        content: document.text,
        metadata: { tenantScopeKey, systemDocument: !isUserDocument(document) },
        embedding: embeddings[index],
      }));
      if (payload.length > 0) {
        vectorStore.upsertDocuments(payload);
        for (const document of documentsToEmbed) {
          embeddedDocumentKeys.add(`${tenantScopeKey}:${toDocumentKey(document)}`);
        }
      }
    } catch {
      // 向量写回失败仅降级为关键词检索。
    }
  }

  async function embedMany(provider, texts) {
    if (typeof provider?.embedTexts === "function") {
      const vectors = await provider.embedTexts(texts);
      if (!Array.isArray(vectors) || vectors.length !== texts.length) {
        throw new Error("EMBEDDING_BATCH_SHAPE_INVALID");
      }
      return vectors;
    }
    return texts.map((text) => provider.embedText(text));
  }

  // Query result cache (LRU-like, max 100 entries, 5 minute TTL)
  const queryCache = new Map();
  const CACHE_MAX_SIZE = 100;
  const CACHE_TTL_MS = 5 * 60 * 1000;

  return {
    getHealth(context = {}) {
      const tenantScope = resolveKnowledgeTenantScope(context.tenantScopeIdentity);
      const visibleDocuments = selectVisibleDocuments(documents, tenantScope?.key);
      const visibleUserCount = visibleDocuments.filter(isUserDocument).length;
      const persistenceStatus = persistence.getStatus();

      return {
        status: "ready",
        phase,
        mode: vectorStoreReady ? "local-keyword+vector" : "local-keyword",
        storage: persistence.storageLabel,
        embedding: vectorStoreReady ? (embeddingProvider?.id ?? "not-configured") : "not-configured",
        embeddingGovernance: {
          externalConfigured: externalEmbeddingConfigured,
          externalActive: Boolean(
            options.embeddingProvider?.governedProviderOperation === true
            && embeddingProvider?.credentialFree !== true,
          ),
          externalBlocked: externalEmbeddingBlocked,
          reason: externalEmbeddingBlocked
            ? "Environment credentials cannot bypass the governed provider-operation lifecycle."
            : null,
        },
        sourceCount: new Set(visibleDocuments.map((document) => document.sourceId)).size,
        documentCount: visibleDocuments.length,
        chunkCount: visibleDocuments.length,
        supportedModes: ["keyword", ...(vectorStoreReady ? ["vector"] : [])],
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
        persistence: createScopedPersistenceStatus(persistenceStatus, visibleUserCount),
        providerBoundary: "knowledge is not a provider lane",
      };
    },

    listSources(context = {}) {
      const tenantScope = resolveKnowledgeTenantScope(context.tenantScopeIdentity);
      const sources = new Map();

      for (const document of selectVisibleDocuments(documents, tenantScope?.key)) {
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

    loadDocuments(request = {}, context = {}) {
      const tenantScope = resolveKnowledgeTenantScope(context.tenantScopeIdentity, { required: true });
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
      ).map((document) => markUserDocument(document, tenantScope.key));
      const loadedKeys = new Set(loadedDocuments.map((document) => toDocumentKey(document)));
      documents = [
        ...documents.filter((document) => !loadedKeys.has(toDocumentKey(document))),
        ...loadedDocuments,
      ];
      const persistedUserDocuments = documents.filter(
        (document) => isUserDocument(document) && isKnowledgeTenantScopeKey(document.tenantScopeKey),
      );
      persistence.saveDocuments(persistedUserDocuments);
      invalidateTenantQueryCache(queryCache, tenantScope.key);
      // 异步嵌入 provider 下不阻塞装载；失败按 best-effort 语义静默降级。
      Promise.resolve(upsertVectorsFor(loadedDocuments, tenantScope.key)).catch(() => {});
      const visibleDocuments = selectVisibleDocuments(documents, tenantScope.key);
      const visibleUserCount = visibleDocuments.filter(isUserDocument).length;

      return {
        phase,
        status: "loaded",
        sourceId,
        loadedCount: loadedDocuments.length,
        sourceCount: new Set(visibleDocuments.map((document) => document.sourceId)).size,
        documentCount: visibleDocuments.length,
        documents: loadedDocuments.map(toDocumentRef),
        persistence: createScopedPersistenceStatus(persistence.getStatus(), visibleUserCount),
      };
    },

    async retrieve(request = {}, context = {}) {
      const tenantScope = resolveKnowledgeTenantScope(context.tenantScopeIdentity);
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

      if (mode !== "keyword" && mode !== "vector") {
        const error = new Error(`Knowledge retrieve mode '${mode}' is not supported by the local knowledge baseline.`);
        error.code = "KNOWLEDGE_MODE_NOT_SUPPORTED";
        error.category = "knowledge";
        error.details = {
          supportedModes: ["keyword", ...(vectorStoreReady ? ["vector"] : [])],
        };
        throw error;
      }
      if (mode === "vector" && !vectorStoreReady) {
        const error = new Error("Vector retrieval requires KNOWLEDGE_INFRA_MODE=sqlite-vec with an available vector store.");
        error.code = "KNOWLEDGE_VECTOR_STORE_UNAVAILABLE";
        error.category = "knowledge";
        error.details = {
          supportedModes: ["keyword", ...(vectorStoreReady ? ["vector"] : [])],
        };
        throw error;
      }

      // Check cache
      const cacheScope = tenantScope?.key ?? SYSTEM_QUERY_SCOPE;
      const cacheKey = `${cacheScope}:${mode}:${normalizedQuery}:${(request.sourceIds || []).join(",")}:${request.topK || "default"}:${request.minScore || 0}`;
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
      const visibleDocuments = selectVisibleDocuments(documents, tenantScope?.key);
      const visibleUserCount = visibleDocuments.filter(isUserDocument).length;
      const candidates = visibleDocuments.filter((document) => !sourceIds || sourceIds.has(document.sourceId));

      function vectorOwnerScope(document) {
        return isUserDocument(document) && isKnowledgeTenantScopeKey(document.tenantScopeKey)
          ? document.tenantScopeKey
          : "system";
      }

      let chunks;
      if (mode === "vector") {
        // 懒嵌入：把尚未入向量库的可见文档按归属域（system/租户）分组写入。
        const pendingByScope = new Map();
        for (const document of candidates) {
          const ownerScope = vectorOwnerScope(document);
          const embeddedKey = `${ownerScope}:${toDocumentKey(document)}`;
          if (embeddedDocumentKeys.has(embeddedKey)) continue;
          const bucket = pendingByScope.get(ownerScope) ?? [];
          bucket.push(document);
          pendingByScope.set(ownerScope, bucket);
        }
        for (const [scope, pendingDocuments] of pendingByScope) {
          await upsertVectorsFor(pendingDocuments, scope);
        }

        const [queryEmbedding] = await embedMany(embeddingProvider, [query]);
        const rawResults = vectorStore.query(queryEmbedding, {
          topK: Math.max(topK * 3, topK),
          ...(sourceIds ? { sourceIds: [...sourceIds] } : {}),
        });
        // 租户安全：向量结果必须落在当前可见文档白名单内。
        const allowedByKey = new Map(
          candidates.map((document) => [`kv:${vectorOwnerScope(document)}:${toDocumentKey(document)}`, document]),
        );
        chunks = rawResults
          .filter((result) => allowedByKey.has(result.documentId))
          .map((result) => {
            const document = allowedByKey.get(result.documentId);
            const chunk = toScoredChunk(document, { normalizedQuery, queryTerms });
            return {
              ...chunk,
              score: Number(result.score.toFixed(4)),
              vector: {
                embeddingId: embeddingProvider.id,
                cosineSimilarity: result.score,
              },
            };
          })
          .filter((chunk) => chunk.score > minScore)
          .sort((a, b) => b.score - a.score)
          .slice(0, topK)
          .map((chunk, index) => ({
            ...chunk,
            rank: index + 1,
          }));
      } else {
        chunks = candidates
          .map((document) => toScoredChunk(document, { normalizedQuery, queryTerms }))
          .filter((chunk) => chunk.score > minScore)
          .sort(compareChunks)
          .slice(0, topK)
          .map((chunk, index) => ({
            ...chunk,
            rank: index + 1,
          }));
      }

      const result = {
        query,
        normalizedQuery,
        mode,
        chunks,
        topHit: chunks[0] ?? null,
        topChunk: chunks[0] ?? null,
        topDocument: chunks[0]?.document ?? null,
        traceId: request.context?.traceId,
        metadata: {
          phase,
          storage: persistence.storageLabel,
          embedding: "not-configured",
          persistence: createScopedPersistenceStatus(persistence.getStatus(), visibleUserCount),
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
    deleteDocument(documentId, context = {}) {
      const tenantScope = resolveKnowledgeTenantScope(context.tenantScopeIdentity, { required: true });
      const normalizedDocumentId = normalizeRequiredString(documentId, "Knowledge delete documentId is required.");
      const beforeCount = documents.length;
      documents = documents.filter((document) => {
        return !(
          isUserDocument(document)
          && document.tenantScopeKey === tenantScope.key
          && document.documentId === normalizedDocumentId
        );
      });
      const deletedCount = beforeCount - documents.length;
      persistence.saveDocuments(documents.filter(
        (document) => isUserDocument(document) && isKnowledgeTenantScopeKey(document.tenantScopeKey),
      ));
      invalidateTenantQueryCache(queryCache, tenantScope.key);
      const visibleDocuments = selectVisibleDocuments(documents, tenantScope.key);

      return {
        status: deletedCount > 0 ? "deleted" : "not-found",
        documentId: normalizedDocumentId,
        deletedCount,
        remainingCount: visibleDocuments.length,
      };
    },
    close() {
      persistence.close();
    },
  };
}

function normalizeDocuments(documents) {
  return documents.map((document, index) => ({
    sourceId: document.sourceId ?? "default",
    sourceTitle: document.sourceTitle,
    documentId: document.documentId ?? `document-${index + 1}`,
    title: document.title ?? `Document ${index + 1}`,
    uri: document.uri,
    text: String(document.text ?? document.content ?? ""),
    metadata: document.metadata ?? {},
    tenantScopeKey: document.tenantScopeKey,
  }));
}

function markSystemDocument(document) {
  return {
    ...document,
    persistenceScope: "system",
  };
}

function markUserDocument(document, tenantScopeKey) {
  if (!isKnowledgeTenantScopeKey(tenantScopeKey)) {
    const error = new Error("Knowledge user document is missing its server-derived tenant scope.");
    error.code = "KNOWLEDGE_DOCUMENT_TENANT_SCOPE_REQUIRED";
    error.category = "authorization";
    error.status = 403;
    throw error;
  }

  return {
    ...document,
    persistenceScope: "user",
    tenantScopeKey,
  };
}

function isUserDocument(document) {
  return document.persistenceScope === "user";
}

function mergeDocuments(baseDocuments, extraDocuments) {
  const merged = new Map();

  for (const document of [...baseDocuments, ...extraDocuments]) {
    merged.set(toDocumentKey(document), document);
  }

  return Array.from(merged.values());
}

function normalizeRequiredString(value, message) {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!normalized) {
    const error = new Error(message);
    error.code = "KNOWLEDGE_LOAD_VALIDATION_ERROR";
    error.category = "validation";
    throw error;
  }

  return normalized;
}

function normalizeOptionalString(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

function toDocumentKey(document) {
  const ownerScope = document.persistenceScope === "system"
    ? SYSTEM_QUERY_SCOPE
    : document.tenantScopeKey ?? "knowledge-unscoped";
  return `${ownerScope}:${document.sourceId}:${document.documentId}`;
}

function selectVisibleDocuments(documents, tenantScopeKey) {
  return documents.filter((document) => {
    if (document.persistenceScope === "system") {
      return true;
    }

    return Boolean(tenantScopeKey) && document.tenantScopeKey === tenantScopeKey;
  });
}

function invalidateTenantQueryCache(queryCache, tenantScopeKey) {
  const prefix = `${tenantScopeKey}:`;
  for (const cacheKey of queryCache.keys()) {
    if (cacheKey.startsWith(prefix)) {
      queryCache.delete(cacheKey);
    }
  }
}

function createScopedPersistenceStatus(status, visibleUserCount) {
  return {
    ...status,
    file: status.file
      ? {
          ...status.file,
          ...(Object.hasOwn(status.file, "documentCount") ? { documentCount: visibleUserCount } : {}),
        }
      : status.file,
    sqlite: status.sqlite
      ? {
          ...status.sqlite,
          ...(Object.hasOwn(status.sqlite, "documentCount") ? { documentCount: visibleUserCount } : {}),
        }
      : status.sqlite,
  };
}
