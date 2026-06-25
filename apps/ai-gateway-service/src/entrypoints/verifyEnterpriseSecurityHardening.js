import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, listen, close } from "./entrypointUtils.js";

const PHASE = "phase-34a-enterprise-security-hardening";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-34a-enterprise-security-hardening.json");
const evidenceMdPath = resolve(evidenceDir, "phase-34a-enterprise-security-hardening.md");

const tenantId = "phase34-tenant";
const adminToken = "phase34-admin-token";
const auditorToken = "phase34-auditor-token";
const viewerToken = "phase34-viewer-token";
const expiredToken = "phase34-expired-token";
const revokedToken = "phase34-revoked-token";

let server;
let evidence;

try {
  const auditDir = await mkdtemp(resolve(tmpdir(), "phase34a-audit-"));
  const auditLogPath = resolve(auditDir, "enterprise-audit.jsonl");
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_ENTERPRISE_REVOKED_TOKENS: revokedToken,
    PME_ENTERPRISE_USERS_JSON: JSON.stringify([
      {
        token: adminToken,
        userId: "phase34-admin",
        tenantId,
        role: "admin",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      {
        token: auditorToken,
        userId: "phase34-auditor",
        tenantId,
        role: "auditor",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      {
        token: viewerToken,
        userId: "phase34-viewer",
        tenantId,
        role: "viewer",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      {
        token: expiredToken,
        userId: "phase34-expired",
        tenantId,
        role: "admin",
        expiresAt: "2000-01-01T00:00:00.000Z",
      },
      {
        token: revokedToken,
        userId: "phase34-revoked",
        tenantId,
        role: "admin",
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
  const health = await fetchJson(`${serviceUrl}/enterprise/health`);
  const adminReadiness = await fetchJson(`${serviceUrl}/enterprise/security/readiness`, {
    headers: createHeaders(adminToken),
  });
  const auditorReadiness = await fetchJson(`${serviceUrl}/enterprise/security/readiness`, {
    headers: createHeaders(auditorToken),
  });
  const missingReadiness = await fetchJson(`${serviceUrl}/enterprise/security/readiness`);
  const expiredSession = await fetchJson(`${serviceUrl}/enterprise/session`, {
    headers: createHeaders(expiredToken),
  });
  const revokedSession = await fetchJson(`${serviceUrl}/enterprise/session`, {
    headers: createHeaders(revokedToken),
  });
  const crossTenantDashboard = await fetchJson(`${serviceUrl}/dashboard/status`, {
    headers: createHeaders(viewerToken, "phase34-other-tenant"),
  });
  const viewerAuditDenied = await fetchJson(`${serviceUrl}/enterprise/audit`, {
    headers: createHeaders(viewerToken),
  });
  const adminDashboard = await fetchJson(`${serviceUrl}/dashboard/status`, {
    headers: createHeaders(adminToken),
  });
  const adminAudit = await fetchJson(`${serviceUrl}/enterprise/audit?limit=50`, {
    headers: createHeaders(adminToken),
  });

  const passed = isEnterpriseSecurityHardened({
    ui,
    health,
    adminReadiness,
    auditorReadiness,
    missingReadiness,
    expiredSession,
    revokedSession,
    crossTenantDashboard,
    viewerAuditDenied,
    adminDashboard,
    adminAudit,
  });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    auditLogPath,
    ui,
    health,
    adminReadiness,
    auditorReadiness,
    missingReadiness,
    expiredSession,
    revokedSession,
    crossTenantDashboard,
    viewerAuditDenied,
    adminDashboard,
    adminAudit,
    conclusion: passed ? "enterprise-security-hardening-connected" : "enterprise-security-hardening-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-security-hardening-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isEnterpriseSecurityHardened({
  ui,
  health,
  adminReadiness,
  auditorReadiness,
  missingReadiness,
  expiredSession,
  revokedSession,
  crossTenantDashboard,
  viewerAuditDenied,
  adminDashboard,
  adminAudit,
}) {
  const auditEntries = adminAudit?.body?.data?.entries ?? [];
  return (
    ui?.httpStatus === 200 &&
    ui.text.includes("/enterprise/security/readiness") &&
    health?.httpStatus === 200 &&
    health.body?.data?.security?.tokenExpirySupported === true &&
    health.body?.data?.security?.tokenRevocationSupported === true &&
    adminReadiness?.httpStatus === 200 &&
    adminReadiness.body?.data?.status === "ready" &&
    adminReadiness.body?.data?.userStore?.activeUserCount === 3 &&
    adminReadiness.body?.data?.userStore?.expiredUserCount === 1 &&
    adminReadiness.body?.data?.userStore?.revokedUserCount >= 1 &&
    adminReadiness.body?.data?.tokenPolicy?.tokenValuesExposed === false &&
    auditorReadiness?.httpStatus === 200 &&
    missingReadiness?.httpStatus === 401 &&
    expiredSession?.httpStatus === 401 &&
    expiredSession.body?.error?.code === "enterprise_token_expired" &&
    revokedSession?.httpStatus === 401 &&
    revokedSession.body?.error?.code === "enterprise_token_revoked" &&
    crossTenantDashboard?.httpStatus === 403 &&
    crossTenantDashboard.body?.error?.code === "enterprise_tenant_forbidden" &&
    viewerAuditDenied?.httpStatus === 403 &&
    adminDashboard?.httpStatus === 200 &&
    adminAudit?.httpStatus === 200 &&
    auditEntries.some((entry) => entry.code === "enterprise_token_expired") &&
    auditEntries.some((entry) => entry.code === "enterprise_token_revoked") &&
    auditEntries.some((entry) => entry.code === "enterprise_tenant_forbidden")
  );
}

function createHeaders(token, selectedTenantId = tenantId) {
  return {
    "content-type": "application/json",
    "x-pme-auth-token": token,
    "x-pme-tenant-id": selectedTenantId,
  };
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  auditLogPath,
  ui,
  health,
  adminReadiness,
  auditorReadiness,
  missingReadiness,
  expiredSession,
  revokedSession,
  crossTenantDashboard,
  viewerAuditDenied,
  adminDashboard,
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
      securityReadinessButtonPresent: Boolean(ui?.text?.includes("/enterprise/security/readiness")),
    },
    enterprise: {
      healthHttpStatus: health?.httpStatus ?? null,
      authEnabled: health?.body?.data?.authEnabled ?? null,
      tokenExpirySupported: health?.body?.data?.security?.tokenExpirySupported ?? null,
      tokenRevocationSupported: health?.body?.data?.security?.tokenRevocationSupported ?? null,
      adminReadinessStatus: adminReadiness?.body?.data?.status ?? null,
      adminReadinessHttpStatus: adminReadiness?.httpStatus ?? null,
      auditorReadinessHttpStatus: auditorReadiness?.httpStatus ?? null,
      missingReadinessStatus: missingReadiness?.httpStatus ?? null,
      activeUserCount: adminReadiness?.body?.data?.userStore?.activeUserCount ?? null,
      expiredUserCount: adminReadiness?.body?.data?.userStore?.expiredUserCount ?? null,
      revokedUserCount: adminReadiness?.body?.data?.userStore?.revokedUserCount ?? null,
      tokenValuesExposed: adminReadiness?.body?.data?.tokenPolicy?.tokenValuesExposed ?? null,
      expiredSessionStatus: expiredSession?.httpStatus ?? null,
      expiredSessionCode: expiredSession?.body?.error?.code ?? null,
      revokedSessionStatus: revokedSession?.httpStatus ?? null,
      revokedSessionCode: revokedSession?.body?.error?.code ?? null,
      crossTenantStatus: crossTenantDashboard?.httpStatus ?? null,
      crossTenantCode: crossTenantDashboard?.body?.error?.code ?? null,
      viewerAuditStatus: viewerAuditDenied?.httpStatus ?? null,
      adminDashboardStatus: adminDashboard?.httpStatus ?? null,
      adminAuditStatus: adminAudit?.httpStatus ?? null,
      auditLogPath: auditLogPath ?? null,
      auditEntryCount: auditEntries.length,
      expiredAuditRecorded: auditEntries.some((entry) => entry.code === "enterprise_token_expired"),
      revokedAuditRecorded: auditEntries.some((entry) => entry.code === "enterprise_token_revoked"),
      crossTenantAuditRecorded: auditEntries.some((entry) => entry.code === "enterprise_tenant_forbidden"),
    },
    error: error ?? null,
    conclusion,
  };
}

