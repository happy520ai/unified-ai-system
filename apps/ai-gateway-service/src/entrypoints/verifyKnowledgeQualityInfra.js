import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-22-knowledge-quality-infra";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-22-knowledge-quality-infra.json");
const evidenceMdPath = resolve(evidenceDir, "phase-22-knowledge-quality-infra.md");

const sourceId = "phase-22-quality-source";
const topDocumentId = "phase-22-quality-top-hit";
const lowerDocumentId = "phase-22-quality-lower-hit";
const query = "  PHASE22   quality marker snippet highlight ranking metadata  ";

let server;
let evidence;

try {
  const application = createGatewayApplication({
    ...process.env,
    KNOWLEDGE_INFRA_MODE: "local-keyword",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");

  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const infra = await fetchJson(`${serviceUrl}/knowledge/infra/readiness`);
  const load = await fetchJson(`${serviceUrl}/knowledge/load`, {
    method: "POST",
    body: {
      sourceId,
      sourceTitle: "Phase 22 Quality Source",
      metadata: {
        phase: PHASE,
        purpose: "quality-ranking",
      },
      documents: [
        {
          documentId: topDocumentId,
          title: "Phase 22 Quality Ranking Document",
          uri: "unified-ai-system://phase-22/quality-top-hit",
          content:
            "phase22 quality marker snippet highlight ranking metadata lives in this primary document. " +
            "It should rank above partial matches and expose a matched fragment for daily use.",
          metadata: {
            expectedRank: 1,
          },
        },
        {
          documentId: lowerDocumentId,
          title: "Phase 22 Partial Document",
          uri: "unified-ai-system://phase-22/quality-lower-hit",
          content: "phase22 quality marker only.",
          metadata: {
            expectedRank: 2,
          },
        },
      ],
    },
  });
  const retrieve = await fetchJson(`${serviceUrl}/knowledge/retrieve`, {
    method: "POST",
    body: {
      context: {
        requestId: "knowledge-phase-22-quality-retrieve",
        traceId: PHASE,
      },
      query,
      mode: "keyword",
      sourceIds: [sourceId],
      topK: 2,
    },
  });
  const connected = isQualityAndInfraConnected({ infra, load, retrieve });

  evidence = createEvidence({
    status: connected ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    infra,
    load,
    retrieve,
    conclusion: connected ? "knowledge-quality-and-infra-base-connected" : "knowledge-quality-and-infra-base-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = connected ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    infra: null,
    load: null,
    retrieve: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "knowledge-quality-and-infra-base-not-connected",
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

function isQualityAndInfraConnected({ infra, load, retrieve }) {
  const retrieveData = retrieve?.body?.data;
  const topHit = retrieveData?.topHit;
  const chunks = retrieveData?.chunks ?? [];

  return (
    infra?.httpStatus === 200 &&
    infra?.body?.status === "ok" &&
    infra.body.data?.mode === "local-keyword" &&
    infra.body.data?.status === "disabled" &&
    infra.body.data?.enabled === false &&
    infra.body.data?.embedding?.status === "disabled" &&
    infra.body.data?.vectorStore?.status === "disabled" &&
    infra.body.data?.pgvector?.status === "disabled" &&
    infra.body.data?.interfaces?.embeddingProvider?.name === "KnowledgeEmbeddingProvider" &&
    infra.body.data?.interfaces?.vectorStore?.name === "KnowledgeVectorStore" &&
    load?.httpStatus === 200 &&
    load?.body?.status === "ok" &&
    load?.body?.data?.loadedCount === 2 &&
    retrieve?.httpStatus === 200 &&
    retrieve?.body?.status === "ok" &&
    retrieveData?.mode === "keyword" &&
    retrieveData?.normalizedQuery === "phase22 quality marker snippet highlight ranking metadata" &&
    retrieveData?.metadata?.ranking === "weighted-keyword-v2" &&
    retrieveData?.metadata?.queryNormalization === "unicode-nfkc-lowercase-collapse" &&
    chunks.length === 2 &&
    topHit?.rank === 1 &&
    topHit?.document?.documentId === topDocumentId &&
    retrieveData?.topChunk?.document?.documentId === topDocumentId &&
    retrieveData?.topDocument?.documentId === topDocumentId &&
    topHit?.snippet?.includes("snippet") &&
    topHit?.highlights?.length > 0 &&
    topHit?.matchedTerms?.includes("ranking") &&
    topHit?.scoreBreakdown?.matchedTermCount >= 6 &&
    topHit?.document?.metadata?.expectedRank === 1
  );
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  infra,
  load,
  retrieve,
  conclusion,
  error,
}) {
  const retrieveData = retrieve?.body?.data;
  const topHit = retrieveData?.topHit;

  return {
    phase: PHASE,
    status,
    generatedAt,
    service: {
      url: serviceUrl,
    },
    knowledge: {
      loadHttpStatus: load?.httpStatus ?? null,
      loadedCount: load?.body?.data?.loadedCount ?? null,
      retrieveHttpStatus: retrieve?.httpStatus ?? null,
      retrieveMode: retrieveData?.mode ?? null,
      normalizedQuery: retrieveData?.normalizedQuery ?? null,
      ranking: retrieveData?.metadata?.ranking ?? null,
      queryNormalization: retrieveData?.metadata?.queryNormalization ?? null,
      chunkCount: retrieveData?.chunks?.length ?? 0,
      topHitDocumentId: topHit?.document?.documentId ?? null,
      topChunkDocumentId: retrieveData?.topChunk?.document?.documentId ?? null,
      topDocumentId: retrieveData?.topDocument?.documentId ?? null,
      topHitRank: topHit?.rank ?? null,
      topHitScore: topHit?.score ?? null,
      topHitMatchedTerms: topHit?.matchedTerms ?? [],
      topHitSnippetPresent: Boolean(topHit?.snippet),
      topHitHighlights: topHit?.highlights ?? [],
    },
    infra: {
      httpStatus: infra?.httpStatus ?? null,
      mode: infra?.body?.data?.mode ?? null,
      status: infra?.body?.data?.status ?? null,
      enabled: infra?.body?.data?.enabled ?? null,
      embeddingStatus: infra?.body?.data?.embedding?.status ?? null,
      vectorStoreStatus: infra?.body?.data?.vectorStore?.status ?? null,
      pgvectorStatus: infra?.body?.data?.pgvector?.status ?? null,
      embeddingInterface: infra?.body?.data?.interfaces?.embeddingProvider?.name ?? null,
      vectorStoreInterface: infra?.body?.data?.interfaces?.vectorStore?.name ?? null,
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
  return `# Phase 22 Knowledge Quality And Infra Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.service.url ?? "n/a"}
- Load HTTP status: ${body.knowledge.loadHttpStatus ?? "n/a"}
- Loaded count: ${body.knowledge.loadedCount ?? "n/a"}
- Retrieve HTTP status: ${body.knowledge.retrieveHttpStatus ?? "n/a"}
- Retrieve mode: ${body.knowledge.retrieveMode ?? "n/a"}
- Normalized query: ${body.knowledge.normalizedQuery ?? "n/a"}
- Ranking: ${body.knowledge.ranking ?? "n/a"}
- Query normalization: ${body.knowledge.queryNormalization ?? "n/a"}
- Retrieved chunks: ${body.knowledge.chunkCount}
- Top hit document: ${body.knowledge.topHitDocumentId ?? "n/a"}
- Top chunk document: ${body.knowledge.topChunkDocumentId ?? "n/a"}
- Top document: ${body.knowledge.topDocumentId ?? "n/a"}
- Top hit rank: ${body.knowledge.topHitRank ?? "n/a"}
- Top hit score: ${body.knowledge.topHitScore ?? "n/a"}
- Top hit matched terms: ${body.knowledge.topHitMatchedTerms.join(", ") || "n/a"}
- Top hit snippet present: ${body.knowledge.topHitSnippetPresent}
- Top hit highlights: ${body.knowledge.topHitHighlights.length}
- Infra mode: ${body.infra.mode ?? "n/a"}
- Infra status: ${body.infra.status ?? "n/a"}
- Infra enabled: ${body.infra.enabled ?? "n/a"}
- Embedding status: ${body.infra.embeddingStatus ?? "n/a"}
- Vector store status: ${body.infra.vectorStoreStatus ?? "n/a"}
- pgvector status: ${body.infra.pgvectorStatus ?? "n/a"}
- Embedding interface: ${body.infra.embeddingInterface ?? "n/a"}
- Vector store interface: ${body.infra.vectorStoreInterface ?? "n/a"}
- Conclusion: ${body.conclusion}
`;
}
