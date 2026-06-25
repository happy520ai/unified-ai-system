import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, listen, close } from "./entrypointUtils.js";

const PHASE = "phase-32a-enterprise-governance";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-32a-enterprise-governance.json");
const evidenceMdPath = resolve(evidenceDir, "phase-32a-enterprise-governance.md");

const adminToken = "phase32-admin-token";
const viewerToken = "phase32-viewer-token";
const tenantId = "phase32-tenant";

let server;
let evidence;

try {
  const auditDir = await mkdtemp(resolve(tmpdir(), "phase32a-audit-"));
  const auditLogPath = resolve(auditDir, "enterprise-audit.jsonl");
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_ENTERPRISE_USERS_JSON: JSON.stringify([
      {
        token: adminToken,
        userId: "phase32-admin",
        tenantId,
        role: "admin",
      },
      {
        token: viewerToken,
        userId: "phase32-viewer",
        tenantId,
        role: "viewer",
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

  const health = await fetchJson(`${serviceUrl}/enterprise/health`);
  const missingSession = await fetchJson(`${serviceUrl}/enterprise/session`);
  const adminSession = await fetchJson(`${serviceUrl}/enterprise/session`, {
    headers: createHeaders(adminToken),
  });
  const roles = await fetchJson(`${serviceUrl}/enterprise/roles`, {
    headers: createHeaders(adminToken),
  });
  const viewerDashboard = await fetchJson(`${serviceUrl}/dashboard/status`, {
    headers: createHeaders(viewerToken),
  });
  const viewerKnowledgeLoadDenied = await fetchJson(`${serviceUrl}/knowledge/load`, {
    method: "POST",
    headers: createHeaders(viewerToken),
    body: {
      sourceId: "phase32-viewer-denied-source",
      documents: [
        {
          documentId: "phase32-viewer-denied-document",
          title: "Denied Document",
          content: "This should not be written by a viewer role.",
        },
      ],
    },
  });
  const adminKnowledgeLoad = await fetchJson(`${serviceUrl}/knowledge/load`, {
    method: "POST",
    headers: createHeaders(adminToken),
    body: {
      sourceId: "phase32-admin-source",
      documents: [
        {
          documentId: "phase32-admin-document",
          title: "Admin Document",
          content: "phase32 enterprise governance audit rbac tenant marker",
        },
      ],
    },
  });
  const viewerAuditDenied = await fetchJson(`${serviceUrl}/enterprise/audit`, {
    headers: createHeaders(viewerToken),
  });
  const adminAudit = await fetchJson(`${serviceUrl}/enterprise/audit?limit=20`, {
    headers: createHeaders(adminToken),
  });

  const passed = isEnterpriseGovernanceConnected({
    health,
    missingSession,
    adminSession,
    roles,
    viewerDashboard,
    viewerKnowledgeLoadDenied,
    adminKnowledgeLoad,
    viewerAuditDenied,
    adminAudit,
  });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    auditLogPath,
    health,
    missingSession,
    adminSession,
    roles,
    viewerDashboard,
    viewerKnowledgeLoadDenied,
    adminKnowledgeLoad,
    viewerAuditDenied,
    adminAudit,
    conclusion: passed ? "enterprise-governance-connected" : "enterprise-governance-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-governance-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isEnterpriseGovernanceConnected({ health, missingSession, adminSession, roles, viewerDashboard, viewerKnowledgeLoadDenied, adminKnowledgeLoad, viewerAuditDenied, adminAudit }) {
  const auditEntries = adminAudit.body?.data?.entries ?? [];
  return (
    health.httpStatus === 200 &&
    health.body?.data?.authEnabled === true &&
    missingSession.httpStatus === 401 &&
    adminSession.httpStatus === 200 &&
    adminSession.body?.data?.identity?.userId === "phase32-admin" &&
    adminSession.body?.data?.identity?.tenantId === tenantId &&
    roles.httpStatus === 200 &&
    roles.body?.data?.roles?.some((role) => role.role === "admin" && role.permissions.includes("*")) &&
    viewerDashboard.httpStatus === 200 &&
    viewerKnowledgeLoadDenied.httpStatus === 403 &&
    adminKnowledgeLoad.httpStatus === 200 &&
    adminKnowledgeLoad.body?.data?.loadedCount === 1 &&
    viewerAuditDenied.httpStatus === 403 &&
    adminAudit.httpStatus === 200 &&
    auditEntries.some((entry) => entry.outcome === "denied" && entry.path === "/knowledge/load") &&
    auditEntries.some((entry) => entry.outcome === "allowed" && entry.path === "/dashboard/status")
  );
}

function createHeaders(token) {
  return {
    "x-pme-auth-token": token,
    "x-pme-tenant-id": tenantId,
  };
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  auditLogPath,
  health,
  missingSession,
  adminSession,
  roles,
  viewerDashboard,
  viewerKnowledgeLoadDenied,
  adminKnowledgeLoad,
  viewerAuditDenied,
  adminAudit,
  conclusion,
  error,
}) {
  const auditEntries = adminAudit?.body?.data?.entries ?? [];
  return {
    phase: PHASE,
    status,
    generatedAt,
    serviceUrl: serviceUrl ?? null,
    enterprise: {
      healthHttpStatus: health?.httpStatus ?? null,
      authEnabled: health?.body?.data?.authEnabled ?? null,
      roles: roles?.body?.data?.roles?.map((role) => role.role) ?? [],
      auditLogPath: auditLogPath ?? null,
      auditEntryCount: auditEntries.length,
    },
    auth: {
      missingTokenStatus: missingSession?.httpStatus ?? null,
      adminSessionStatus: adminSession?.httpStatus ?? null,
      adminUserId: adminSession?.body?.data?.identity?.userId ?? null,
      adminTenantId: adminSession?.body?.data?.identity?.tenantId ?? null,
    },
    rbac: {
      viewerDashboardStatus: viewerDashboard?.httpStatus ?? null,
      viewerKnowledgeWriteStatus: viewerKnowledgeLoadDenied?.httpStatus ?? null,
      adminKnowledgeWriteStatus: adminKnowledgeLoad?.httpStatus ?? null,
      viewerAuditStatus: viewerAuditDenied?.httpStatus ?? null,
      adminAuditStatus: adminAudit?.httpStatus ?? null,
    },
    audit: {
      deniedKnowledgeWriteRecorded: auditEntries.some((entry) => entry.outcome === "denied" && entry.path === "/knowledge/load"),
      allowedDashboardReadRecorded: auditEntries.some((entry) => entry.outcome === "allowed" && entry.path === "/dashboard/status"),
    },
    error: error ?? null,
    conclusion,
  };
}

