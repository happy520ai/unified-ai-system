import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, listen, close } from "./entrypointUtils.js";

const PHASE = "phase-35a-enterprise-user-lifecycle";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-35a-enterprise-user-lifecycle.json");
const evidenceMdPath = resolve(evidenceDir, "phase-35a-enterprise-user-lifecycle.md");

const tenantId = "phase35-tenant";
const adminToken = "phase35-admin-token";
const managedToken = "phase35-managed-token";
const managedUserId = "phase35-managed-operator";

let evidence;

try {
  const storeDir = await mkdtemp(resolve(tmpdir(), "phase35a-enterprise-store-"));
  const auditDir = await mkdtemp(resolve(tmpdir(), "phase35a-enterprise-audit-"));
  const userStorePath = resolve(storeDir, "enterprise-users.json");
  const auditLogPath = resolve(auditDir, "enterprise-audit.jsonl");

  const first = await withService({ userStorePath, auditLogPath }, async (serviceUrl) => {
    const health = await fetchJson(`${serviceUrl}/enterprise/health`);
    const ui = await fetchText(`${serviceUrl}/ui`);
    const initialUsers = await fetchJson(`${serviceUrl}/enterprise/users`, {
      headers: createHeaders(adminToken),
    });
    const created = await fetchJson(`${serviceUrl}/enterprise/users`, {
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
    const listedAfterCreate = await fetchJson(`${serviceUrl}/enterprise/users`, {
      headers: createHeaders(adminToken),
    });
    const managedSession = await fetchJson(`${serviceUrl}/enterprise/session`, {
      headers: createHeaders(managedToken),
    });
    const operatorWrite = await fetchJson(`${serviceUrl}/knowledge/load`, {
      method: "POST",
      headers: createHeaders(managedToken),
      body: {
        sourceId: "phase35-managed-source",
        documents: [
          {
            documentId: "phase35-managed-document",
            title: "Managed User Lifecycle Document",
            content: "phase35 enterprise managed user lifecycle persisted token marker",
          },
        ],
      },
    });
    const revoked = await fetchJson(`${serviceUrl}/enterprise/users/revoke`, {
      method: "POST",
      headers: createHeaders(adminToken),
      body: {
        userId: managedUserId,
      },
    });
    const revokedSession = await fetchJson(`${serviceUrl}/enterprise/session`, {
      headers: createHeaders(managedToken),
    });
    const audit = await fetchJson(`${serviceUrl}/enterprise/audit?limit=80`, {
      headers: createHeaders(adminToken),
    });

    return {
      health,
      ui,
      initialUsers,
      created,
      listedAfterCreate,
      managedSession,
      operatorWrite,
      revoked,
      revokedSession,
      audit,
    };
  });

  const storeText = await readFile(userStorePath, "utf8");

  const second = await withService({ userStorePath, auditLogPath }, async (serviceUrl) => {
    const listedAfterRestart = await fetchJson(`${serviceUrl}/enterprise/users`, {
      headers: createHeaders(adminToken),
    });
    const revokedAfterRestartSession = await fetchJson(`${serviceUrl}/enterprise/session`, {
      headers: createHeaders(managedToken),
    });
    return {
      listedAfterRestart,
      revokedAfterRestartSession,
    };
  });

  const passed = isEnterpriseLifecycleConnected({ first, second, storeText });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    userStorePath,
    auditLogPath,
    first,
    second,
    storeText,
    conclusion: passed ? "enterprise-user-lifecycle-connected" : "enterprise-user-lifecycle-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-user-lifecycle-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

async function withService({ userStorePath, auditLogPath }, fn) {
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: adminToken,
    PME_AUTH_USER_ID: "phase35-admin",
    PME_AUTH_TENANT_ID: tenantId,
    PME_AUTH_ROLE: "admin",
    PME_AUTH_EXPIRES_AT: "2099-01-01T00:00:00.000Z",
    PME_ENTERPRISE_USER_STORE_PATH: userStorePath,
    PME_AUDIT_LOG_PATH: auditLogPath,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_STORAGE_MODE: "memory",
  });
  const server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    return await fn(serviceUrl);
  } finally {
    await close(server);
  }
}

function isEnterpriseLifecycleConnected({ first, second, storeText }) {
  const listedUsers = first.listedAfterCreate?.body?.data?.users ?? [];
  const restartedUsers = second.listedAfterRestart?.body?.data?.users ?? [];
  const auditEntries = first.audit?.body?.data?.entries ?? [];
  const createdBodyText = JSON.stringify(first.created?.body ?? {});
  const listedBodyText = JSON.stringify(first.listedAfterCreate?.body ?? {});

  return (
    first.health?.httpStatus === 200 &&
    first.health?.body?.data?.userStore?.mode === "env-plus-json-file" &&
    first.ui?.httpStatus === 200 &&
    first.ui?.text?.includes("/enterprise/users") &&
    first.initialUsers?.httpStatus === 200 &&
    first.created?.httpStatus === 200 &&
    first.created?.body?.data?.user?.userId === managedUserId &&
    first.created?.body?.data?.user?.tokenValueExposed === false &&
    !createdBodyText.includes(managedToken) &&
    first.listedAfterCreate?.httpStatus === 200 &&
    listedUsers.some((user) => user.userId === managedUserId && user.source === "file" && user.revoked === false) &&
    !listedBodyText.includes(managedToken) &&
    first.managedSession?.httpStatus === 200 &&
    first.managedSession?.body?.data?.identity?.userId === managedUserId &&
    first.operatorWrite?.httpStatus === 200 &&
    first.operatorWrite?.body?.data?.loadedCount === 1 &&
    first.revoked?.httpStatus === 200 &&
    first.revoked?.body?.data?.user?.revoked === true &&
    first.revokedSession?.httpStatus === 401 &&
    first.revokedSession?.body?.error?.code === "enterprise_token_revoked" &&
    storeText.includes('"tokenHash"') &&
    !storeText.includes(managedToken) &&
    second.listedAfterRestart?.httpStatus === 200 &&
    restartedUsers.some((user) => user.userId === managedUserId && user.revoked === true) &&
    second.revokedAfterRestartSession?.httpStatus === 401 &&
    second.revokedAfterRestartSession?.body?.error?.code === "enterprise_token_revoked" &&
    auditEntries.some((entry) => entry.code === "enterprise_user_upserted") &&
    auditEntries.some((entry) => entry.code === "enterprise_user_revoked")
  );
}

function createHeaders(token) {
  return {
    "content-type": "application/json",
    "x-pme-auth-token": token,
    "x-pme-tenant-id": tenantId,
  };
}

function createEvidence({ status, generatedAt, userStorePath, auditLogPath, first, second, storeText, conclusion, error }) {
  const listedUsers = first?.listedAfterCreate?.body?.data?.users ?? [];
  const restartedUsers = second?.listedAfterRestart?.body?.data?.users ?? [];
  const auditEntries = first?.audit?.body?.data?.entries ?? [];
  const managed = listedUsers.find((user) => user.userId === managedUserId) ?? {};
  return {
    phase: PHASE,
    status,
    generatedAt,
    userStorePath: userStorePath ?? null,
    auditLogPath: auditLogPath ?? null,
    enterprise: {
      healthHttpStatus: first?.health?.httpStatus ?? null,
      userStoreMode: first?.health?.body?.data?.userStore?.mode ?? null,
      uiHttpStatus: first?.ui?.httpStatus ?? null,
      uiManagedUsersPresent: Boolean(first?.ui?.text?.includes("/enterprise/users")),
      initialUsersStatus: first?.initialUsers?.httpStatus ?? null,
      createStatus: first?.created?.httpStatus ?? null,
      listStatus: first?.listedAfterCreate?.httpStatus ?? null,
      managedUserId: managed.userId ?? null,
      managedRole: managed.role ?? null,
      managedSource: managed.source ?? null,
      tokenValueExposed: managed.tokenValueExposed ?? null,
      tokenHashExposed: managed.tokenHashExposed ?? null,
      managedSessionStatus: first?.managedSession?.httpStatus ?? null,
      operatorWriteStatus: first?.operatorWrite?.httpStatus ?? null,
      revokeStatus: first?.revoked?.httpStatus ?? null,
      revokedSessionStatus: first?.revokedSession?.httpStatus ?? null,
      revokedSessionCode: first?.revokedSession?.body?.error?.code ?? null,
      persistedStoreHasTokenHash: Boolean(storeText?.includes('"tokenHash"')),
      persistedStoreContainsRawToken: Boolean(storeText?.includes(managedToken)),
      listAfterRestartStatus: second?.listedAfterRestart?.httpStatus ?? null,
      revokedAfterRestartStatus: second?.revokedAfterRestartSession?.httpStatus ?? null,
      revokedAfterRestartCode: second?.revokedAfterRestartSession?.body?.error?.code ?? null,
      restartedManagedUserRevoked: restartedUsers.some((user) => user.userId === managedUserId && user.revoked === true),
      auditEntryCount: auditEntries.length,
      upsertAuditRecorded: auditEntries.some((entry) => entry.code === "enterprise_user_upserted"),
      revokeAuditRecorded: auditEntries.some((entry) => entry.code === "enterprise_user_revoked"),
    },
    error: error ?? null,
    conclusion,
  };
}

