import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createPinoLogger } from "../logging/pinoLogger.js";
import { isKnowledgeTenantScopeKey } from "./knowledgeTenantScope.ts";

const require = createRequire(import.meta.url);
const logger = createPinoLogger({ app: "knowledgePersistence" });

const STORAGE_MEMORY = "memory";
const STORAGE_FILE = "file";
const STORAGE_SQLITE = "sqlite";
const STORAGE_FILE_SQLITE = "file-sqlite";
const DEFAULT_PERSISTENCE_DIR = ".data/knowledge";
const DEFAULT_FILE_NAME = "knowledge-documents.json";
const DEFAULT_SQLITE_NAME = "knowledge-documents.sqlite";

export function createKnowledgePersistence(options = {}) {
  const mode = normalizeStorageMode(options.storageMode ?? options.env?.KNOWLEDGE_STORAGE_MODE);

  if (mode === STORAGE_MEMORY) {
    return createMemoryPersistence();
  }

  const persistenceDir = resolvePath(options.persistenceDir ?? options.env?.KNOWLEDGE_PERSISTENCE_DIR ?? DEFAULT_PERSISTENCE_DIR);
  const filePath = resolvePath(options.fileStorePath ?? options.env?.KNOWLEDGE_FILE_STORE_PATH ?? resolve(persistenceDir, DEFAULT_FILE_NAME));
  const sqlitePath = resolvePath(options.sqlitePath ?? options.env?.KNOWLEDGE_SQLITE_PATH ?? resolve(persistenceDir, DEFAULT_SQLITE_NAME));
  const fileEnabled = mode === STORAGE_FILE || mode === STORAGE_FILE_SQLITE;
  const sqliteEnabled = mode === STORAGE_SQLITE || mode === STORAGE_FILE_SQLITE;
  const sqlite = sqliteEnabled ? createSqlitePersistence(sqlitePath) : null;

  return {
    mode,
    storageLabel: mode,

    loadDocuments() {
      const loaded = [];

      if (fileEnabled) {
        loaded.push(...readFileDocuments(filePath));
      }

      if (sqlite) {
        loaded.push(...sqlite.loadDocuments());
      }

      return mergeDocumentsByKey(loaded);
    },

    saveDocuments(documents) {
      const scopedDocuments = assertTenantScopedDocuments(documents);

      if (fileEnabled) {
        writeFileDocuments(filePath, scopedDocuments);
      }

      if (sqlite) {
        sqlite.saveDocuments(scopedDocuments);
      }
    },

    getStatus() {
      return {
        mode,
        durable: true,
        file: fileEnabled
          ? {
              enabled: true,
              path: filePath,
              status: "configured",
              documentCount: readFileDocuments(filePath).length,
            }
          : {
              enabled: false,
              status: "disabled",
            },
        sqlite: sqlite
          ? sqlite.getStatus()
          : {
              enabled: false,
              status: sqliteEnabled ? "unavailable" : "disabled",
              path: sqliteEnabled ? sqlitePath : null,
            },
        vector: {
          enabledBy: "KNOWLEDGE_INFRA_MODE=vector",
          store: "pgvector",
          note: "Vector storage remains an explicit configured path and is verified by verify:phase23.",
        },
      };
    },

    close() {
      sqlite?.close();
    },
  };
}

function createMemoryPersistence() {
  return {
    mode: STORAGE_MEMORY,
    storageLabel: "in-memory",
    loadDocuments() {
      return [];
    },
    saveDocuments(documents) {
      assertTenantScopedDocuments(documents);
    },
    getStatus() {
      return {
        mode: STORAGE_MEMORY,
        durable: false,
        file: {
          enabled: false,
          status: "disabled",
        },
        sqlite: {
          enabled: false,
          status: "disabled",
        },
        vector: {
          enabledBy: "KNOWLEDGE_INFRA_MODE=vector",
          store: "pgvector",
          note: "Vector storage remains an explicit configured path and is verified by verify:phase23.",
        },
      };
    },
    close() {},
  };
}

function createSqlitePersistence(sqlitePath) {
  let DatabaseSync;
  let db;

  try {
    ({ DatabaseSync } = require("node:sqlite"));
    ensureParentDir(sqlitePath);
    db = new DatabaseSync(sqlitePath);
    db.exec(`
      create table if not exists knowledge_documents_v2 (
        tenant_scope_key text not null,
        source_id text not null,
        document_id text not null,
        title text,
        uri text,
        text text not null,
        source_title text,
        metadata_json text,
        updated_at text not null,
        primary key (tenant_scope_key, source_id, document_id)
      )
    `);
  } catch (error) {
    return {
      loadDocuments() {
        return [];
      },
      saveDocuments() {
        const wrapped = new Error(`SQLite knowledge persistence is unavailable: ${error instanceof Error ? error.message : String(error)}`);
        wrapped.code = "KNOWLEDGE_SQLITE_PERSISTENCE_UNAVAILABLE";
        wrapped.category = "knowledge";
        throw wrapped;
      },
      getStatus() {
        return {
          enabled: true,
          path: sqlitePath,
          status: "unavailable",
          experimental: true,
          documentCount: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      },
      close() {},
    };
  }

  return {
    loadDocuments() {
      const rows = db.prepare(`
        select tenant_scope_key, source_id, document_id, title, uri, text, source_title, metadata_json
        from knowledge_documents_v2
        order by tenant_scope_key asc, source_id asc, document_id asc
      `).all();

      return rows
        .map((row) => ({
          tenantScopeKey: row.tenant_scope_key,
          sourceId: row.source_id,
          documentId: row.document_id,
          title: row.title,
          uri: row.uri,
          text: row.text,
          sourceTitle: row.source_title,
          metadata: parseMetadata(row.metadata_json),
        }))
        .filter((document) => isKnowledgeTenantScopeKey(document.tenantScopeKey));
    },

    saveDocuments(documents) {
      db.exec("begin immediate transaction");

      try {
        db.exec("delete from knowledge_documents_v2");
        const insert = db.prepare(`
          insert into knowledge_documents_v2 (
            tenant_scope_key,
            source_id,
            document_id,
            title,
            uri,
            text,
            source_title,
            metadata_json,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const updatedAt = new Date().toISOString();

        for (const document of documents) {
          insert.run(
            document.tenantScopeKey,
            document.sourceId,
            document.documentId,
            document.title ?? null,
            document.uri ?? null,
            document.text,
            document.sourceTitle ?? null,
            JSON.stringify(document.metadata ?? {}),
            updatedAt,
          );
        }

        db.exec("commit");
      } catch (error) {
        db.exec("rollback");
        throw error;
      }
    },

    getStatus() {
      const row = db.prepare("select count(*) as document_count from knowledge_documents_v2").get();

      return {
        enabled: true,
        path: sqlitePath,
        status: "configured",
        experimental: true,
        documentCount: Number(row?.document_count ?? 0),
      };
    },

    close() {
      db.close();
    },
  };
}

function readFileDocuments(filePath) {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    const documents = Array.isArray(parsed?.documents) ? parsed.documents : [];

    return documents
      .map((document) => ({
        tenantScopeKey: document.tenantScopeKey,
        sourceId: document.sourceId,
        documentId: document.documentId,
        title: document.title,
        uri: document.uri,
        text: document.text,
        sourceTitle: document.sourceTitle,
        metadata: document.metadata ?? {},
      }))
      .filter((document) => isKnowledgeTenantScopeKey(document.tenantScopeKey));
  } catch (error) {
    logger.warn({
      event: "knowledge_file_parse_failed",
      err: error,
    }, "Knowledge persistence file could not be parsed.");
    return [];
  }
}

function writeFileDocuments(filePath, documents) {
  ensureParentDir(filePath);
  writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        version: 2,
        updatedAt: new Date().toISOString(),
        documents: documents.map((document) => ({
          tenantScopeKey: document.tenantScopeKey,
          sourceId: document.sourceId,
          sourceTitle: document.sourceTitle,
          documentId: document.documentId,
          title: document.title,
          uri: document.uri,
          text: document.text,
          metadata: document.metadata ?? {},
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function mergeDocumentsByKey(documents) {
  const merged = new Map();

  for (const document of documents) {
    if (!isKnowledgeTenantScopeKey(document?.tenantScopeKey) || !document?.sourceId || !document?.documentId) {
      continue;
    }

    merged.set(`${document.tenantScopeKey}:${document.sourceId}:${document.documentId}`, document);
  }

  return Array.from(merged.values());
}

function assertTenantScopedDocuments(documents) {
  if (!Array.isArray(documents)) {
    throw createTenantScopePersistenceError();
  }

  for (const document of documents) {
    if (!isKnowledgeTenantScopeKey(document?.tenantScopeKey)) {
      throw createTenantScopePersistenceError();
    }
  }

  return documents;
}

function createTenantScopePersistenceError() {
  const error = new Error("Knowledge persistence requires a server-derived tenant scope for every document.");
  error.code = "KNOWLEDGE_PERSISTENCE_TENANT_SCOPE_REQUIRED";
  error.category = "authorization";
  error.status = 403;
  return error;
}

function normalizeStorageMode(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

  if ([STORAGE_FILE, STORAGE_SQLITE, STORAGE_FILE_SQLITE].includes(normalized)) {
    return normalized;
  }

  return STORAGE_MEMORY;
}

function resolvePath(value) {
  return resolve(String(value));
}

function ensureParentDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function parseMetadata(value) {
  try {
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
