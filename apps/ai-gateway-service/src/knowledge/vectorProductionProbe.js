import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const PSQL_FIELD_SEPARATOR = "~";
const DEFAULT_QUERY = "phase23 exact quality ranking boost 中文 marker";

export async function runVectorProductionProbe(env, options = {}) {
  const embeddingProvider = normalizeOptional(env.KNOWLEDGE_EMBEDDING_PROVIDER);
  const embeddingModel = normalizeOptional(env.KNOWLEDGE_EMBEDDING_MODEL);
  const embeddingApiKey = normalizeOptional(env.KNOWLEDGE_EMBEDDING_API_KEY);
  const embeddingBaseUrl = normalizeOptional(env.KNOWLEDGE_EMBEDDING_BASE_URL) ?? DEFAULT_GEMINI_BASE_URL;
  const vectorStore = normalizeOptional(env.KNOWLEDGE_VECTOR_STORE);
  const connectionString = normalizeOptional(env.PGVECTOR_CONNECTION_STRING);
  const configuredTable = normalizeIdentifier(
    normalizeOptional(env.PGVECTOR_TABLE) ?? "knowledge_chunks",
    "PGVECTOR_TABLE",
  );
  const namespace = normalizeOptional(env.KNOWLEDGE_VECTOR_NAMESPACE) ?? "default";
  const query = options.query ?? DEFAULT_QUERY;
  const documents = options.documents ?? [];

  if (embeddingProvider !== "gemini") {
    return {
      ready: false,
      provider: embeddingProvider ?? null,
      model: embeddingModel ?? null,
      vectorStore: vectorStore ?? null,
      blocker: "Only gemini embedding is implemented for the Phase 23 real vector probe.",
    };
  }

  if (!embeddingModel || !embeddingApiKey) {
    return {
      ready: false,
      provider: embeddingProvider,
      model: embeddingModel ?? null,
      vectorStore: vectorStore ?? null,
      blocker: "Embedding provider/model/API key are not fully configured for the real vector probe.",
    };
  }

  if (vectorStore !== "pgvector") {
    return {
      ready: false,
      provider: embeddingProvider,
      model: embeddingModel,
      vectorStore: vectorStore ?? null,
      blocker: "KNOWLEDGE_VECTOR_STORE must be pgvector for the real vector probe.",
    };
  }

  if (!connectionString) {
    return {
      ready: false,
      provider: embeddingProvider,
      model: embeddingModel,
      vectorStore,
      blocker: "PGVECTOR_CONNECTION_STRING is required for the real vector probe.",
    };
  }

  try {
    const embeddedDocuments = [];

    for (const document of documents) {
      const embedding = await embedWithGemini({
        apiKey: embeddingApiKey,
        baseUrl: embeddingBaseUrl,
        model: embeddingModel,
        taskType: "RETRIEVAL_DOCUMENT",
        text: document.content,
        title: document.title,
      });
      embeddedDocuments.push({
        ...document,
        embedding,
      });
    }

    const queryEmbedding = await embedWithGemini({
      apiKey: embeddingApiKey,
      baseUrl: embeddingBaseUrl,
      model: embeddingModel,
      taskType: "RETRIEVAL_QUERY",
      text: query,
    });

    const dimension = queryEmbedding.length;

    if (dimension === 0 || embeddedDocuments.some((document) => document.embedding.length !== dimension)) {
      return {
        ready: false,
        provider: embeddingProvider,
        model: embeddingModel,
        vectorStore,
        blocker: "Embedding dimensions are empty or inconsistent across documents/query.",
      };
    }

    const probeTable = normalizeIdentifier(`${configuredTable}_phase23_probe`, "PGVECTOR_TABLE probe name");
    const psqlResult = await runPgvectorProbe({
      connectionString,
      probeTable,
      namespace,
      queryEmbedding,
      documents: embeddedDocuments,
    });

    const hitOrder = parseRankedRows(psqlResult.stdout);
    const topHit = hitOrder[0] ?? null;
    const ready = topHit?.documentId === options.expectedTopDocumentId;

    return {
      ready,
      provider: embeddingProvider,
      model: embeddingModel,
      vectorStore,
      namespace,
      configuredTable,
      probeTable,
      dimension,
      query,
      hitOrder,
      topDocumentId: topHit?.documentId ?? null,
      topSimilarity: topHit?.similarity ?? null,
      writeReadRetrieveCompleted: hitOrder.length > 0,
      blocker: ready ? null : "Real vector probe did not return the expected top document.",
      stderr: sanitizeText(psqlResult.stderr, [connectionString, embeddingApiKey]),
    };
  } catch (error) {
    return {
      ready: false,
      provider: embeddingProvider,
      model: embeddingModel,
      vectorStore,
      blocker: error instanceof Error ? error.message : String(error),
    };
  }
}

async function embedWithGemini({ apiKey, baseUrl, model, taskType, text, title }) {
  const modelPath = model.startsWith("models/") ? model : `models/${model}`;
  const url = `${baseUrl.replace(/\/$/, "")}/v1beta/${modelPath}:embedContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelPath,
      taskType,
      title,
      content: {
        parts: [{ text }],
      },
    }),
    signal: AbortSignal.timeout(60000),
  });
  const textBody = await response.text();
  let body;
  try {
    body = textBody ? JSON.parse(textBody) : {};
  } catch (parseErr) {
    throw new Error(`Gemini embedding probe returned non-JSON body (HTTP ${response.status}): ${textBody.slice(0, 200)}`);
  }

  if (!response.ok) {
    const message = body?.error?.message ?? `Embedding request failed with HTTP ${response.status}.`;
    throw new Error(`Gemini embedding probe failed: ${message}`);
  }

  const values = body?.embedding?.values;

  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Gemini embedding probe returned no embedding values.");
  }

  return values.map((value) => Number(value));
}

async function runPgvectorProbe({ connectionString, probeTable, namespace, queryEmbedding, documents }) {
  const tempDir = await mkdtemp(join(tmpdir(), "phase23-pgvector-"));
  const sqlPath = join(tempDir, "probe.sql");

  try {
    const sql = createProbeSql({
      probeTable,
      namespace,
      queryEmbedding,
      documents,
    });
    await writeFile(sqlPath, sql, "utf8");
    return await runPsql({
      connectionString,
      sqlPath,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function createProbeSql({ probeTable, namespace, queryEmbedding, documents }) {
  const dimension = queryEmbedding.length;
  const vectorLiteral = toVectorLiteral(queryEmbedding);
  const valuesSql = documents
    .map((document) => `(
      ${quoteSqlLiteral(namespace)},
      ${quoteSqlLiteral(document.documentId)},
      ${quoteSqlLiteral(document.title)},
      ${quoteSqlLiteral(document.content)},
      ${quoteSqlLiteral(toVectorLiteral(document.embedding))}::vector
    )`)
    .join(",\n");

  return `
create extension if not exists vector;

drop table if exists ${probeTable};

create temporary table ${probeTable} (
  namespace text not null,
  document_id text not null,
  title text,
  content text not null,
  embedding vector(${dimension}) not null
);

insert into ${probeTable} (namespace, document_id, title, content, embedding)
values
${valuesSql};

with ranked as (
  select
    document_id,
    title,
    round((1 - (embedding <=> ${quoteSqlLiteral(vectorLiteral)}::vector))::numeric, 6) as similarity
  from ${probeTable}
  where namespace = ${quoteSqlLiteral(namespace)}
  order by embedding <=> ${quoteSqlLiteral(vectorLiteral)}::vector asc
  limit ${Math.max(2, documents.length)}
)
select document_id, similarity
from ranked;
`.trim();
}

function runPsql({ connectionString, sqlPath }) {
  const parsed = parseConnectionString(connectionString);

  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "& psql '-h' $env:PHASE23_PSQL_HOST '-p' $env:PHASE23_PSQL_PORT '-U' $env:PHASE23_PSQL_USER '-d' $env:PHASE23_PSQL_DB '-v' 'ON_ERROR_STOP=1' '-t' '-A' '-F' '~' '-f' $env:PHASE23_PSQL_SQL_PATH",
      ],
      {
        env: {
          ...process.env,
          PGPASSWORD: parsed.password,
          PGSSLMODE: parsed.sslmode ?? "require",
          PHASE23_PSQL_HOST: parsed.host,
          PHASE23_PSQL_PORT: parsed.port,
          PHASE23_PSQL_USER: parsed.username,
          PHASE23_PSQL_DB: parsed.database,
          PHASE23_PSQL_SQL_PATH: sqlPath,
        },
        windowsHide: true,
      },
    );
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`pgvector probe failed: ${sanitizeText(stderr || stdout, [connectionString, parsed.password])}`));
    });
  });
}

function parseConnectionString(connectionString) {
  let url;

  try {
    url = new URL(connectionString);
  } catch (error) {
    throw new Error("PGVECTOR_CONNECTION_STRING is not a valid PostgreSQL URL.");
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("PGVECTOR_CONNECTION_STRING must use postgres:// or postgresql://.");
  }

  return {
    host: url.hostname,
    port: url.port || "5432",
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\/+/, "") || "postgres",
    sslmode: url.searchParams.get("sslmode") || undefined,
  };
}

function parseRankedRows(stdout) {
  return String(stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [documentId, similarity] = line.split(PSQL_FIELD_SEPARATOR);
      return {
        documentId,
        similarity: Number(similarity),
      };
    })
    .filter((row) => row.documentId && Number.isFinite(row.similarity));
}

function toVectorLiteral(values) {
  return `[${values.map((value) => formatFloat(value)).join(",")}]`;
}

function formatFloat(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error("Vector probe received a non-finite embedding value.");
  }

  return number.toFixed(8);
}

function quoteSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function normalizeIdentifier(value, fieldName) {
  const normalized = normalizeOptional(value);

  if (!normalized || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
    throw new Error(`${fieldName} must be a simple SQL identifier.`);
  }

  return normalized.toLowerCase();
}

function normalizeOptional(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

function sanitizeText(text, secrets = []) {
  let sanitized = String(text ?? "");

  for (const secret of secrets.filter(Boolean)) {
    sanitized = sanitized.split(secret).join("[redacted]");
  }

  return sanitized.trim();
}
