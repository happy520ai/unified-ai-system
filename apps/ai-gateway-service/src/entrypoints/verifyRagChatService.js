import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayClient } from "../../../../packages/shared-sdk/src/index.js";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-29a-service-rag-chat";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-29a-service-rag-chat.json");
const evidenceMdPath = resolve(evidenceDir, "phase-29a-service-rag-chat.md");

const sourceId = "phase-29a-rag-source";
const documentId = "phase-29a-rag-document";
const marker = "phase29a-service-rag-marker";
const query = "phase29a service rag gateway knowledge citation";

let server;
let evidence;

try {
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");

  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const client = createGatewayClient({
    baseUrl: serviceUrl,
    timeoutMs: 10_000,
  });

  const ui = await fetchText(`${serviceUrl}/ui`);
  const health = await client.health();
  const load = await client.knowledgeLoad({
    sourceId,
    sourceTitle: "Phase 29A Service RAG Source",
    metadata: {
      phase: PHASE,
    },
    documents: [
      {
        documentId,
        title: "Phase 29A Service RAG Document",
        uri: "unified-ai-system://phase-29a/service-rag",
        content:
          "This phase29a service rag document proves the chat endpoint can retrieve knowledge, " +
          `inject citations, and answer through the gateway provider path. ${marker}`,
        metadata: {
          expectedTopHit: true,
          surface: "service-rag-chat",
        },
      },
    ],
  });
  const ragChat = await client.ragChat({
    context: {
      requestId: "phase-29a-rag-chat",
      traceId: PHASE,
    },
    providerId: "local-fake-provider",
    model: "local-fake-model",
    prompt: "请根据本地知识库说明 phase29a service rag 的价值，并给出引用。",
    knowledge: {
      query,
      sourceIds: [sourceId],
      topK: 2,
    },
    metadata: {
      verifier: "verify:phase29a",
    },
  });

  const passed = isRagChatConnected({ ui, health, load, ragChat });
  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    ui,
    health,
    load,
    ragChat,
    conclusion: passed ? "service-rag-chat-connected" : "service-rag-chat-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    ui: null,
    health: null,
    load: null,
    ragChat: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "service-rag-chat-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isRagChatConnected({ ui, health, load, ragChat }) {
  const data = ragChat?.data ?? {};
  const citation = data.knowledge?.citations?.[0];
  const answer = data.answer ?? data.outputText ?? "";

  return (
    ui?.httpStatus === 200 &&
    ui?.text?.includes("PME 移动地球 Console") &&
    ui?.text?.includes("/chat/rag") &&
    ui?.text?.includes("/chat/rag/stream") &&
    ui?.text?.includes("service-side-rag-stream") &&
    ui?.text?.includes("knowledgeInjectionMode") &&
    health?.status === "ok" &&
    health?.data?.routes?.includes("POST /chat/rag") &&
    load?.status === "ok" &&
    load?.data?.loadedCount === 1 &&
    ragChat?.status === "ok" &&
    data.rag?.enabled === true &&
    data.rag?.mode === "service-side" &&
    data.rag?.knowledgeInjected === true &&
    data.knowledge?.retrieved === true &&
    data.knowledge?.topHit?.document?.documentId === documentId &&
    citation?.documentId === documentId &&
    citation?.snippet?.includes(marker) &&
    data.metadata?.selectedProvider === "local-fake-provider" &&
    answer.includes("[fake:local-fake-provider/local-fake-model]") &&
    answer.includes(marker)
  );
}

function listen(targetServer, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    targetServer.once("error", rejectListen);
    targetServer.listen(port, host, () => {
      targetServer.off("error", rejectListen);
      resolveListen();
    });
  });
}

function close(targetServer) {
  return new Promise((resolveClose) => {
    targetServer.close(() => resolveClose());
  });
}

async function fetchText(url) {
  const response = await fetch(url);
  const text = await response.text();

  return {
    httpStatus: response.status,
    contentType: response.headers.get("content-type"),
    text,
  };
}

function createEvidence({ status, generatedAt, serviceUrl, ui, health, load, ragChat, conclusion, error }) {
  const data = ragChat?.data ?? {};
  const citation = data.knowledge?.citations?.[0];

  return {
    phase: PHASE,
    status,
    generatedAt,
    service: {
      url: serviceUrl,
      healthStatus: health?.status ?? null,
      ragRoutePresent: Boolean(health?.data?.routes?.includes("POST /chat/rag")),
    },
    ui: {
      url: serviceUrl ? `${serviceUrl}/ui` : null,
      httpStatus: ui?.httpStatus ?? null,
      titlePresent: Boolean(ui?.text?.includes("PME 移动地球 Console")),
      serviceRagPresent: Boolean(ui?.text?.includes("/chat/rag")),
    },
    knowledge: {
      loadedSourceId: load?.data?.sourceId ?? null,
      loadedCount: load?.data?.loadedCount ?? null,
      query,
      retrieved: data.knowledge?.retrieved ?? false,
      citationCount: data.knowledge?.citations?.length ?? 0,
      topHitDocumentId: data.knowledge?.topHit?.document?.documentId ?? null,
      firstCitationDocumentId: citation?.documentId ?? null,
      firstCitationSnippetPresent: Boolean(citation?.snippet),
      markerMatched: Boolean(citation?.snippet?.includes(marker) && data.answer?.includes(marker)),
    },
    chat: {
      status: ragChat?.status ?? null,
      ragEnabled: data.rag?.enabled ?? null,
      ragMode: data.rag?.mode ?? null,
      knowledgeInjected: data.rag?.knowledgeInjected ?? null,
      selectedProvider: data.metadata?.selectedProvider ?? null,
      selectedModel: data.metadata?.selectedModel ?? null,
      answerPresent: Boolean(data.answer),
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
  return `# Phase 29A Service RAG Chat Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.service.url ?? "n/a"}
- Health status: ${body.service.healthStatus ?? "n/a"}
- RAG route present: ${body.service.ragRoutePresent}
- UI URL: ${body.ui.url ?? "n/a"}
- UI HTTP status: ${body.ui.httpStatus ?? "n/a"}
- UI title present: ${body.ui.titlePresent}
- Service RAG UI present: ${body.ui.serviceRagPresent}
- Loaded source ID: ${body.knowledge.loadedSourceId ?? "n/a"}
- Loaded count: ${body.knowledge.loadedCount ?? "n/a"}
- Query: ${body.knowledge.query}
- Knowledge retrieved: ${body.knowledge.retrieved}
- Citation count: ${body.knowledge.citationCount}
- Top hit document: ${body.knowledge.topHitDocumentId ?? "n/a"}
- First citation document: ${body.knowledge.firstCitationDocumentId ?? "n/a"}
- First citation snippet present: ${body.knowledge.firstCitationSnippetPresent}
- Marker matched in citation and answer: ${body.knowledge.markerMatched}
- RAG enabled: ${body.chat.ragEnabled}
- RAG mode: ${body.chat.ragMode ?? "n/a"}
- Knowledge injected: ${body.chat.knowledgeInjected}
- Selected provider: ${body.chat.selectedProvider ?? "n/a"}
- Selected model: ${body.chat.selectedModel ?? "n/a"}
- Answer present: ${body.chat.answerPresent}
- Conclusion: ${body.conclusion}
`;
}
