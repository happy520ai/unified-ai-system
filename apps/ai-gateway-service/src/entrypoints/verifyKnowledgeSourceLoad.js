import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-21b-knowledge-source-load";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-21b-knowledge-source-load.json");
const evidenceMdPath = resolve(evidenceDir, "phase-21b-knowledge-source-load.md");

const loadedSourceId = "phase-21b-local-source";
const loadedDocumentId = "phase-21b-local-document";
const loadedKeyword = "phase21b-load-marker";

let server;
let evidence;

try {
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: process.env.AI_GATEWAY_PROVIDER_MODE ?? "real",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: process.env.AI_GATEWAY_REAL_PROVIDER_ENABLED ?? "true",
    AI_GATEWAY_ROUTE_MODE: process.env.AI_GATEWAY_ROUTE_MODE ?? "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: process.env.AI_GATEWAY_DEFAULT_PROVIDER ?? "nvidia",
    AI_GATEWAY_ENABLED_PROVIDERS: process.env.AI_GATEWAY_ENABLED_PROVIDERS ?? "nvidia",
    NVIDIA_MODEL: process.env.NVIDIA_MODEL ?? "meta/llama-3.1-8b-instruct",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");

  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const beforeHealth = await fetchJson(`${serviceUrl}/knowledge/health`);
  const load = await fetchJson(`${serviceUrl}/knowledge/load`, {
    method: "POST",
    body: {
      sourceId: loadedSourceId,
      sourceTitle: "Phase 21B Local Source",
      metadata: {
        phase: PHASE,
      },
      documents: [
        {
          documentId: loadedDocumentId,
          title: "Phase 21B Loaded Document",
          uri: "unified-ai-system://phase-21b/local-document",
          content:
            "This locally loaded document proves the Phase 21B knowledge source load path. " +
            `${loadedKeyword} should be retrievable through keyword retrieval after load.`,
          metadata: {
            loadedBy: "verify:phase21b",
          },
        },
      ],
    },
  });
  const afterHealth = await fetchJson(`${serviceUrl}/knowledge/health`);
  const sources = await fetchJson(`${serviceUrl}/knowledge/sources`);
  const retrieve = await fetchJson(`${serviceUrl}/knowledge/retrieve`, {
    method: "POST",
    body: {
      context: {
        requestId: "knowledge-phase-21b-retrieve",
        traceId: PHASE,
      },
      query: loadedKeyword,
      mode: "keyword",
      sourceIds: [loadedSourceId],
      topK: 1,
    },
  });
  const connected = isKnowledgeSourceLoadConnected({
    beforeHealth,
    load,
    afterHealth,
    sources,
    retrieve,
  });

  evidence = createEvidence({
    status: connected ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    beforeHealth,
    load,
    afterHealth,
    sources,
    retrieve,
    conclusion: connected ? "local-knowledge-source-load-connected" : "local-knowledge-source-load-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = connected ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    beforeHealth: null,
    load: null,
    afterHealth: null,
    sources: null,
    retrieve: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "local-knowledge-source-load-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
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

function isKnowledgeSourceLoadConnected({ beforeHealth, load, afterHealth, sources, retrieve }) {
  const beforeDocumentCount = beforeHealth?.body?.data?.documentCount;
  const afterDocumentCount = afterHealth?.body?.data?.documentCount;
  const source = sources?.body?.data?.sources?.find((item) => item.sourceId === loadedSourceId);
  const chunk = retrieve?.body?.data?.chunks?.[0];

  return (
    beforeHealth?.httpStatus === 200 &&
    beforeHealth?.body?.status === "ok" &&
    load?.httpStatus === 200 &&
    load?.body?.status === "ok" &&
    load?.body?.data?.status === "loaded" &&
    load?.body?.data?.sourceId === loadedSourceId &&
    load?.body?.data?.loadedCount === 1 &&
    afterHealth?.httpStatus === 200 &&
    afterDocumentCount === beforeDocumentCount + 1 &&
    sources?.httpStatus === 200 &&
    source?.documents?.some((document) => document.documentId === loadedDocumentId) &&
    retrieve?.httpStatus === 200 &&
    retrieve?.body?.status === "ok" &&
    retrieve?.body?.data?.mode === "keyword" &&
    chunk?.document?.sourceId === loadedSourceId &&
    chunk?.document?.documentId === loadedDocumentId &&
    chunk?.text?.includes(loadedKeyword)
  );
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  beforeHealth,
  load,
  afterHealth,
  sources,
  retrieve,
  conclusion,
  error,
}) {
  const source = sources?.body?.data?.sources?.find((item) => item.sourceId === loadedSourceId);
  const retrieveData = retrieve?.body?.data;

  return {
    phase: PHASE,
    status,
    generatedAt,
    service: {
      url: serviceUrl,
    },
    knowledge: {
      mode: afterHealth?.body?.data?.mode ?? null,
      storage: afterHealth?.body?.data?.storage ?? null,
      embedding: afterHealth?.body?.data?.embedding ?? null,
      beforeDocumentCount: beforeHealth?.body?.data?.documentCount ?? null,
      afterDocumentCount: afterHealth?.body?.data?.documentCount ?? null,
      loadedSourceId,
      loadedDocumentId,
      loadHttpStatus: load?.httpStatus ?? null,
      loadedCount: load?.body?.data?.loadedCount ?? null,
      sourcePresent: Boolean(source),
      sourceDocumentCount: source?.documentCount ?? null,
      retrieveHttpStatus: retrieve?.httpStatus ?? null,
      retrieveMode: retrieveData?.mode ?? null,
      retrieveChunkCount: retrieveData?.chunks?.length ?? 0,
      topChunkDocumentId: retrieveData?.chunks?.[0]?.document?.documentId ?? null,
      markerMatched: Boolean(retrieveData?.chunks?.[0]?.text?.includes(loadedKeyword)),
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
  return `# Phase 21B Knowledge Source Load Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.service.url ?? "n/a"}
- Knowledge mode: ${body.knowledge.mode ?? "n/a"}
- Storage: ${body.knowledge.storage ?? "n/a"}
- Embedding: ${body.knowledge.embedding ?? "n/a"}
- Documents before load: ${body.knowledge.beforeDocumentCount ?? "n/a"}
- Documents after load: ${body.knowledge.afterDocumentCount ?? "n/a"}
- Loaded source ID: ${body.knowledge.loadedSourceId}
- Loaded document ID: ${body.knowledge.loadedDocumentId}
- Load HTTP status: ${body.knowledge.loadHttpStatus ?? "n/a"}
- Loaded count: ${body.knowledge.loadedCount ?? "n/a"}
- Source present: ${body.knowledge.sourcePresent}
- Source document count: ${body.knowledge.sourceDocumentCount ?? "n/a"}
- Retrieve HTTP status: ${body.knowledge.retrieveHttpStatus ?? "n/a"}
- Retrieve mode: ${body.knowledge.retrieveMode ?? "n/a"}
- Retrieved chunks: ${body.knowledge.retrieveChunkCount}
- Top chunk document: ${body.knowledge.topChunkDocumentId ?? "n/a"}
- Marker matched: ${body.knowledge.markerMatched}
- Conclusion: ${body.conclusion}
`;
}
