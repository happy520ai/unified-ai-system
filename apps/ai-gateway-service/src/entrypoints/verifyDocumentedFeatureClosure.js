import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-28a-documented-feature-closure";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-28a-documented-feature-closure.json");
const evidenceMdPath = resolve(evidenceDir, "phase-28a-documented-feature-closure.md");

const sourceId = "phase-28a-documented-feature-source";
const fileName = "phase28a-documented-feature.md";
const query = "phase28a documented feature closure file sqlite chat first";

let tempDir;
let server;
let application;
let evidence;

try {
  tempDir = await mkdtemp(join(tmpdir(), "phase28a-documented-feature-"));
  application = createGatewayApplication({
    ...process.env,
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "file-sqlite",
    KNOWLEDGE_PERSISTENCE_DIR: tempDir,
    KNOWLEDGE_FILE_STORE_PATH: join(tempDir, "knowledge-documents.json"),
    KNOWLEDGE_SQLITE_PATH: join(tempDir, "knowledge-documents.sqlite"),
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");

  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const docs = await readDocs();
  const ui = await fetchText(`${serviceUrl}/ui`);
  const health = await fetchJson(`${serviceUrl}/health/check`);
  const knowledgeHealth = await fetchJson(`${serviceUrl}/knowledge/health`);
  const fileTypes = await fetchJson(`${serviceUrl}/knowledge/file-types`);
  const fileLoad = await fetchJson(`${serviceUrl}/knowledge/load/file`, {
    method: "POST",
    body: {
      sourceId,
      sourceTitle: "Phase 28A Documented Feature Source",
      metadata: {
        phase: PHASE,
      },
      files: [
        {
          fileName,
          mimeType: "text/markdown",
          base64: Buffer.from(
            [
              "# Phase 28A documented feature closure",
              "",
              "This phase28a document proves the documented feature set is connected.",
              "It covers chat first UI, local keyword retrieval, file sqlite persistence, and bounded file import.",
            ].join("\n"),
            "utf8",
          ).toString("base64"),
        },
      ],
    },
  });
  const retrieve = await fetchJson(`${serviceUrl}/knowledge/retrieve`, {
    method: "POST",
    body: {
      query,
      mode: "keyword",
      sourceIds: [sourceId],
      topK: 1,
      context: {
        requestId: "phase-28a-documented-feature-retrieve",
        traceId: PHASE,
      },
    },
  });
  const readiness = await fetchJson(`${serviceUrl}/knowledge/infra/readiness`);

  const passed = isDocumentedFeatureClosureConnected({
    docs,
    ui,
    health,
    knowledgeHealth,
    fileTypes,
    fileLoad,
    retrieve,
    readiness,
  });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    docs,
    ui,
    health,
    knowledgeHealth,
    fileTypes,
    fileLoad,
    retrieve,
    readiness,
    conclusion: passed ? "documented-current-feature-set-connected" : "documented-current-feature-set-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    docs: null,
    ui: null,
    health: null,
    knowledgeHealth: null,
    fileTypes: null,
    fileLoad: null,
    retrieve: null,
    readiness: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "documented-current-feature-set-failed",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
  application?.knowledgeService?.close?.();
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
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

async function readDocs() {
  const files = {
    readme: "README.md",
    agents: "AGENTS.md",
    deliveryGuide: "docs/DELIVERY_GUIDE.md",
    operationManual: "docs/OPERATION_MANUAL.md",
  };
  const entries = await Promise.all(
    Object.entries(files).map(async ([key, relativePath]) => [key, await readFile(resolve(repoRoot, relativePath), "utf8")]),
  );

  return Object.fromEntries(entries);
}

function isDocumentedFeatureClosureConnected({ docs, ui, health, knowledgeHealth, fileTypes, fileLoad, retrieve, readiness }) {
  const supported = fileTypes?.body?.data?.supported ?? {};
  const topHit = retrieve?.body?.data?.topHit;

  return (
    docsContainCurrentFeatureSet(docs) &&
    ui?.httpStatus === 200 &&
    ui?.contentType?.includes("text/html") &&
    ui.text.includes("PME 移动地球 Console") &&
    ui.text.includes("Chat-first AI workspace") &&
    ui.text.includes("local-keyword / file-sqlite") &&
    ui.text.includes("支持格式") &&
    ui.text.includes("cmd /c pnpm verify:phase27") &&
    !ui.text.includes("重启后临时导入会清空") &&
    health?.httpStatus === 200 &&
    health?.body?.status === "ok" &&
    knowledgeHealth?.httpStatus === 200 &&
    knowledgeHealth?.body?.data?.mode === "local-keyword" &&
    knowledgeHealth?.body?.data?.storage === "file-sqlite" &&
    supported.maxFileMegabytes === 100 &&
    supported.pdf?.includes(".pdf") &&
    supported.word?.includes(".docx") &&
    supported.excel?.includes(".xls") &&
    supported.excel?.includes(".xlsx") &&
    fileLoad?.httpStatus === 200 &&
    fileLoad?.body?.data?.loadedCount === 1 &&
    retrieve?.httpStatus === 200 &&
    retrieve?.body?.data?.mode === "keyword" &&
    topHit?.document?.documentId === fileName &&
    topHit?.snippet?.includes("documented feature set") &&
    topHit?.matchedTerms?.includes("phase28a") &&
    readiness?.httpStatus === 200 &&
    readiness?.body?.status === "ok"
  );
}

function docsContainCurrentFeatureSet(docs = {}) {
  const combined = Object.values(docs).join("\n");
  const requiredMarkers = [
    "cmd /c pnpm dev:phase7b",
    "cmd /c pnpm status:phase10a",
    "cmd /c pnpm health:phase12a",
    "cmd /c pnpm logs:phase16a",
    "cmd /c pnpm idle:phase15a",
    "cmd /c pnpm verify:phase21",
    "cmd /c pnpm verify:phase22",
    "cmd /c pnpm verify:phase23",
    "cmd /c pnpm verify:phase24",
    "cmd /c pnpm verify:phase25a",
    "cmd /c pnpm verify:phase26a",
    "cmd /c pnpm verify:phase27",
    "POST /knowledge/load/file",
    "GET /knowledge/file-types",
    "file-sqlite",
    "NVIDIA single-provider",
    "DataEyes",
    "GraphRAG",
    "release automation",
  ];

  return requiredMarkers.every((marker) => combined.includes(marker));
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  docs,
  ui,
  health,
  knowledgeHealth,
  fileTypes,
  fileLoad,
  retrieve,
  readiness,
  conclusion,
  error,
}) {
  const topHit = retrieve?.body?.data?.topHit;
  const supported = fileTypes?.body?.data?.supported ?? {};

  return {
    phase: PHASE,
    status,
    generatedAt,
    docs: {
      featureSetMarkersPresent: docs ? docsContainCurrentFeatureSet(docs) : false,
      readmePresent: Boolean(docs?.readme),
      agentsPresent: Boolean(docs?.agents),
      deliveryGuidePresent: Boolean(docs?.deliveryGuide),
      operationManualPresent: Boolean(docs?.operationManual),
    },
    ui: {
      url: serviceUrl ? `${serviceUrl}/ui` : null,
      httpStatus: ui?.httpStatus ?? null,
      titlePresent: Boolean(ui?.text?.includes("PME 移动地球 Console")),
      chatFirstPresent: Boolean(ui?.text?.includes("Chat-first AI workspace")),
      persistenceTextPresent: Boolean(ui?.text?.includes("local-keyword / file-sqlite")),
      staleMemoryWarningAbsent: !Boolean(ui?.text?.includes("重启后临时导入会清空")),
    },
    service: {
      healthHttpStatus: health?.httpStatus ?? null,
      healthStatus: health?.body?.data?.status ?? null,
    },
    knowledge: {
      healthHttpStatus: knowledgeHealth?.httpStatus ?? null,
      mode: knowledgeHealth?.body?.data?.mode ?? null,
      storage: knowledgeHealth?.body?.data?.storage ?? null,
      maxFileMegabytes: supported.maxFileMegabytes ?? null,
      pdfSupported: Boolean(supported.pdf?.includes(".pdf")),
      wordSupported: Boolean(supported.word?.includes(".docx")),
      excelSupported: Boolean(supported.excel?.includes(".xls") && supported.excel?.includes(".xlsx")),
      fileLoadHttpStatus: fileLoad?.httpStatus ?? null,
      fileLoadedCount: fileLoad?.body?.data?.loadedCount ?? null,
      retrieveHttpStatus: retrieve?.httpStatus ?? null,
      retrieveMode: retrieve?.body?.data?.mode ?? null,
      query,
      topHitDocumentId: topHit?.document?.documentId ?? null,
      topHitSnippetPresent: Boolean(topHit?.snippet),
      topHitMatchedTerms: topHit?.matchedTerms ?? [],
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

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 28A Documented Feature Closure Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Docs current feature markers present: ${body.docs.featureSetMarkersPresent}
- UI URL: ${body.ui.url ?? "n/a"}
- UI HTTP status: ${body.ui.httpStatus ?? "n/a"}
- UI title present: ${body.ui.titlePresent}
- Chat-first present: ${body.ui.chatFirstPresent}
- Persistence text present: ${body.ui.persistenceTextPresent}
- Stale memory warning absent: ${body.ui.staleMemoryWarningAbsent}
- Service health HTTP status: ${body.service.healthHttpStatus ?? "n/a"}
- Service health status: ${body.service.healthStatus ?? "n/a"}
- Knowledge health HTTP status: ${body.knowledge.healthHttpStatus ?? "n/a"}
- Knowledge mode: ${body.knowledge.mode ?? "n/a"}
- Knowledge storage: ${body.knowledge.storage ?? "n/a"}
- Max file MB: ${body.knowledge.maxFileMegabytes ?? "n/a"}
- PDF supported: ${body.knowledge.pdfSupported}
- Word supported: ${body.knowledge.wordSupported}
- Excel supported: ${body.knowledge.excelSupported}
- File load HTTP status: ${body.knowledge.fileLoadHttpStatus ?? "n/a"}
- File loaded count: ${body.knowledge.fileLoadedCount ?? "n/a"}
- Retrieve HTTP status: ${body.knowledge.retrieveHttpStatus ?? "n/a"}
- Retrieve top hit: ${body.knowledge.topHitDocumentId ?? "n/a"}
- Retrieve snippet present: ${body.knowledge.topHitSnippetPresent}
- Matched terms: ${body.knowledge.topHitMatchedTerms.join(", ") || "n/a"}
- Vector readiness mode: ${body.vector.mode ?? "n/a"}
- Vector readiness status: ${body.vector.status ?? "n/a"}
- Conclusion: ${body.conclusion}
`;
}
