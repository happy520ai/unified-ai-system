import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../../ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../../ai-gateway-service/src/http/httpServer.js";
import { createGatewayClient } from "@unified-ai-system/shared-sdk";
import { listen, close, writeEvidenceWithRenderer } from "../../../ai-gateway-service/src/entrypoints/entrypointUtils.js"


const PHASE = "phase-21c-console-knowledge-chain";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-21c-console-knowledge-chain.json");
const evidenceMdPath = resolve(evidenceDir, "phase-21c-console-knowledge-chain.md");

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
  const client = createGatewayClient({
    baseUrl: serviceUrl,
    timeoutMs: 10_000,
  });
  const load = await client.knowledgeLoad({
    sourceId: loadedSourceId,
    sourceTitle: "Phase 21B Local Source",
    metadata: {
      phase: PHASE,
      caller: "agent-console",
    },
    documents: [
      {
        documentId: loadedDocumentId,
        title: "Phase 21B Loaded Document",
        uri: "unified-ai-system://phase-21b/local-document",
        content:
          "This locally loaded document proves the Phase 21C agent-console to knowledge path. " +
          `${loadedKeyword} should be retrievable by the upper entry through the shared SDK.`,
        metadata: {
          loadedBy: "verify:phase21c",
        },
      },
    ],
  });
  const retrieve = await client.knowledgeRetrieve({
    context: {
      requestId: "agent-console-phase-21c-knowledge-retrieve",
      traceId: PHASE,
    },
    query: loadedKeyword,
    mode: "keyword",
    sourceIds: [loadedSourceId],
    topK: 1,
  });
  const connected = isKnowledgeServiceChainConnected({ load, retrieve });

  evidence = createEvidence({
    status: connected ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    load,
    retrieve,
    conclusion: connected
      ? "agent-console-to-knowledge-service-connected"
      : "agent-console-to-knowledge-service-not-connected",
  });
  await saveEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = connected ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    load: null,
    retrieve: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "agent-console-to-knowledge-service-not-connected",
  });
  await saveEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isKnowledgeServiceChainConnected({ load, retrieve }) {
  const chunk = retrieve?.data?.chunks?.[0];

  return (
    load?.status === "ok" &&
    load?.data?.status === "loaded" &&
    load?.data?.sourceId === loadedSourceId &&
    load?.data?.loadedCount === 1 &&
    retrieve?.status === "ok" &&
    retrieve?.data?.mode === "keyword" &&
    retrieve?.data?.chunks?.length === 1 &&
    chunk?.document?.sourceId === loadedSourceId &&
    chunk?.document?.documentId === loadedDocumentId &&
    chunk?.text?.includes(loadedKeyword)
  );
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  load,
  retrieve,
  conclusion,
  error,
}) {
  const chunk = retrieve?.data?.chunks?.[0];

  return {
    phase: PHASE,
    status,
    generatedAt,
    service: {
      url: serviceUrl,
    },
    console: {
      caller: "agent-console",
      sdkMethods: ["knowledgeLoad", "knowledgeRetrieve"],
    },
    knowledge: {
      loadStatus: load?.status ?? null,
      loadedSourceId: load?.data?.sourceId ?? null,
      loadedCount: load?.data?.loadedCount ?? null,
      documentCount: load?.data?.documentCount ?? null,
      retrieveStatus: retrieve?.status ?? null,
      query: retrieve?.data?.query ?? null,
      retrieveMode: retrieve?.data?.mode ?? null,
      chunkCount: retrieve?.data?.chunks?.length ?? 0,
      topChunkDocumentId: chunk?.document?.documentId ?? null,
      topChunkSourceId: chunk?.document?.sourceId ?? null,
      markerMatched: Boolean(chunk?.text?.includes(loadedKeyword)),
      meta: retrieve?.meta ?? null,
    },
    error: error ?? null,
    conclusion,
  };
}

async function saveEvidence(body) {
  await writeEvidenceWithRenderer(evidenceDir, evidenceJsonPath, evidenceMdPath, body, renderEvidenceMarkdown);
}

function renderEvidenceMarkdown(body) {
  return `# Phase 21C Console Knowledge Chain Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.service.url ?? "n/a"}
- Console caller: ${body.console.caller}
- SDK methods: ${body.console.sdkMethods.join(", ")}
- Load status: ${body.knowledge.loadStatus ?? "n/a"}
- Loaded source ID: ${body.knowledge.loadedSourceId ?? "n/a"}
- Loaded count: ${body.knowledge.loadedCount ?? "n/a"}
- Document count: ${body.knowledge.documentCount ?? "n/a"}
- Retrieve status: ${body.knowledge.retrieveStatus ?? "n/a"}
- Retrieve mode: ${body.knowledge.retrieveMode ?? "n/a"}
- Retrieved chunks: ${body.knowledge.chunkCount}
- Top chunk source: ${body.knowledge.topChunkSourceId ?? "n/a"}
- Top chunk document: ${body.knowledge.topChunkDocumentId ?? "n/a"}
- Marker matched: ${body.knowledge.markerMatched}
- Conclusion: ${body.conclusion}
`;
}
