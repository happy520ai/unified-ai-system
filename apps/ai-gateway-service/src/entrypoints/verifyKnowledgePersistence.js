import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-27-knowledge-persistence";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-27-knowledge-persistence.json");
const evidenceMdPath = resolve(evidenceDir, "phase-27-knowledge-persistence.md");

const sourceId = "phase-27-persistent-source";
const documentId = "phase-27-persistent-document";
const marker = "phase27-persistence-marker";

let tempDir;
let evidence;

try {
  tempDir = await mkdtemp(join(tmpdir(), "phase27-knowledge-persistence-"));
  const persistenceEnv = createPersistenceEnv(tempDir);
  const firstRun = await runLoadAndRetrieve(persistenceEnv);
  const secondRun = await runRetrieveOnly(persistenceEnv);
  const connected = isPersistenceConnected({ firstRun, secondRun });

  evidence = createEvidence({
    status: connected ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    persistenceDir: tempDir,
    firstRun,
    secondRun,
    conclusion: connected ? "knowledge-persistence-connected" : "knowledge-persistence-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = connected ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    persistenceDir: tempDir,
    firstRun: null,
    secondRun: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "knowledge-persistence-failed",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function createPersistenceEnv(persistenceDir) {
  return {
    ...process.env,
    KNOWLEDGE_STORAGE_MODE: "file-sqlite",
    KNOWLEDGE_PERSISTENCE_DIR: persistenceDir,
    KNOWLEDGE_FILE_STORE_PATH: join(persistenceDir, "knowledge-documents.json"),
    KNOWLEDGE_SQLITE_PATH: join(persistenceDir, "knowledge-documents.sqlite"),
  };
}

async function runLoadAndRetrieve(env) {
  let server;
  let application;

  try {
    application = createGatewayApplication(env);
    server = createGatewayHttpServer(application);
    await listen(server, 0, "127.0.0.1");

    const serviceUrl = `http://127.0.0.1:${server.address().port}`;
    const beforeHealth = await fetchJson(`${serviceUrl}/knowledge/health`);
    const load = await fetchJson(`${serviceUrl}/knowledge/load`, {
      method: "POST",
      body: {
        sourceId,
        sourceTitle: "Phase 27 Persistent Source",
        metadata: {
          phase: PHASE,
          persistence: "file-sqlite",
        },
        documents: [
          {
            documentId,
            title: "Phase 27 Persistent Document",
            uri: "unified-ai-system://phase-27/persistent-document",
            content:
              "This document proves local file plus SQLite persistence for imported knowledge. " +
              `${marker} should survive a service restart in the same persistence directory.`,
            metadata: {
              loadedBy: "verify:phase27",
            },
          },
        ],
      },
    });
    const retrieve = await fetchJson(`${serviceUrl}/knowledge/retrieve`, {
      method: "POST",
      body: {
        query: marker,
        mode: "keyword",
        sourceIds: [sourceId],
        topK: 1,
      },
    });
    const afterHealth = await fetchJson(`${serviceUrl}/knowledge/health`);
    const infra = await fetchJson(`${serviceUrl}/knowledge/infra/readiness`);

    return {
      serviceUrl,
      beforeHealth,
      load,
      retrieve,
      afterHealth,
      infra,
    };
  } finally {
    if (server) {
      await close(server);
    }
    application?.knowledgeService?.close?.();
  }
}

async function runRetrieveOnly(env) {
  let server;
  let application;

  try {
    application = createGatewayApplication(env);
    server = createGatewayHttpServer(application);
    await listen(server, 0, "127.0.0.1");

    const serviceUrl = `http://127.0.0.1:${server.address().port}`;
    const health = await fetchJson(`${serviceUrl}/knowledge/health`);
    const sources = await fetchJson(`${serviceUrl}/knowledge/sources`);
    const retrieve = await fetchJson(`${serviceUrl}/knowledge/retrieve`, {
      method: "POST",
      body: {
        query: marker,
        mode: "keyword",
        sourceIds: [sourceId],
        topK: 1,
      },
    });

    return {
      serviceUrl,
      health,
      sources,
      retrieve,
    };
  } finally {
    if (server) {
      await close(server);
    }
    application?.knowledgeService?.close?.();
  }
}

function listen(server, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, host, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

function close(server) {
  return new Promise((resolveClose) => {
    server.close(() => resolveClose());
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();

  return {
    httpStatus: response.status,
    body: text ? JSON.parse(text) : {},
  };
}

function isPersistenceConnected({ firstRun, secondRun }) {
  const firstHealth = firstRun?.afterHealth?.body?.data;
  const secondHealth = secondRun?.health?.body?.data;
  const secondSource = secondRun?.sources?.body?.data?.sources?.find((item) => item.sourceId === sourceId);
  const topHit = secondRun?.retrieve?.body?.data?.topHit;

  return (
    firstRun?.load?.httpStatus === 200 &&
    firstRun?.load?.body?.status === "ok" &&
    firstRun?.load?.body?.data?.loadedCount === 1 &&
    firstRun?.retrieve?.httpStatus === 200 &&
    firstRun?.retrieve?.body?.data?.topHit?.document?.documentId === documentId &&
    firstHealth?.storage === "file-sqlite" &&
    firstHealth?.persistence?.file?.documentCount === 1 &&
    firstHealth?.persistence?.sqlite?.documentCount === 1 &&
    secondRun?.health?.httpStatus === 200 &&
    secondHealth?.storage === "file-sqlite" &&
    secondSource?.documents?.some((document) => document.documentId === documentId) &&
    secondRun?.retrieve?.httpStatus === 200 &&
    topHit?.document?.sourceId === sourceId &&
    topHit?.document?.documentId === documentId &&
    topHit?.text?.includes(marker)
  );
}

function createEvidence({ status, generatedAt, persistenceDir, firstRun, secondRun, conclusion, error }) {
  const firstHealth = firstRun?.afterHealth?.body?.data;
  const secondHealth = secondRun?.health?.body?.data;
  const secondRetrieve = secondRun?.retrieve?.body?.data;
  const secondTopHit = secondRetrieve?.topHit;

  return {
    phase: PHASE,
    status,
    generatedAt,
    persistence: {
      storageMode: firstHealth?.storage ?? secondHealth?.storage ?? null,
      durable: firstHealth?.persistence?.durable ?? secondHealth?.persistence?.durable ?? null,
      fileStatus: firstHealth?.persistence?.file?.status ?? secondHealth?.persistence?.file?.status ?? null,
      sqliteStatus: firstHealth?.persistence?.sqlite?.status ?? secondHealth?.persistence?.sqlite?.status ?? null,
      fileDocumentCount: firstHealth?.persistence?.file?.documentCount ?? null,
      sqliteDocumentCount: firstHealth?.persistence?.sqlite?.documentCount ?? null,
      vectorNote: firstHealth?.persistence?.vector?.note ?? secondHealth?.persistence?.vector?.note ?? null,
      tempPersistenceDirUsed: Boolean(persistenceDir),
    },
    firstRun: {
      loadHttpStatus: firstRun?.load?.httpStatus ?? null,
      loadedCount: firstRun?.load?.body?.data?.loadedCount ?? null,
      retrieveHttpStatus: firstRun?.retrieve?.httpStatus ?? null,
      topHitDocumentId: firstRun?.retrieve?.body?.data?.topHit?.document?.documentId ?? null,
      vectorInfraMode: firstRun?.infra?.body?.data?.mode ?? null,
      vectorInfraStatus: firstRun?.infra?.body?.data?.status ?? null,
    },
    secondRun: {
      healthHttpStatus: secondRun?.health?.httpStatus ?? null,
      sourcePresent: Boolean(secondRun?.sources?.body?.data?.sources?.some((item) => item.sourceId === sourceId)),
      retrieveHttpStatus: secondRun?.retrieve?.httpStatus ?? null,
      topHitDocumentId: secondTopHit?.document?.documentId ?? null,
      markerMatched: Boolean(secondTopHit?.text?.includes(marker)),
      snippetPresent: Boolean(secondTopHit?.snippet),
      matchedTerms: secondTopHit?.matchedTerms ?? [],
    },
    error: error ?? null,
    conclusion,
  };
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 27 Knowledge Persistence Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Storage mode: ${body.persistence.storageMode ?? "n/a"}
- Durable: ${body.persistence.durable ?? "n/a"}
- File status: ${body.persistence.fileStatus ?? "n/a"}
- SQLite status: ${body.persistence.sqliteStatus ?? "n/a"}
- File document count: ${body.persistence.fileDocumentCount ?? "n/a"}
- SQLite document count: ${body.persistence.sqliteDocumentCount ?? "n/a"}
- Vector note: ${body.persistence.vectorNote ?? "n/a"}
- Load HTTP status: ${body.firstRun.loadHttpStatus ?? "n/a"}
- Loaded count: ${body.firstRun.loadedCount ?? "n/a"}
- First retrieve top hit: ${body.firstRun.topHitDocumentId ?? "n/a"}
- Vector infra mode: ${body.firstRun.vectorInfraMode ?? "n/a"}
- Vector infra status: ${body.firstRun.vectorInfraStatus ?? "n/a"}
- Restart health HTTP status: ${body.secondRun.healthHttpStatus ?? "n/a"}
- Restart source present: ${body.secondRun.sourcePresent}
- Restart retrieve HTTP status: ${body.secondRun.retrieveHttpStatus ?? "n/a"}
- Restart top hit: ${body.secondRun.topHitDocumentId ?? "n/a"}
- Marker matched after restart: ${body.secondRun.markerMatched}
- Snippet present after restart: ${body.secondRun.snippetPresent}
- Matched terms after restart: ${body.secondRun.matchedTerms.join(", ") || "n/a"}
- Conclusion: ${body.conclusion}
`;
}
