import { mkdir, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, listen, close } from "./entrypointUtils.js";

const PHASE = "phase-26a-chat-first-web-console";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-26a-chat-first-web-console.json");
const evidenceMdPath = resolve(evidenceDir, "phase-26a-chat-first-web-console.md");

const sourceId = "phase-26a-chat-first-source";
const documentId = "phase-26a-chat-first-document";
const query = "phase26a chat first business workflow local knowledge";

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
  const ui = await fetchText(`${serviceUrl}/ui`);
  const serviceHealth = await fetchJson(`${serviceUrl}/health/check`);
  const fileLoad = await fetchJson(`${serviceUrl}/knowledge/load/file`, {
    method: "POST",
    body: {
      sourceId,
      sourceTitle: "Phase 26A Chat-first Source",
      metadata: { phase: PHASE },
      files: [
        {
          fileName: `${documentId}.txt`,
          mimeType: "text/plain",
          base64: Buffer.from(
            "phase26a chat first business workflow local knowledge verifies that the chat-first UI auto retrieves knowledge and injects bounded context.",
            "utf8",
          ).toString("base64"),
        },
      ],
    },
  });
  const retrieve = await fetchJson(`${serviceUrl}/knowledge/retrieve`, {
    method: "POST",
    body: {
      context: {
        requestId: "phase-26a-chat-first-retrieve",
        traceId: PHASE,
      },
      query,
      mode: "keyword",
      sourceIds: [sourceId],
      topK: 1,
    },
  });

  const passed = isChatFirstConnected({ ui, serviceHealth, fileLoad, retrieve });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    ui,
    serviceHealth,
    fileLoad,
    retrieve,
    conclusion: passed ? "chat-first-web-console-connected" : "chat-first-web-console-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    ui: null,
    serviceHealth: null,
    fileLoad: null,
    retrieve: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "chat-first-web-console-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isChatFirstConnected({ ui, serviceHealth, fileLoad, retrieve }) {
  const topHit = retrieve?.body?.data?.topHit;

  return (
    ui?.httpStatus === 200 &&
    ui?.contentType?.includes("text/html") &&
    ui?.text?.includes("Chat-first AI workspace") &&
    ui?.text?.includes("本地业务流程自动化") &&
    ui?.text?.includes("chat-input") &&
    ui?.text?.includes("upload-button") &&
    ui?.text?.includes("file-input") &&
    ui?.text?.includes("workflow-run") &&
    ui?.text?.includes("autoKnowledgeEnabled = true") &&
    ui?.text?.includes("knowledgeInjectionMode") &&
    ui?.text?.includes("/knowledge/load/file") &&
    ui?.text?.includes("/chat/rag/stream") &&
    ui?.text?.includes("NVIDIA single-provider chat") &&
    ui?.text?.includes("local-keyword / file-sqlite") &&
    !ui?.text?.includes('class="rail"') &&
    serviceHealth?.httpStatus === 200 &&
    serviceHealth?.body?.status === "ok" &&
    fileLoad?.httpStatus === 200 &&
    fileLoad?.body?.data?.loadedCount === 1 &&
    retrieve?.httpStatus === 200 &&
    retrieve?.body?.data?.mode === "keyword" &&
    topHit?.document?.documentId === `${documentId}.txt` &&
    topHit?.snippet?.includes("chat first")
  );
}

function createEvidence({ status, generatedAt, serviceUrl, ui, serviceHealth, fileLoad, retrieve, conclusion, error }) {
  const retrieveData = retrieve?.body?.data;
  const topHit = retrieveData?.topHit;
  return {
    phase: PHASE,
    status,
    generatedAt,
    ui: {
      url: serviceUrl ? `${serviceUrl}/ui` : null,
      httpStatus: ui?.httpStatus ?? null,
      contentType: ui?.contentType ?? null,
      chatFirstPresent: Boolean(ui?.text?.includes("Chat-first AI workspace")),
      workflowPreviewPresent: Boolean(ui?.text?.includes("本地业务流程自动化")),
      streamingPresent: Boolean(ui?.text?.includes("/chat/rag/stream")),
      chatInputPresent: Boolean(ui?.text?.includes("chat-input")),
      chatFileInputPresent: Boolean(ui?.text?.includes("file-input")),
      uploadButtonPresent: Boolean(ui?.text?.includes("upload-button")),
      autoKnowledgeEnabledPresent: Boolean(ui?.text?.includes("autoKnowledgeEnabled = true")),
      knowledgeInjectionModePresent: Boolean(ui?.text?.includes("knowledgeInjectionMode")),
      noSidebarRailPresent: !Boolean(ui?.text?.includes('class="rail"')),
      fileImportPresent: Boolean(ui?.text?.includes("/knowledge/load/file")),
    },
    service: {
      url: serviceUrl,
      healthHttpStatus: serviceHealth?.httpStatus ?? null,
      healthStatus: serviceHealth?.body?.data?.status ?? null,
    },
    knowledge: {
      fileLoadHttpStatus: fileLoad?.httpStatus ?? null,
      loadedSourceId: sourceId,
      loadedDocumentId: documentId,
      loadedCount: fileLoad?.body?.data?.loadedCount ?? null,
      retrieveHttpStatus: retrieve?.httpStatus ?? null,
      retrieveMode: retrieveData?.mode ?? null,
      query,
      topHitDocumentId: topHit?.document?.documentId ?? null,
      topHitSnippetPresent: Boolean(topHit?.snippet),
      topHitMatchedTerms: topHit?.matchedTerms ?? [],
    },
    error: error ?? null,
    conclusion,
  };
}

