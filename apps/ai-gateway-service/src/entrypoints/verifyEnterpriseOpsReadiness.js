import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-37a-enterprise-ops-readiness";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-37a-enterprise-ops-readiness.json");
const evidenceMdPath = resolve(evidenceDir, "phase-37a-enterprise-ops-readiness.md");

const tenantId = "phase37-tenant";
const adminToken = "phase37-admin-token";
const viewerToken = "phase37-viewer-token";
const managedToken = "phase37-managed-token";
const managedUserId = "phase37-managed-operator";

let server;
let evidence;

try {
  const rootDir = await mkdtemp(resolve(tmpdir(), "phase37a-enterprise-ops-"));
  const userStorePath = resolve(rootDir, "users/enterprise-users.json");
  const auditLogPath = resolve(rootDir, "audit/enterprise-audit.jsonl");
  const backupDir = resolve(rootDir, "backups");
  const knowledgeDir = resolve(rootDir, "knowledge");
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: adminToken,
    PME_AUTH_USER_ID: "phase37-admin",
    PME_AUTH_TENANT_ID: tenantId,
    PME_AUTH_ROLE: "admin",
    PME_AUTH_EXPIRES_AT: "2099-01-01T00:00:00.000Z",
    PME_ENTERPRISE_USERS_JSON: JSON.stringify([
      {
        token: viewerToken,
        userId: "phase37-viewer",
        tenantId,
        role: "viewer",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
    ]),
    PME_ENTERPRISE_USER_STORE_PATH: userStorePath,
    PME_AUDIT_LOG_PATH: auditLogPath,
    PME_ENTERPRISE_BACKUP_DIR: backupDir,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_STORAGE_MODE: "file",
    KNOWLEDGE_PERSISTENCE_DIR: knowledgeDir,
  });

  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;

  const ui = await fetchText(`${serviceUrl}/ui`);
  const readiness = await fetchJson(`${serviceUrl}/enterprise/deployment/readiness`, {
    headers: createHeaders(adminToken),
  });
  const managedUser = await fetchJson(`${serviceUrl}/enterprise/users`, {
    method: "POST",
    headers: createHeaders(adminToken),
    body: {
      userId: managedUserId,
      token: managedToken,
      tenantId,
      role: "operator",
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
  });
  const knowledgeLoad = await fetchJson(`${serviceUrl}/knowledge/load`, {
    method: "POST",
    headers: createHeaders(adminToken),
    body: {
      sourceId: "phase37-ops-readiness-source",
      sourceTitle: "Phase 37 Ops Readiness Source",
      documents: [
        {
          documentId: "phase37-ops-readiness-document",
          title: "Phase 37 Enterprise Ops Readiness Document",
          content: "phase37 enterprise deployment readiness backup restore validate marker",
          metadata: {
            phase: PHASE,
          },
        },
      ],
    },
  });
  const viewerBackupDenied = await fetchJson(`${serviceUrl}/enterprise/backup`, {
    method: "POST",
    headers: createHeaders(viewerToken),
    body: {
      reason: "viewer-denied-backup",
    },
  });
  const backup = await fetchJson(`${serviceUrl}/enterprise/backup`, {
    method: "POST",
    headers: createHeaders(adminToken),
    body: {
      reason: "phase37-verification-backup",
    },
  });
  const backupPath = backup.body?.data?.backupPath;
  const backupText = backupPath ? await readFile(backupPath, "utf8") : "";
  const restoreValidation = await fetchJson(`${serviceUrl}/enterprise/restore/validate`, {
    method: "POST",
    headers: createHeaders(adminToken),
    body: {
      backupPath,
    },
  });
  const outsideRestoreValidation = await fetchJson(`${serviceUrl}/enterprise/restore/validate`, {
    method: "POST",
    headers: createHeaders(adminToken),
    body: {
      backupPath: resolve(rootDir, "../outside-backup.json"),
    },
  });
  const audit = await fetchJson(`${serviceUrl}/enterprise/audit?limit=80`, {
    headers: createHeaders(adminToken),
  });

  const passed = isEnterpriseOpsReady({
    ui,
    readiness,
    managedUser,
    knowledgeLoad,
    viewerBackupDenied,
    backup,
    backupText,
    restoreValidation,
    outsideRestoreValidation,
    audit,
  });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    userStorePath,
    auditLogPath,
    backupDir,
    backupPath,
    readiness,
    managedUser,
    knowledgeLoad,
    viewerBackupDenied,
    backup,
    backupText,
    restoreValidation,
    outsideRestoreValidation,
    audit,
    ui,
    conclusion: passed ? "enterprise-ops-readiness-connected" : "enterprise-ops-readiness-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-ops-readiness-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isEnterpriseOpsReady({
  ui,
  readiness,
  managedUser,
  knowledgeLoad,
  viewerBackupDenied,
  backup,
  backupText,
  restoreValidation,
  outsideRestoreValidation,
  audit,
}) {
  const auditEntries = audit?.body?.data?.entries ?? [];
  const backupData = backup?.body?.data ?? {};
  const restoreData = restoreValidation?.body?.data ?? {};
  return (
    ui?.httpStatus === 200 &&
    ui.text.includes("/enterprise/deployment/readiness") &&
    ui.text.includes("/enterprise/backup") &&
    readiness?.httpStatus === 200 &&
    readiness.body?.data?.status === "ready" &&
    readiness.body?.data?.checks?.some((check) => check.id === "enterprise_backup_dir" && check.status === "ready") &&
    managedUser?.httpStatus === 200 &&
    knowledgeLoad?.httpStatus === 200 &&
    viewerBackupDenied?.httpStatus === 403 &&
    backup?.httpStatus === 200 &&
    backupData.backupPath &&
    backupData.tokenValuesExposed === false &&
    backupData.managedStoredUserCount >= 1 &&
    backupData.auditEntryCount >= 1 &&
    backupText.includes('"tokenHash"') &&
    !backupText.includes(adminToken) &&
    !backupText.includes(viewerToken) &&
    !backupText.includes(managedToken) &&
    restoreValidation?.httpStatus === 200 &&
    restoreData.valid === true &&
    restoreData.mode === "restore-validate-only" &&
    restoreData.mutation === "none" &&
    outsideRestoreValidation?.httpStatus === 400 &&
    outsideRestoreValidation.body?.error?.code === "enterprise_backup_path_outside_backup_dir" &&
    audit?.httpStatus === 200 &&
    auditEntries.some((entry) => entry.code === "enterprise_backup_created") &&
    auditEntries.some((entry) => entry.code === "enterprise_restore_validate_ready")
  );
}

function createHeaders(token) {
  return {
    "content-type": "application/json",
    "x-pme-auth-token": token,
    "x-pme-tenant-id": tenantId,
  };
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
  return {
    httpStatus: response.status,
    contentType: response.headers.get("content-type"),
    text: await response.text(),
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return {
    httpStatus: response.status,
    body: text ? JSON.parse(text) : {},
  };
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  userStorePath,
  auditLogPath,
  backupDir,
  backupPath,
  readiness,
  managedUser,
  knowledgeLoad,
  viewerBackupDenied,
  backup,
  backupText,
  restoreValidation,
  outsideRestoreValidation,
  audit,
  ui,
  conclusion,
  error,
}) {
  const backupData = backup?.body?.data ?? {};
  const restoreData = restoreValidation?.body?.data ?? {};
  const auditEntries = audit?.body?.data?.entries ?? [];
  return {
    phase: PHASE,
    status,
    generatedAt,
    serviceUrl: serviceUrl ?? null,
    paths: {
      userStorePath: userStorePath ?? null,
      auditLogPath: auditLogPath ?? null,
      backupDir: backupDir ?? null,
      backupPath: backupPath ?? null,
    },
    enterprise: {
      uiHttpStatus: ui?.httpStatus ?? null,
      uiOpsButtonsPresent: Boolean(ui?.text?.includes("/enterprise/deployment/readiness") && ui?.text?.includes("/enterprise/backup")),
      readinessHttpStatus: readiness?.httpStatus ?? null,
      readinessStatus: readiness?.body?.data?.status ?? null,
      readinessBlockers: readiness?.body?.data?.blockers ?? [],
      readinessWarnings: readiness?.body?.data?.warnings ?? [],
      managedUserStatus: managedUser?.httpStatus ?? null,
      knowledgeLoadStatus: knowledgeLoad?.httpStatus ?? null,
      viewerBackupDeniedStatus: viewerBackupDenied?.httpStatus ?? null,
      backupStatus: backup?.httpStatus ?? null,
      backupId: backupData.backupId ?? null,
      backupByteSize: backupData.byteSize ?? null,
      backupStoredUserCount: backupData.managedStoredUserCount ?? null,
      backupAuditEntryCount: backupData.auditEntryCount ?? null,
      backupKnowledgeDocumentCount: backupData.knowledgeDocumentCount ?? null,
      backupContainsTokenHash: Boolean(backupText?.includes('"tokenHash"')),
      backupContainsRawAdminToken: Boolean(backupText?.includes(adminToken)),
      backupContainsRawViewerToken: Boolean(backupText?.includes(viewerToken)),
      backupContainsRawManagedToken: Boolean(backupText?.includes(managedToken)),
      restoreValidateStatus: restoreValidation?.httpStatus ?? null,
      restoreValidateValid: restoreData.valid ?? null,
      restoreValidateMode: restoreData.mode ?? null,
      restoreValidateMutation: restoreData.mutation ?? null,
      outsideRestoreValidateStatus: outsideRestoreValidation?.httpStatus ?? null,
      outsideRestoreValidateCode: outsideRestoreValidation?.body?.error?.code ?? null,
      auditStatus: audit?.httpStatus ?? null,
      auditEntryCount: auditEntries.length,
      backupAuditRecorded: auditEntries.some((entry) => entry.code === "enterprise_backup_created"),
      restoreValidateAuditRecorded: auditEntries.some((entry) => entry.code === "enterprise_restore_validate_ready"),
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
  return `# Phase 37A Enterprise Ops Readiness Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- User store path: ${body.paths?.userStorePath ?? "n/a"}
- Audit log path: ${body.paths?.auditLogPath ?? "n/a"}
- Backup dir: ${body.paths?.backupDir ?? "n/a"}
- Backup path: ${body.paths?.backupPath ?? "n/a"}
- UI ops buttons present: ${body.enterprise?.uiOpsButtonsPresent}
- Readiness HTTP status: ${body.enterprise?.readinessHttpStatus ?? "n/a"}
- Readiness status: ${body.enterprise?.readinessStatus ?? "n/a"}
- Readiness blockers: ${(body.enterprise?.readinessBlockers ?? []).join(", ") || "none"}
- Readiness warnings: ${(body.enterprise?.readinessWarnings ?? []).join(", ") || "none"}
- Managed user status: ${body.enterprise?.managedUserStatus ?? "n/a"}
- Knowledge load status: ${body.enterprise?.knowledgeLoadStatus ?? "n/a"}
- Viewer backup denied status: ${body.enterprise?.viewerBackupDeniedStatus ?? "n/a"}
- Backup status: ${body.enterprise?.backupStatus ?? "n/a"}
- Backup id: ${body.enterprise?.backupId ?? "n/a"}
- Backup byte size: ${body.enterprise?.backupByteSize ?? "n/a"}
- Backup stored user count: ${body.enterprise?.backupStoredUserCount ?? "n/a"}
- Backup audit entry count: ${body.enterprise?.backupAuditEntryCount ?? "n/a"}
- Backup knowledge document count: ${body.enterprise?.backupKnowledgeDocumentCount ?? "n/a"}
- Backup contains token hash: ${body.enterprise?.backupContainsTokenHash}
- Backup contains raw admin token: ${body.enterprise?.backupContainsRawAdminToken}
- Backup contains raw viewer token: ${body.enterprise?.backupContainsRawViewerToken}
- Backup contains raw managed token: ${body.enterprise?.backupContainsRawManagedToken}
- Restore validate status: ${body.enterprise?.restoreValidateStatus ?? "n/a"}
- Restore validate valid: ${body.enterprise?.restoreValidateValid}
- Restore validate mode: ${body.enterprise?.restoreValidateMode ?? "n/a"}
- Restore validate mutation: ${body.enterprise?.restoreValidateMutation ?? "n/a"}
- Outside restore validate status: ${body.enterprise?.outsideRestoreValidateStatus ?? "n/a"}
- Outside restore validate code: ${body.enterprise?.outsideRestoreValidateCode ?? "n/a"}
- Audit status: ${body.enterprise?.auditStatus ?? "n/a"}
- Audit entry count: ${body.enterprise?.auditEntryCount ?? "n/a"}
- Backup audit recorded: ${body.enterprise?.backupAuditRecorded}
- Restore validate audit recorded: ${body.enterprise?.restoreValidateAuditRecorded}
- Conclusion: ${body.conclusion}
`;
}
