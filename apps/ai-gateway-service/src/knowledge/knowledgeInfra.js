const DEFAULT_MODE = "local-keyword";
const VECTOR_MODE = "vector";
const SQLITE_VEC_MODE = "sqlite-vec";

export function createKnowledgeInfra(env = process.env) {
  const mode = normalizeMode(env.KNOWLEDGE_INFRA_MODE);
  const vectorEnabled = mode === VECTOR_MODE;
  const sqliteVecEnabled = mode === SQLITE_VEC_MODE;

  return {
    getReadiness() {
      const embedding = createEmbeddingReadiness(env, vectorEnabled);
      const vectorStore = createVectorStoreReadiness(env, vectorEnabled);
      const pgvector = createPgvectorReadiness(env, vectorEnabled, vectorStore);
      const sqliteVec = createSqliteVecReadiness(env, sqliteVecEnabled);
      const blockers = createProductionBlockers({
        vectorEnabled,
        sqliteVecEnabled,
        embedding,
        vectorStore,
        pgvector,
        sqliteVec,
      });

      return {
        mode,
        defaultMode: DEFAULT_MODE,
        enabled: vectorEnabled || sqliteVecEnabled,
        status: resolveReadinessStatus({ vectorEnabled, sqliteVecEnabled, embedding, vectorStore, sqliteVec }),
        productionReady: blockers.length === 0,
        blockers,
        config: {
          modeEnv: "KNOWLEDGE_INFRA_MODE",
          embeddingProviderEnv: "KNOWLEDGE_EMBEDDING_PROVIDER",
          embeddingModelEnv: "KNOWLEDGE_EMBEDDING_MODEL",
          embeddingApiKeyEnv: "KNOWLEDGE_EMBEDDING_API_KEY",
          embeddingBaseUrlEnv: "KNOWLEDGE_EMBEDDING_BASE_URL",
          vectorStoreEnv: "KNOWLEDGE_VECTOR_STORE",
          pgvectorConnectionStringEnv: "PGVECTOR_CONNECTION_STRING",
          pgvectorTableEnv: "PGVECTOR_TABLE",
          namespaceEnv: "KNOWLEDGE_VECTOR_NAMESPACE",
        },
        embedding,
        vectorStore,
        pgvector,
        sqliteVec,
        interfaces: {
          embeddingProvider: {
            name: "KnowledgeEmbeddingProvider",
            methods: ["embedText"],
          },
          vectorStore: {
            name: "KnowledgeVectorStore",
            methods: ["upsertDocuments", "query", "getReadiness"],
          },
          sqliteVecStore: {
            name: "SqliteVecStore",
            methods: ["upsertDocument", "upsertDocuments", "query", "deleteDocument", "getDocumentCount", "close"],
          },
        },
        notes: sqliteVecEnabled
          ? "SQLite-vec mode enabled: lightweight local vector storage without external database."
          : vectorEnabled
            ? "Vector infra is config-gated and requires explicit embedding/vector store configuration."
            : "Next-gen knowledge infra is off by default; local keyword retrieval is active.",
      };
    },
  };
}

function normalizeMode(value) {
  if (value === VECTOR_MODE) return VECTOR_MODE;
  if (value === SQLITE_VEC_MODE) return SQLITE_VEC_MODE;
  return DEFAULT_MODE;
}

function createEmbeddingReadiness(env, vectorEnabled) {
  if (!vectorEnabled) {
      return {
        id: "disabled",
        status: "disabled",
        configured: false,
      reason: "KNOWLEDGE_INFRA_MODE is not vector.",
    };
  }

  const id = normalizeOptional(env.KNOWLEDGE_EMBEDDING_PROVIDER);
  const model = normalizeOptional(env.KNOWLEDGE_EMBEDDING_MODEL);
  const baseUrl = normalizeOptional(env.KNOWLEDGE_EMBEDDING_BASE_URL);
  const apiKeyPresent = Boolean(normalizeOptional(env.KNOWLEDGE_EMBEDDING_API_KEY));

  if (!id || !model || !apiKeyPresent) {
    return {
      id: id ?? "not-configured",
      status: "not-configured",
      configured: false,
      model,
      baseUrlPresent: Boolean(baseUrl),
      apiKeyPresent,
      reason: "KNOWLEDGE_EMBEDDING_PROVIDER, KNOWLEDGE_EMBEDDING_MODEL, and KNOWLEDGE_EMBEDDING_API_KEY are required for vector mode.",
    };
  }

  return {
    id,
    status: "configured",
    configured: true,
    model,
    baseUrlPresent: Boolean(baseUrl),
    apiKeyPresent,
    reason: "Embedding provider config is present; no external embedding call is made in this phase.",
  };
}

function createVectorStoreReadiness(env, vectorEnabled) {
  if (!vectorEnabled) {
    return {
      id: "disabled",
      status: "disabled",
      configured: false,
      reason: "KNOWLEDGE_INFRA_MODE is not vector.",
    };
  }

  const id = normalizeOptional(env.KNOWLEDGE_VECTOR_STORE);
  const namespace = normalizeOptional(env.KNOWLEDGE_VECTOR_NAMESPACE) ?? "default";

  if (!id) {
    return {
      id: "not-configured",
      status: "not-configured",
      configured: false,
      namespace,
      reason: "KNOWLEDGE_VECTOR_STORE is required for vector mode.",
    };
  }

  return {
    id,
    status: "configured",
    configured: true,
    namespace,
    reason: "Vector store config is present; no external vector query is made in this phase.",
  };
}

function createPgvectorReadiness(env, vectorEnabled, vectorStore) {
  if (!vectorEnabled) {
    return {
      status: "disabled",
      configured: false,
      reason: "KNOWLEDGE_INFRA_MODE is not vector.",
    };
  }

  if (vectorStore.id !== "pgvector") {
    return {
      status: "disabled",
      configured: false,
      reason: "KNOWLEDGE_VECTOR_STORE is not pgvector.",
    };
  }

  const connectionStringPresent = Boolean(normalizeOptional(env.PGVECTOR_CONNECTION_STRING));
  const table = normalizeOptional(env.PGVECTOR_TABLE) ?? "knowledge_chunks";

  return {
    status: connectionStringPresent ? "configured" : "not-configured",
    configured: connectionStringPresent,
    connectionStringPresent,
    table,
    reason: connectionStringPresent
      ? "pgvector config is present; external readiness probe is not executed without an explicit future mainline."
      : "PGVECTOR_CONNECTION_STRING is required for pgvector mode.",
  };
}

function resolveReadinessStatus({ vectorEnabled, sqliteVecEnabled, embedding, vectorStore, sqliteVec }) {
  if (sqliteVecEnabled) {
    return sqliteVec?.status === "ready" ? "ready" : "not-configured";
  }

  if (!vectorEnabled) {
    return "disabled";
  }

  if (embedding.status === "configured" && vectorStore.status === "configured") {
    return "not-ready";
  }

  return "not-configured";
}

function createSqliteVecReadiness(env, sqliteVecEnabled) {
  if (!sqliteVecEnabled) {
    return {
      status: "disabled",
      configured: false,
      reason: "KNOWLEDGE_INFRA_MODE is not sqlite-vec.",
    };
  }

  return {
    status: "ready",
    configured: true,
    dbPath: ".data/knowledge/vectors.sqlite",
    reason: "SQLite-vec is ready for local vector storage without external database.",
  };
}

function createProductionBlockers({ vectorEnabled, sqliteVecEnabled, embedding, vectorStore, pgvector, sqliteVec }) {
  const blockers = [];

  if (sqliteVecEnabled) {
    // SQLite-vec has no blockers - it's self-contained
    return blockers;
  }

  if (!vectorEnabled) {
    blockers.push("KNOWLEDGE_INFRA_MODE is not vector.");
  }

  if (embedding.status !== "configured") {
    blockers.push("Embedding provider/model/API key are not fully configured.");
  }

  if (vectorStore.id !== "pgvector") {
    blockers.push("KNOWLEDGE_VECTOR_STORE is not pgvector.");
  }

  if (pgvector.status !== "configured") {
    blockers.push("PGVECTOR_CONNECTION_STRING is not configured.");
  }

  if (
    vectorEnabled &&
    embedding.status === "configured" &&
    vectorStore.id === "pgvector" &&
    pgvector.status === "configured"
  ) {
    blockers.push("Real embedding plus pgvector write/read/retrieve probe has not completed.");
  }

  return blockers;
}

function normalizeOptional(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}
