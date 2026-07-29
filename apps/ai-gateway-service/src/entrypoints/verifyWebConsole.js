import { close, fetchContentResponse as fetchText, listen, requestJsonResponse as fetchJson, writeEvidenceFiles } from "./entrypointUtils.js";
import {
  createDocxFixtureBase64,
  createPdfFixtureBase64,
  createXlsxFixtureBase64,
} from "./webConsoleFixtureBuilders.js";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-25a-web-console";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-25a-web-console.json");
const evidenceMdPath = resolve(evidenceDir, "phase-25a-web-console.md");

const sourceId = "phase-25a-ui-source";
const documentId = "phase-25a-ui-document";
const fileSourceId = "phase-25a-file-parser-source";
const query = "phase25a ui console vector readiness snippet scoreBreakdown metadata";
const fileQuery = "phase25a spreadsheet parser file import";

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
  const consoleAlias = await fetchText(`${serviceUrl}/console`);
  const serviceHealth = await fetchJson(`${serviceUrl}/health/check`);
  const knowledgeHealth = await fetchJson(`${serviceUrl}/knowledge/health`);
  const load = await fetchJson(`${serviceUrl}/knowledge/load`, {
    method: "POST",
    body: {
      sourceId,
      sourceTitle: "Phase 25A UI Source",
      metadata: {
        phase: PHASE,
      },
      documents: [
        {
          documentId,
          title: "Phase 25A Web Console Document",
          uri: "unified-ai-system://phase-25a/web-console",
          content:
            "phase25a ui console vector readiness snippet scoreBreakdown metadata proves the Web console can load and retrieve local keyword knowledge.",
          metadata: {
            expectedTopHit: true,
            surface: "web-console",
          },
        },
      ],
    },
  });
  const fileLoad = await fetchJson(`${serviceUrl}/knowledge/load/file`, {
    method: "POST",
    body: {
      sourceId: fileSourceId,
      sourceTitle: "Phase 25A File Parser Source",
      metadata: {
        phase: PHASE,
        surface: "web-console-file-import",
      },
      files: [
        {
          fileName: "phase25a-parser-note.txt",
          mimeType: "text/plain",
          base64: Buffer.from("phase25a file parser note proves text upload still works.", "utf8").toString("base64"),
        },
        {
          fileName: "phase25a-parser-pdf.pdf",
          mimeType: "application/pdf",
          base64: createPdfFixtureBase64(),
        },
        {
          fileName: "phase25a-parser-word.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          base64: createDocxFixtureBase64(),
        },
        {
          fileName: "phase25a-parser-sheet.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          base64: createXlsxFixtureBase64(),
        },
      ],
    },
  });
  const sources = await fetchJson(`${serviceUrl}/knowledge/sources`);
  const retrieve = await fetchJson(`${serviceUrl}/knowledge/retrieve`, {
    method: "POST",
    body: {
      context: {
        requestId: "phase-25a-ui-retrieve",
        traceId: PHASE,
      },
      query,
      mode: "keyword",
      sourceIds: [sourceId],
      topK: 1,
    },
  });
  const fileRetrieve = await fetchJson(`${serviceUrl}/knowledge/retrieve`, {
    method: "POST",
    body: {
      context: {
        requestId: "phase-25a-file-retrieve",
        traceId: `${PHASE}-file-parser`,
      },
      query: fileQuery,
      mode: "keyword",
      sourceIds: [fileSourceId],
      topK: 1,
    },
  });
  const readiness = await fetchJson(`${serviceUrl}/knowledge/infra/readiness`);
  const passed = isWebConsoleConnected({
    ui,
    consoleAlias,
    serviceHealth,
    knowledgeHealth,
    load,
    fileLoad,
    sources,
    retrieve,
    fileRetrieve,
    readiness,
  });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    ui,
    consoleAlias,
    serviceHealth,
    knowledgeHealth,
    load,
    fileLoad,
    sources,
    retrieve,
    fileRetrieve,
    readiness,
    conclusion: passed ? "web-console-operation-surface-connected" : "web-console-operation-surface-not-connected",
  });
  await writeVerifyWebConsoleEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    ui: null,
    consoleAlias: null,
    serviceHealth: null,
    knowledgeHealth: null,
    load: null,
    fileLoad: null,
    sources: null,
    retrieve: null,
    fileRetrieve: null,
    readiness: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-console-operation-surface-not-connected",
  });
  await writeVerifyWebConsoleEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}


function isWebConsoleConnected({
  ui,
  consoleAlias,
  serviceHealth,
  knowledgeHealth,
  load,
  fileLoad,
  sources,
  retrieve,
  fileRetrieve,
  readiness,
}) {
  const source = sources?.body?.data?.sources?.find((item) => item.sourceId === sourceId);
  const fileSource = sources?.body?.data?.sources?.find((item) => item.sourceId === fileSourceId);
  const topHit = retrieve?.body?.data?.topHit;
  const fileTopHit = fileRetrieve?.body?.data?.topHit;

  return (
    ui?.httpStatus === 200 &&
    ui?.contentType?.includes("text/html") &&
    ui?.text?.includes("PME 移动地球 Console") &&
    ui.text.includes("NVIDIA single-provider chat") &&
    ui.text.includes("local-keyword / file-sqlite") &&
    ui.text.includes("/knowledge/load/file") &&
    ui.text.includes("PDF") &&
    ui.text.includes("Word .docx") &&
    ui.text.includes("Excel .xls/.xlsx") &&
    ui.text.includes("100MB") &&
    ui.text.includes("cmd /c pnpm verify:phase24") &&
    ui.text.includes("cmd /c pnpm verify:phase27") &&
    consoleAlias?.httpStatus === 200 &&
    consoleAlias?.text?.includes("PME 移动地球 Console") &&
    serviceHealth?.httpStatus === 200 &&
    serviceHealth?.body?.status === "ok" &&
    knowledgeHealth?.httpStatus === 200 &&
    knowledgeHealth?.body?.data?.mode === "local-keyword" &&
    load?.httpStatus === 200 &&
    load?.body?.data?.loadedCount === 1 &&
    fileLoad?.httpStatus === 200 &&
    fileLoad?.body?.data?.loadedCount === 4 &&
    fileLoad?.body?.data?.skipped?.length === 0 &&
    source?.documentCount === 1 &&
    fileSource?.documentCount === 4 &&
    retrieve?.httpStatus === 200 &&
    retrieve?.body?.data?.mode === "keyword" &&
    topHit?.document?.documentId === documentId &&
    topHit?.snippet?.includes("Web console") &&
    topHit?.matchedTerms?.includes("console") &&
    topHit?.highlights?.length > 0 &&
    topHit?.scoreBreakdown?.matchedTermCount >= 6 &&
    topHit?.document?.metadata?.surface === "web-console" &&
    fileRetrieve?.httpStatus === 200 &&
    fileRetrieve?.body?.data?.mode === "keyword" &&
    fileTopHit?.document?.documentId === "phase25a-parser-sheet.xlsx" &&
    fileTopHit?.snippet?.includes("spreadsheet") &&
    fileTopHit?.document?.metadata?.parser === "xlsx" &&
    readiness?.httpStatus === 200 &&
    readiness?.body?.status === "ok"
  );
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  ui,
  consoleAlias,
  serviceHealth,
  knowledgeHealth,
  load,
  fileLoad,
  sources,
  retrieve,
  fileRetrieve,
  readiness,
  conclusion,
  error,
}) {
  const source = sources?.body?.data?.sources?.find((item) => item.sourceId === sourceId);
  const fileSource = sources?.body?.data?.sources?.find((item) => item.sourceId === fileSourceId);
  const retrieveData = retrieve?.body?.data;
  const topHit = retrieveData?.topHit;
  const fileRetrieveData = fileRetrieve?.body?.data;
  const fileTopHit = fileRetrieveData?.topHit;

  return {
    phase: PHASE,
    status,
    generatedAt,
    ui: {
      url: serviceUrl ? `${serviceUrl}/ui` : null,
      consoleAliasUrl: serviceUrl ? `${serviceUrl}/console` : null,
      httpStatus: ui?.httpStatus ?? null,
      consoleAliasHttpStatus: consoleAlias?.httpStatus ?? null,
      contentType: ui?.contentType ?? null,
      titlePresent: Boolean(ui?.text?.includes("PME 移动地球 Console")),
      boundaryPresent: Boolean(ui?.text?.includes("NVIDIA single-provider chat")),
      commandHintsPresent: Boolean(ui?.text?.includes("cmd /c pnpm verify:phase24")),
      fileImportPresent: Boolean(ui?.text?.includes("/knowledge/load/file")),
      documentParserHintsPresent: Boolean(
        ui?.text?.includes("PDF") && ui?.text?.includes("Word .docx") && ui?.text?.includes("Excel .xls/.xlsx") && ui?.text?.includes("100MB"),
      ),
    },
    service: {
      url: serviceUrl,
      healthHttpStatus: serviceHealth?.httpStatus ?? null,
      healthStatus: serviceHealth?.body?.data?.status ?? null,
    },
    knowledge: {
      healthHttpStatus: knowledgeHealth?.httpStatus ?? null,
      mode: knowledgeHealth?.body?.data?.mode ?? null,
      storage: knowledgeHealth?.body?.data?.storage ?? null,
      embedding: knowledgeHealth?.body?.data?.embedding ?? null,
      loadHttpStatus: load?.httpStatus ?? null,
      fileLoadHttpStatus: fileLoad?.httpStatus ?? null,
      loadedSourceId: sourceId,
      loadedDocumentId: documentId,
      loadedCount: load?.body?.data?.loadedCount ?? null,
      fileSourceId,
      fileLoadedCount: fileLoad?.body?.data?.loadedCount ?? null,
      fileSkipped: fileLoad?.body?.data?.skipped ?? null,
      sourcePresent: Boolean(source),
      sourceDocumentCount: source?.documentCount ?? null,
      fileSourcePresent: Boolean(fileSource),
      fileSourceDocumentCount: fileSource?.documentCount ?? null,
      retrieveHttpStatus: retrieve?.httpStatus ?? null,
      retrieveMode: retrieveData?.mode ?? null,
      query,
      topHitDocumentId: topHit?.document?.documentId ?? null,
      topHitSnippetPresent: Boolean(topHit?.snippet),
      topHitHighlights: topHit?.highlights ?? [],
      topHitMatchedTerms: topHit?.matchedTerms ?? [],
      topHitScoreBreakdown: topHit?.scoreBreakdown ?? null,
      topHitMetadata: topHit?.document?.metadata ?? null,
      fileRetrieveHttpStatus: fileRetrieve?.httpStatus ?? null,
      fileRetrieveMode: fileRetrieveData?.mode ?? null,
      fileQuery,
      fileTopHitDocumentId: fileTopHit?.document?.documentId ?? null,
      fileTopHitParser: fileTopHit?.document?.metadata?.parser ?? null,
      fileTopHitSnippetPresent: Boolean(fileTopHit?.snippet),
    },
    vector: {
      readinessHttpStatus: readiness?.httpStatus ?? null,
      mode: readiness?.body?.data?.mode ?? null,
      status: readiness?.body?.data?.status ?? null,
      enabled: readiness?.body?.data?.enabled ?? null,
    },
    error: error ?? null,
    conclusion,
  };
}

async function writeVerifyWebConsoleEvidence(body) {
  await writeEvidenceFiles({
    evidenceDir,
    evidenceJsonPath,
    evidenceMdPath,
    body,
    renderMarkdown: createEvidenceMarkdown,
  });
}

function createEvidenceMarkdown(body) {
  return `# Phase 25A Web Console Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- UI URL: ${body.ui.url ?? "n/a"}
- UI HTTP status: ${body.ui.httpStatus ?? "n/a"}
- Console alias HTTP status: ${body.ui.consoleAliasHttpStatus ?? "n/a"}
- Content type: ${body.ui.contentType ?? "n/a"}
- Title present: ${body.ui.titlePresent}
- Boundary present: ${body.ui.boundaryPresent}
- Command hints present: ${body.ui.commandHintsPresent}
- File import present: ${body.ui.fileImportPresent}
- Document parser hints present: ${body.ui.documentParserHintsPresent}
- Service health HTTP status: ${body.service.healthHttpStatus ?? "n/a"}
- Service health status: ${body.service.healthStatus ?? "n/a"}
- Knowledge health HTTP status: ${body.knowledge.healthHttpStatus ?? "n/a"}
- Knowledge mode: ${body.knowledge.mode ?? "n/a"}
- Storage: ${body.knowledge.storage ?? "n/a"}
- Embedding: ${body.knowledge.embedding ?? "n/a"}
- Loaded source ID: ${body.knowledge.loadedSourceId}
- Loaded document ID: ${body.knowledge.loadedDocumentId}
- Loaded count: ${body.knowledge.loadedCount ?? "n/a"}
- File parser source ID: ${body.knowledge.fileSourceId}
- File parser loaded count: ${body.knowledge.fileLoadedCount ?? "n/a"}
- File parser skipped: ${body.knowledge.fileSkipped?.length ?? "n/a"}
- Source present: ${body.knowledge.sourcePresent}
- Source document count: ${body.knowledge.sourceDocumentCount ?? "n/a"}
- File source present: ${body.knowledge.fileSourcePresent}
- File source document count: ${body.knowledge.fileSourceDocumentCount ?? "n/a"}
- Retrieve HTTP status: ${body.knowledge.retrieveHttpStatus ?? "n/a"}
- Retrieve mode: ${body.knowledge.retrieveMode ?? "n/a"}
- Top hit document: ${body.knowledge.topHitDocumentId ?? "n/a"}
- Snippet present: ${body.knowledge.topHitSnippetPresent}
- Highlight count: ${body.knowledge.topHitHighlights.length}
- Matched terms: ${body.knowledge.topHitMatchedTerms.join(", ") || "n/a"}
- File retrieve HTTP status: ${body.knowledge.fileRetrieveHttpStatus ?? "n/a"}
- File top hit document: ${body.knowledge.fileTopHitDocumentId ?? "n/a"}
- File top hit parser: ${body.knowledge.fileTopHitParser ?? "n/a"}
- Vector readiness HTTP status: ${body.vector.readinessHttpStatus ?? "n/a"}
- Vector readiness mode: ${body.vector.mode ?? "n/a"}
- Vector readiness status: ${body.vector.status ?? "n/a"}
- Vector enabled: ${body.vector.enabled ?? "n/a"}
- Conclusion: ${body.conclusion}
`;
}
