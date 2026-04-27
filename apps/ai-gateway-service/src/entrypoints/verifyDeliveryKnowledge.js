import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { runVectorProductionProbe } from "../knowledge/vectorProductionProbe.js";

const PHASE = "phase-24-delivery-knowledge";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-24-delivery-knowledge.json");
const evidenceMdPath = resolve(evidenceDir, "phase-24-delivery-knowledge.md");
const deliveryGuidePath = resolve(repoRoot, "docs/DELIVERY_GUIDE.md");
const samplePath = resolve(repoRoot, "apps/ai-gateway-service/knowledge-samples/real-usage-sample.md");

const sourceId = "phase-24-real-usage-source";
const expectedTopDocumentId = "phase-24-delivery-operations";
const query = "phase24 delivery operations help status health logs idle command";

let server;
let evidence;

try {
  await assertReadable(deliveryGuidePath);
  const sampleContent = await readFile(samplePath, "utf8");
  const documents = createSampleDocuments(sampleContent);

  const application = createGatewayApplication(process.env);
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");

  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const health = await fetchJson(`${serviceUrl}/knowledge/health`);
  const infra = await fetchJson(`${serviceUrl}/knowledge/infra/readiness`);
  const load = await fetchJson(`${serviceUrl}/knowledge/load`, {
    method: "POST",
    body: {
      sourceId,
      sourceTitle: "Phase 24 Real Usage Source",
      metadata: {
        phase: PHASE,
        sourceType: "local-real-usage-sample",
      },
      documents,
    },
  });
  const sources = await fetchJson(`${serviceUrl}/knowledge/sources`);
  const retrieve = await fetchJson(`${serviceUrl}/knowledge/retrieve`, {
    method: "POST",
    body: {
      context: {
        requestId: "knowledge-phase-24-delivery-retrieve",
        traceId: PHASE,
      },
      query,
      mode: "keyword",
      sourceIds: [sourceId],
      topK: 3,
    },
  });
  const localReady = isLocalKeywordReady({ health, load, sources, retrieve });
  const vectorActive = infra?.body?.data?.mode === "vector" && infra.body.data?.enabled === true;
  const vectorProbe = vectorActive
    ? await runVectorProductionProbe(process.env, {
        query,
        expectedTopDocumentId,
        documents: documents.map((document) => ({
          documentId: document.documentId,
          title: document.title,
          content: document.content,
        })),
      })
    : null;
  const vectorReady = vectorActive ? vectorProbe?.ready === true : null;
  const passed = localReady && (!vectorActive || vectorReady);

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    guidePresent: true,
    samplePath,
    documents,
    health,
    infra,
    load,
    sources,
    retrieve,
    localReady,
    vectorActive,
    vectorReady,
    vectorProbe,
    conclusion: passed
      ? "delivery-guide-and-real-usage-knowledge-connected"
      : "delivery-guide-and-real-usage-knowledge-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    guidePresent: false,
    samplePath,
    documents: [],
    health: null,
    infra: null,
    load: null,
    sources: null,
    retrieve: null,
    localReady: false,
    vectorActive: null,
    vectorReady: null,
    vectorProbe: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "delivery-guide-and-real-usage-knowledge-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

async function assertReadable(path) {
  await access(path);
}

function createSampleDocuments(sampleContent) {
  return [
    {
      documentId: expectedTopDocumentId,
      title: "Phase 24 Delivery Operations",
      uri: "unified-ai-system://phase-24/delivery-operations",
      content: extractSection(sampleContent, "delivery-operations"),
      metadata: {
        phase: PHASE,
        expectedRank: 1,
        topic: "delivery-operations",
      },
    },
    {
      documentId: "phase-24-knowledge-default-mode",
      title: "Phase 24 Knowledge Default Mode",
      uri: "unified-ai-system://phase-24/knowledge-default-mode",
      content: extractSection(sampleContent, "knowledge-default-mode"),
      metadata: {
        phase: PHASE,
        expectedRank: 2,
        topic: "local-keyword",
      },
    },
    {
      documentId: "phase-24-vector-production-mode",
      title: "Phase 24 Vector Production Mode",
      uri: "unified-ai-system://phase-24/vector-production-mode",
      content: extractSection(sampleContent, "vector-production-mode"),
      metadata: {
        phase: PHASE,
        expectedRank: 3,
        topic: "vector-pgvector",
      },
    },
  ];
}

function extractSection(content, id) {
  const match = new RegExp(`## ${escapeRegExp(id)}\\n\\n([\\s\\S]*?)(?=\\n## |$)`, "u").exec(content);

  if (!match?.[1]?.trim()) {
    throw new Error(`Missing Phase 24 sample section: ${id}`);
  }

  return match[1].trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function isLocalKeywordReady({ health, load, sources, retrieve }) {
  const source = sources?.body?.data?.sources?.find((item) => item.sourceId === sourceId);
  const data = retrieve?.body?.data;
  const topHit = data?.topHit;

  return (
    health?.httpStatus === 200 &&
    health?.body?.data?.mode === "local-keyword" &&
    load?.httpStatus === 200 &&
    load?.body?.status === "ok" &&
    load?.body?.data?.loadedCount === 3 &&
    source?.documentCount === 3 &&
    retrieve?.httpStatus === 200 &&
    retrieve?.body?.status === "ok" &&
    data?.mode === "keyword" &&
    data?.topHit?.document?.documentId === expectedTopDocumentId &&
    data?.topChunk?.document?.documentId === expectedTopDocumentId &&
    data?.topDocument?.documentId === expectedTopDocumentId &&
    topHit?.snippet?.includes("daily command rhythm") &&
    topHit?.highlights?.length > 0 &&
    topHit?.matchedTerms?.includes("health") &&
    topHit?.matchedTerms?.includes("logs") &&
    topHit?.scoreBreakdown?.matchedTermCount >= 5 &&
    topHit?.document?.metadata?.topic === "delivery-operations"
  );
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  guidePresent,
  samplePath,
  documents,
  health,
  infra,
  load,
  sources,
  retrieve,
  localReady,
  vectorActive,
  vectorReady,
  vectorProbe,
  conclusion,
  error,
}) {
  const data = retrieve?.body?.data;
  const topHit = data?.topHit;
  const source = sources?.body?.data?.sources?.find((item) => item.sourceId === sourceId);

  return {
    phase: PHASE,
    status,
    generatedAt,
    delivery: {
      guidePath: "docs/DELIVERY_GUIDE.md",
      guidePresent,
      samplePath: "apps/ai-gateway-service/knowledge-samples/real-usage-sample.md",
      sampleDocumentCount: documents.length,
    },
    service: {
      url: serviceUrl,
    },
    knowledge: {
      sourceId,
      loadedDocumentIds: documents.map((document) => document.documentId),
      loadHttpStatus: load?.httpStatus ?? null,
      loadedCount: load?.body?.data?.loadedCount ?? null,
      sourcePresent: Boolean(source),
      sourceDocumentCount: source?.documentCount ?? null,
      retrieveHttpStatus: retrieve?.httpStatus ?? null,
      query,
      retrieveMode: data?.mode ?? null,
      normalizedQuery: data?.normalizedQuery ?? null,
      ranking: data?.metadata?.ranking ?? null,
      localReady,
      topHitDocumentId: topHit?.document?.documentId ?? null,
      topChunkDocumentId: data?.topChunk?.document?.documentId ?? null,
      topDocumentId: data?.topDocument?.documentId ?? null,
      topHitScore: topHit?.score ?? null,
      topHitSnippetPresent: Boolean(topHit?.snippet),
      topHitHighlights: topHit?.highlights ?? [],
      topHitMatchedTerms: topHit?.matchedTerms ?? [],
      topHitScoreBreakdown: topHit?.scoreBreakdown ?? null,
      topHitMetadata: topHit?.document?.metadata ?? null,
      healthMode: health?.body?.data?.mode ?? null,
      storage: health?.body?.data?.storage ?? null,
      embedding: health?.body?.data?.embedding ?? null,
    },
    vector: {
      active: vectorActive,
      ready: vectorReady,
      infraMode: infra?.body?.data?.mode ?? null,
      infraStatus: infra?.body?.data?.status ?? null,
      embeddingStatus: infra?.body?.data?.embedding?.status ?? null,
      vectorStoreStatus: infra?.body?.data?.vectorStore?.status ?? null,
      pgvectorStatus: infra?.body?.data?.pgvector?.status ?? null,
      probe: vectorProbe
        ? {
            provider: vectorProbe.provider ?? null,
            model: vectorProbe.model ?? null,
            dimension: vectorProbe.dimension ?? null,
            namespace: vectorProbe.namespace ?? null,
            configuredTable: vectorProbe.configuredTable ?? null,
            probeTable: vectorProbe.probeTable ?? null,
            topDocumentId: vectorProbe.topDocumentId ?? null,
            topSimilarity: vectorProbe.topSimilarity ?? null,
            hitOrder: vectorProbe.hitOrder ?? [],
            writeReadRetrieveCompleted: vectorProbe.writeReadRetrieveCompleted ?? false,
            blocker: vectorProbe.blocker ?? null,
          }
        : null,
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
  return `# Phase 24 Delivery Knowledge Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Delivery guide present: ${body.delivery.guidePresent}
- Delivery guide path: ${body.delivery.guidePath}
- Sample path: ${body.delivery.samplePath}
- Sample documents: ${body.delivery.sampleDocumentCount}
- Source ID: ${body.knowledge.sourceId}
- Loaded documents: ${body.knowledge.loadedDocumentIds.join(", ") || "n/a"}
- Load HTTP status: ${body.knowledge.loadHttpStatus ?? "n/a"}
- Loaded count: ${body.knowledge.loadedCount ?? "n/a"}
- Source present: ${body.knowledge.sourcePresent}
- Source document count: ${body.knowledge.sourceDocumentCount ?? "n/a"}
- Retrieve HTTP status: ${body.knowledge.retrieveHttpStatus ?? "n/a"}
- Query: ${body.knowledge.query}
- Retrieve mode: ${body.knowledge.retrieveMode ?? "n/a"}
- Normalized query: ${body.knowledge.normalizedQuery ?? "n/a"}
- Ranking: ${body.knowledge.ranking ?? "n/a"}
- Local keyword ready: ${body.knowledge.localReady}
- Top hit document: ${body.knowledge.topHitDocumentId ?? "n/a"}
- Top chunk document: ${body.knowledge.topChunkDocumentId ?? "n/a"}
- Top document: ${body.knowledge.topDocumentId ?? "n/a"}
- Top hit score: ${body.knowledge.topHitScore ?? "n/a"}
- Snippet present: ${body.knowledge.topHitSnippetPresent}
- Highlight count: ${body.knowledge.topHitHighlights.length}
- Matched terms: ${body.knowledge.topHitMatchedTerms.join(", ") || "n/a"}
- Vector active: ${body.vector.active}
- Vector ready: ${body.vector.ready ?? "not-active"}
- Vector infra status: ${body.vector.infraStatus ?? "n/a"}
- Vector probe top document: ${body.vector.probe?.topDocumentId ?? "n/a"}
- Vector write/read/retrieve completed: ${body.vector.probe?.writeReadRetrieveCompleted ?? "n/a"}
- Conclusion: ${body.conclusion}
`;
}
