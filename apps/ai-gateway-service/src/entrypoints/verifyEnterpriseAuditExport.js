import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, listen, close } from "./entrypointUtils.js";

const PHASE = "phase-36a-enterprise-audit-export";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-36a-enterprise-audit-export.json");
const evidenceMdPath = resolve(evidenceDir, "phase-36a-enterprise-audit-export.md");

const tenantId = "phase36-tenant";
const adminToken = "phase36-admin-token";
const viewerToken = "phase36-viewer-token";

let server;
let evidence;

try {
  const auditDir = await mkdtemp(resolve(tmpdir(), "phase36a-audit-"));
  const auditLogPath = resolve(auditDir, "enterprise-audit.jsonl");
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_ENTERPRISE_USERS_JSON: JSON.stringify([
      {
        token: adminToken,
        userId: "phase36-admin",
        tenantId,
        role: "admin",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      {
        token: viewerToken,
        userId: "phase36-viewer",
        tenantId,
        role: "viewer",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
    ]),
    PME_AUDIT_LOG_PATH: auditLogPath,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_STORAGE_MODE: "memory",
  });

  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;

  const ui = await fetchText(`${serviceUrl}/ui`);
  const adminDashboard = await fetchJson(`${serviceUrl}/dashboard/status`, {
    headers: createHeaders(adminToken),
  });
  const viewerDeniedWrite = await fetchJson(`${serviceUrl}/knowledge/load`, {
    method: "POST",
    headers: createHeaders(viewerToken),
    body: {
      sourceId: "phase36-denied-source",
      documents: [
        {
          documentId: "phase36-denied-document",
          title: "Denied Audit Document",
          content: "phase36 audit export denied marker",
        },
      ],
    },
  });
  const filteredDenied = await fetchJson(`${serviceUrl}/enterprise/audit?limit=20&outcome=denied&path=${encodeURIComponent("/knowledge/load")}`, {
    headers: createHeaders(adminToken),
  });
  const filteredViewer = await fetchJson(`${serviceUrl}/enterprise/audit?limit=20&userId=phase36-viewer`, {
    headers: createHeaders(adminToken),
  });
  const jsonExport = await fetchJson(`${serviceUrl}/enterprise/audit/export?limit=50&format=json&tenantId=${tenantId}`, {
    headers: createHeaders(adminToken),
  });
  const jsonlExport = await fetchJson(`${serviceUrl}/enterprise/audit/export?limit=50&format=jsonl&outcome=denied`, {
    headers: createHeaders(adminToken),
  });

  const passed = isAuditExportConnected({
    ui,
    adminDashboard,
    viewerDeniedWrite,
    filteredDenied,
    filteredViewer,
    jsonExport,
    jsonlExport,
  });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    auditLogPath,
    ui,
    adminDashboard,
    viewerDeniedWrite,
    filteredDenied,
    filteredViewer,
    jsonExport,
    jsonlExport,
    conclusion: passed ? "enterprise-audit-export-connected" : "enterprise-audit-export-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-audit-export-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isAuditExportConnected({ ui, adminDashboard, viewerDeniedWrite, filteredDenied, filteredViewer, jsonExport, jsonlExport }) {
  const deniedEntries = filteredDenied?.body?.data?.entries ?? [];
  const viewerEntries = filteredViewer?.body?.data?.entries ?? [];
  const jsonContent = jsonExport?.body?.data?.content ?? "";
  const jsonlContent = jsonlExport?.body?.data?.content ?? "";
  return (
    ui?.httpStatus === 200 &&
    ui.text.includes("/enterprise/audit/export") &&
    adminDashboard?.httpStatus === 200 &&
    viewerDeniedWrite?.httpStatus === 403 &&
    filteredDenied?.httpStatus === 200 &&
    filteredDenied.body?.data?.filters?.outcome === "denied" &&
    filteredDenied.body?.data?.filters?.path === "/knowledge/load" &&
    deniedEntries.some((entry) => entry.outcome === "denied" && entry.path === "/knowledge/load") &&
    filteredViewer?.httpStatus === 200 &&
    viewerEntries.every((entry) => entry.userId === "phase36-viewer") &&
    jsonExport?.httpStatus === 200 &&
    jsonExport.body?.data?.format === "json" &&
    jsonExport.body?.data?.entryCount >= 2 &&
    jsonContent.includes("phase36-admin") &&
    jsonlExport?.httpStatus === 200 &&
    jsonlExport.body?.data?.format === "jsonl" &&
    jsonlExport.body?.data?.entryCount >= 1 &&
    jsonlContent.includes("enterprise_permission_forbidden")
  );
}

function createHeaders(token) {
  return {
    "content-type": "application/json",
    "x-pme-auth-token": token,
    "x-pme-tenant-id": tenantId,
  };
}

function createEvidence({ status, generatedAt, serviceUrl, auditLogPath, ui, adminDashboard, viewerDeniedWrite, filteredDenied, filteredViewer, jsonExport, jsonlExport, conclusion, error }) {
  return {
    phase: PHASE,
    status,
    generatedAt,
    serviceUrl: serviceUrl ?? null,
    auditLogPath: auditLogPath ?? null,
    enterprise: {
      uiHttpStatus: ui?.httpStatus ?? null,
      uiAuditExportPresent: Boolean(ui?.text?.includes("/enterprise/audit/export")),
      adminDashboardStatus: adminDashboard?.httpStatus ?? null,
      viewerDeniedWriteStatus: viewerDeniedWrite?.httpStatus ?? null,
      filteredDeniedStatus: filteredDenied?.httpStatus ?? null,
      filteredDeniedTotalMatched: filteredDenied?.body?.data?.totalMatched ?? null,
      filteredViewerStatus: filteredViewer?.httpStatus ?? null,
      filteredViewerTotalMatched: filteredViewer?.body?.data?.totalMatched ?? null,
      jsonExportStatus: jsonExport?.httpStatus ?? null,
      jsonExportFormat: jsonExport?.body?.data?.format ?? null,
      jsonExportEntryCount: jsonExport?.body?.data?.entryCount ?? null,
      jsonlExportStatus: jsonlExport?.httpStatus ?? null,
      jsonlExportFormat: jsonlExport?.body?.data?.format ?? null,
      jsonlExportEntryCount: jsonlExport?.body?.data?.entryCount ?? null,
      jsonlExportHasDeniedCode: Boolean(jsonlExport?.body?.data?.content?.includes("enterprise_permission_forbidden")),
    },
    error: error ?? null,
    conclusion,
  };
}

