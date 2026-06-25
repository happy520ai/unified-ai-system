import { mkdir, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, listen, close } from "./entrypointUtils.js";

const PHASE = "phase-21a-knowledge-entry";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-21a-knowledge-entry.json");
const evidenceMdPath = resolve(evidenceDir, "phase-21a-knowledge-entry.md");

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
  const health = await fetchJson(`${serviceUrl}/knowledge/health`);
  const sources = await fetchJson(`${serviceUrl}/knowledge/sources`);
  const retrieve = await fetchJson(`${serviceUrl}/knowledge/retrieve`, {
    method: "POST",
    body: {
      context: {
        requestId: "knowledge-phase-21a-retrieve",
        traceId: "phase-21a-knowledge-entry",
      },
      query: "default command set NVIDIA single provider logs",
      mode: "keyword",
      topK: 3,
    },
  });
  const connected = isKnowledgeEntryConnected({ health, sources, retrieve });

  evidence = createEvidence({
    status: connected ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    health,
    sources,
    retrieve,
    conclusion: connected ? "local-knowledge-entry-connected" : "local-knowledge-entry-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = connected ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    health: null,
    sources: null,
    retrieve: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "local-knowledge-entry-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isKnowledgeEntryConnected({ health, sources, retrieve }) {
  return (
    health?.httpStatus === 200 &&
    health?.body?.status === "ok" &&
    health?.body?.data?.status === "ready" &&
    health?.body?.data?.mode === "local-keyword" &&
    health?.body?.data?.supportedModes?.includes("keyword") &&
    sources?.httpStatus === 200 &&
    sources?.body?.status === "ok" &&
    Array.isArray(sources?.body?.data?.sources) &&
    sources.body.data.sources.length > 0 &&
    retrieve?.httpStatus === 200 &&
    retrieve?.body?.status === "ok" &&
    retrieve?.body?.data?.mode === "keyword" &&
    retrieve?.body?.data?.chunks?.length > 0 &&
    retrieve.body.data.chunks.some((chunk) => chunk.document?.sourceId === "unified-ai-system-defaults")
  );
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  health,
  sources,
  retrieve,
  conclusion,
  error,
}) {
  const healthData = health?.body?.data;
  const sourcesData = sources?.body?.data;
  const retrieveData = retrieve?.body?.data;

  return {
    phase: PHASE,
    status,
    generatedAt,
    service: {
      url: serviceUrl,
    },
    knowledge: {
      healthHttpStatus: health?.httpStatus ?? null,
      healthStatus: healthData?.status ?? null,
      mode: healthData?.mode ?? null,
      storage: healthData?.storage ?? null,
      embedding: healthData?.embedding ?? null,
      sourceCount: healthData?.sourceCount ?? null,
      documentCount: healthData?.documentCount ?? null,
      supportedModes: healthData?.supportedModes ?? [],
      sourceIds: sourcesData?.sources?.map((source) => source.sourceId) ?? [],
      retrieveHttpStatus: retrieve?.httpStatus ?? null,
      query: retrieveData?.query ?? null,
      retrieveMode: retrieveData?.mode ?? null,
      chunkCount: retrieveData?.chunks?.length ?? 0,
      topChunkDocumentId: retrieveData?.chunks?.[0]?.document?.documentId ?? null,
    },
    error: error ?? null,
    conclusion,
  };
}

