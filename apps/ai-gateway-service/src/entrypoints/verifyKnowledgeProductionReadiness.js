import { mkdir, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { runVectorProductionProbe } from "../knowledge/vectorProductionProbe.js";
import { fetchJson, listen, close } from "./entrypointUtils.js";

const PHASE = "phase-23-knowledge-production-readiness";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-23-knowledge-production-readiness.json");
const evidenceMdPath = resolve(evidenceDir, "phase-23-knowledge-production-readiness.md");

const sourceId = "phase-23-quality-source";
const topDocumentId = "phase-23-quality-top-document";
const partialDocumentId = "phase-23-quality-partial-document";
const query = "  PHASE23, exact quality ranking boost 中文 marker!  ";

let server;
let evidence;

try {
  const application = createGatewayApplication(process.env);
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");

  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const infra = await fetchJson(`${serviceUrl}/knowledge/infra/readiness`);
  const load = await fetchJson(`${serviceUrl}/knowledge/load`, {
    method: "POST",
    body: {
      sourceId,
      sourceTitle: "Phase 23 Quality Source",
      metadata: {
        phase: PHASE,
        purpose: "keyword-extreme-quality",
      },
      documents: [
        {
          documentId: topDocumentId,
          title: "Phase23 exact quality ranking boost 中文 marker",
          uri: "unified-ai-system://phase-23/quality-top-document",
          content:
            "Phase23 exact quality ranking boost 中文 marker. " +
            "This document intentionally repeats the exact phrase and carries the clearest production-quality keyword result.",
          metadata: {
            expectedRank: 1,
            qualityCase: "title-body-phrase-source-metadata",
          },
        },
        {
          documentId: partialDocumentId,
          title: "Phase23 partial quality marker",
          uri: "unified-ai-system://phase-23/quality-partial-document",
          content:
            "Phase23 quality marker appears here, but ranking boost and 中文 exact phrase evidence are weaker.",
          metadata: {
            expectedRank: 2,
            qualityCase: "partial-body-match",
          },
        },
      ],
    },
  });
  const retrieve = await fetchJson(`${serviceUrl}/knowledge/retrieve`, {
    method: "POST",
    body: {
      context: {
        requestId: "knowledge-phase-23-keyword-quality",
        traceId: PHASE,
      },
      query,
      mode: "keyword",
      sourceIds: [sourceId],
      topK: 2,
    },
  });
  const retrieveAgain = await fetchJson(`${serviceUrl}/knowledge/retrieve`, {
    method: "POST",
    body: {
      context: {
        requestId: "knowledge-phase-23-keyword-quality-repeat",
        traceId: `${PHASE}-repeat`,
      },
      query,
      mode: "keyword",
      sourceIds: [sourceId],
      topK: 2,
    },
  });
  const keywordReady = isKeywordQualityReady({ load, retrieve, retrieveAgain });
  const vectorProbe = await runVectorProductionProbe(process.env, {
    query: dataNormalizedQuery(retrieve),
    expectedTopDocumentId: topDocumentId,
    documents: [
      {
        documentId: topDocumentId,
        title: "Phase23 exact quality ranking boost 中文 marker",
        content:
          "Phase23 exact quality ranking boost 中文 marker. " +
          "This document intentionally repeats the exact phrase and carries the clearest production-quality keyword result.",
      },
      {
        documentId: partialDocumentId,
        title: "Phase23 partial quality marker",
        content:
          "Phase23 quality marker appears here, but ranking boost and 中文 exact phrase evidence are weaker.",
      },
    ],
  });
  const productionReady = vectorProbe.ready === true;
  const status = keywordReady && productionReady ? "passed" : "blocked";

  evidence = createEvidence({
    status,
    generatedAt: new Date().toISOString(),
    serviceUrl,
    infra,
    load,
    retrieve,
    retrieveAgain,
    keywordReady,
    productionReady,
    vectorProbe,
    conclusion: status === "passed"
      ? "knowledge-production-deliverable-connected"
      : "knowledge-production-deliverable-blocked",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = status === "passed" ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    infra: null,
    load: null,
    retrieve: null,
    retrieveAgain: null,
    keywordReady: false,
    productionReady: false,
    vectorProbe: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "knowledge-production-deliverable-failed",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isKeywordQualityReady({ load, retrieve, retrieveAgain }) {
  const data = retrieve?.body?.data;
  const againData = retrieveAgain?.body?.data;
  const topHit = data?.topHit;
  const firstOrder = data?.chunks?.map((chunk) => chunk.document?.documentId).join(",");
  const secondOrder = againData?.chunks?.map((chunk) => chunk.document?.documentId).join(",");

  return (
    load?.httpStatus === 200 &&
    load?.body?.status === "ok" &&
    load?.body?.data?.loadedCount === 2 &&
    retrieve?.httpStatus === 200 &&
    retrieve?.body?.status === "ok" &&
    data?.normalizedQuery === "phase23 exact quality ranking boost 中文 marker" &&
    data?.metadata?.ranking === "weighted-keyword-v2" &&
    data?.metadata?.stopwordsApplied === true &&
    data?.topHit?.document?.documentId === topDocumentId &&
    data?.topChunk?.document?.documentId === topDocumentId &&
    data?.topDocument?.documentId === topDocumentId &&
    topHit?.rank === 1 &&
    topHit?.snippet?.includes("exact quality ranking boost") &&
    topHit?.highlights?.length >= 5 &&
    topHit?.matchedTerms?.includes("中文") &&
    topHit?.scoreBreakdown?.phraseMatch === true &&
    topHit?.scoreBreakdown?.contiguousMatch === true &&
    topHit?.scoreBreakdown?.titleCoverage > 0.8 &&
    topHit?.document?.metadata?.expectedRank === 1 &&
    firstOrder === secondOrder
  );
}

function dataNormalizedQuery(retrieve) {
  return retrieve?.body?.data?.normalizedQuery ?? "phase23 exact quality ranking boost 中文 marker";
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  infra,
  load,
  retrieve,
  retrieveAgain,
  keywordReady,
  productionReady,
  vectorProbe,
  conclusion,
  error,
}) {
  const data = retrieve?.body?.data;
  const topHit = data?.topHit;
  const firstOrder = data?.chunks?.map((chunk) => chunk.document?.documentId) ?? [];
  const secondOrder = retrieveAgain?.body?.data?.chunks?.map((chunk) => chunk.document?.documentId) ?? [];

  return {
    phase: PHASE,
    status,
    generatedAt,
    service: {
      url: serviceUrl,
    },
    keyword: {
      ready: keywordReady,
      loadHttpStatus: load?.httpStatus ?? null,
      retrieveHttpStatus: retrieve?.httpStatus ?? null,
      normalizedQuery: data?.normalizedQuery ?? null,
      ranking: data?.metadata?.ranking ?? null,
      queryNormalization: data?.metadata?.queryNormalization ?? null,
      stopwordsApplied: data?.metadata?.stopwordsApplied ?? null,
      topHitDocumentId: topHit?.document?.documentId ?? null,
      topChunkDocumentId: data?.topChunk?.document?.documentId ?? null,
      topDocumentId: data?.topDocument?.documentId ?? null,
      topHitRank: topHit?.rank ?? null,
      topHitScore: topHit?.score ?? null,
      scoreBreakdown: topHit?.scoreBreakdown ?? null,
      matchedTerms: topHit?.matchedTerms ?? [],
      highlightCount: topHit?.highlights?.length ?? 0,
      snippetPresent: Boolean(topHit?.snippet),
      firstOrder,
      secondOrder,
      stableOrder: firstOrder.join(",") === secondOrder.join(","),
    },
    vectorProduction: {
      ready: productionReady,
      mode: infra?.body?.data?.mode ?? null,
      status: productionReady ? "ready" : infra?.body?.data?.status ?? null,
      enabled: infra?.body?.data?.enabled ?? null,
      productionReady,
      blockers: productionReady
        ? []
        : vectorProbe?.blocker
          ? [vectorProbe.blocker]
          : infra?.body?.data?.blockers ?? [],
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
          }
        : null,
    },
    error: error ?? null,
    conclusion,
  };
}

