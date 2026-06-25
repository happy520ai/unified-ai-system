import { mkdir, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, listen, close } from "./entrypointUtils.js";

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
const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

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
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
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
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
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


function createXlsxFixtureBase64() {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["marker", "description"],
    ["phase25a", "spreadsheet parser file import proves Excel upload works"],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Evidence");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  return Buffer.from(buffer).toString("base64");
}

function createPdfFixtureBase64() {
  const pdf = `%PDF-1.1
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 56 >>
stream
BT /F1 18 Tf 72 72 Td (phase25a pdf parser import) Tj ET
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF`;
  return Buffer.from(pdf, "utf8").toString("base64");
}

function createDocxFixtureBase64() {
  const files = [
    {
      name: "[Content_Types].xml",
      text:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        "</Types>",
    },
    {
      name: "_rels/.rels",
      text:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        "</Relationships>",
    },
    {
      name: "word/document.xml",
      text:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        "<w:body><w:p><w:r><w:t>phase25a word parser import</w:t></w:r></w:p></w:body>" +
        "</w:document>",
    },
  ];

  return createStoredZip(files).toString("base64");
}

function createStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = getDosDateTime(new Date("2026-01-01T00:00:00Z"));

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.text, "utf8");
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + data.length;
  }

  const local = Buffer.concat(localParts);
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(local.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([local, central, end]);
}

function getDosDateTime(date) {
  return {
    dosTime: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2),
    dosDate: ((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

