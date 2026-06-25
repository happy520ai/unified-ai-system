import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, listen, close } from "./entrypointUtils.js";

const PHASE = "phase-33a-enterprise-admin-console";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-33a-enterprise-admin-console.json");
const evidenceMdPath = resolve(evidenceDir, "phase-33a-enterprise-admin-console.md");

const adminToken = "phase33-admin-token";
const viewerToken = "phase33-viewer-token";
const tenantId = "phase33-tenant";

let server;
let evidence;

try {
  const auditDir = await mkdtemp(resolve(tmpdir(), "phase33a-audit-"));
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_ENTERPRISE_USERS_JSON: JSON.stringify([
      {
        token: adminToken,
        userId: "phase33-admin",
        tenantId,
        role: "admin",
      },
      {
        token: viewerToken,
        userId: "phase33-viewer",
        tenantId,
        role: "viewer",
      },
    ]),
    PME_AUDIT_LOG_PATH: resolve(auditDir, "enterprise-audit.jsonl"),
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_STORAGE_MODE: "memory",
  });

  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;

  const ui = await fetchText(`${serviceUrl}/ui`);
  const enterpriseHealth = await fetchJson(`${serviceUrl}/enterprise/health`);
  const missingSession = await fetchJson(`${serviceUrl}/enterprise/session`);
  const adminSession = await fetchJson(`${serviceUrl}/enterprise/session`, {
    headers: createHeaders(adminToken),
  });
  const adminRoles = await fetchJson(`${serviceUrl}/enterprise/roles`, {
    headers: createHeaders(adminToken),
  });
  const adminDashboard = await fetchJson(`${serviceUrl}/dashboard/status`, {
    headers: createHeaders(adminToken),
  });
  const viewerKnowledgeWriteDenied = await fetchJson(`${serviceUrl}/knowledge/load`, {
    method: "POST",
    headers: createHeaders(viewerToken),
    body: {
      sourceId: "phase33-viewer-denied-source",
      documents: [
        {
          documentId: "phase33-viewer-denied-document",
          title: "Denied Enterprise Console Document",
          content: "Viewer write should be denied by Phase33A enterprise console verification.",
        },
      ],
    },
  });
  const adminAudit = await fetchJson(`${serviceUrl}/enterprise/audit?limit=20`, {
    headers: createHeaders(adminToken),
  });

  const passed = isEnterpriseConsoleConnected({
    ui,
    enterpriseHealth,
    missingSession,
    adminSession,
    adminRoles,
    adminDashboard,
    viewerKnowledgeWriteDenied,
    adminAudit,
  });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    ui,
    enterpriseHealth,
    missingSession,
    adminSession,
    adminRoles,
    adminDashboard,
    viewerKnowledgeWriteDenied,
    adminAudit,
    conclusion: passed ? "enterprise-admin-console-connected" : "enterprise-admin-console-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-admin-console-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isEnterpriseConsoleConnected({
  ui,
  enterpriseHealth,
  missingSession,
  adminSession,
  adminRoles,
  adminDashboard,
  viewerKnowledgeWriteDenied,
  adminAudit,
}) {
  const auditEntries = adminAudit?.body?.data?.entries ?? [];

  return (
    ui?.httpStatus === 200 &&
    ui?.text?.includes("Enterprise Governance") &&
    ui.text.includes("/enterprise/health") &&
    ui.text.includes("/enterprise/session") &&
    ui.text.includes("/enterprise/roles") &&
    ui.text.includes("/enterprise/audit?limit=20") &&
    enterpriseHealth?.httpStatus === 200 &&
    enterpriseHealth.body?.data?.authEnabled === true &&
    missingSession?.httpStatus === 401 &&
    adminSession?.httpStatus === 200 &&
    adminSession.body?.data?.identity?.userId === "phase33-admin" &&
    adminRoles?.httpStatus === 200 &&
    adminRoles.body?.data?.roles?.some((role) => role.role === "admin" && role.permissions.includes("*")) &&
    adminDashboard?.httpStatus === 200 &&
    viewerKnowledgeWriteDenied?.httpStatus === 403 &&
    adminAudit?.httpStatus === 200 &&
    auditEntries.some((entry) => entry.outcome === "allowed" && entry.path === "/dashboard/status") &&
    auditEntries.some((entry) => entry.outcome === "denied" && entry.path === "/knowledge/load")
  );
}

function createHeaders(token) {
  return {
    "content-type": "application/json",
    "x-pme-auth-token": token,
    "x-pme-tenant-id": tenantId,
  };
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  ui,
  enterpriseHealth,
  missingSession,
  adminSession,
  adminRoles,
  adminDashboard,
  viewerKnowledgeWriteDenied,
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
    ui: {
      httpStatus: ui?.httpStatus ?? null,
      contentType: ui?.contentType ?? null,
      enterprisePanelPresent: Boolean(ui?.text?.includes("Enterprise Governance")),
      enterpriseHealthButtonPresent: Boolean(ui?.text?.includes("/enterprise/health")),
      enterpriseSessionButtonPresent: Boolean(ui?.text?.includes("/enterprise/session")),
      enterpriseRolesButtonPresent: Boolean(ui?.text?.includes("/enterprise/roles")),
      enterpriseAuditButtonPresent: Boolean(ui?.text?.includes("/enterprise/audit?limit=20")),
    },
    enterprise: {
      healthHttpStatus: enterpriseHealth?.httpStatus ?? null,
      authEnabled: enterpriseHealth?.body?.data?.authEnabled ?? null,
      missingSessionStatus: missingSession?.httpStatus ?? null,
      adminSessionStatus: adminSession?.httpStatus ?? null,
      adminUserId: adminSession?.body?.data?.identity?.userId ?? null,
      adminTenantId: adminSession?.body?.data?.identity?.tenantId ?? null,
      rolesHttpStatus: adminRoles?.httpStatus ?? null,
      roleCount: adminRoles?.body?.data?.roles?.length ?? null,
      dashboardHttpStatus: adminDashboard?.httpStatus ?? null,
      viewerKnowledgeWriteStatus: viewerKnowledgeWriteDenied?.httpStatus ?? null,
      auditHttpStatus: adminAudit?.httpStatus ?? null,
      auditEntryCount: auditEntries.length,
      allowedDashboardRecorded: auditEntries.some((entry) => entry.outcome === "allowed" && entry.path === "/dashboard/status"),
      deniedKnowledgeWriteRecorded: auditEntries.some((entry) => entry.outcome === "denied" && entry.path === "/knowledge/load"),
    },
    error: error ?? null,
    conclusion,
  };
}

