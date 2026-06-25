import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, listen, close } from "./entrypointUtils.js";

const PHASE = "phase-38a-enterprise-startup-readiness";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-38a-enterprise-startup-readiness.json");
const evidenceMdPath = resolve(evidenceDir, "phase-38a-enterprise-startup-readiness.md");

const tenantId = "phase38-tenant";
const adminToken = "phase38-admin-token";
const nvidiaKey = "phase38-redacted-nvidia-key";

let server;
let evidence;

try {
  const rootDir = await mkdtemp(resolve(tmpdir(), "phase38a-enterprise-startup-"));
  const userStorePath = resolve(rootDir, "users/enterprise-users.json");
  const auditLogPath = resolve(rootDir, "audit/enterprise-audit.jsonl");
  const backupDir = resolve(rootDir, "backups");
  const knowledgeDir = resolve(rootDir, "knowledge");
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: adminToken,
    PME_AUTH_USER_ID: "phase38-admin",
    PME_AUTH_TENANT_ID: tenantId,
    PME_AUTH_ROLE: "admin",
    PME_AUTH_EXPIRES_AT: "2099-01-01T00:00:00.000Z",
    PME_ENTERPRISE_USER_STORE_PATH: userStorePath,
    PME_AUDIT_LOG_PATH: auditLogPath,
    PME_ENTERPRISE_BACKUP_DIR: backupDir,
    AI_GATEWAY_PROVIDER_MODE: "real",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
    AI_GATEWAY_ROUTE_MODE: "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: "nvidia",
    AI_GATEWAY_ENABLED_PROVIDERS: "nvidia",
    NVIDIA_API_KEY: nvidiaKey,
    NVIDIA_MODEL: "meta/llama-3.1-8b-instruct",
    KNOWLEDGE_STORAGE_MODE: "file",
    KNOWLEDGE_PERSISTENCE_DIR: knowledgeDir,
    KNOWLEDGE_INFRA_MODE: "local-keyword",
  });

  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;

  const ui = await fetchText(`${serviceUrl}/ui`);
  const missing = await fetchJson(`${serviceUrl}/enterprise/startup/readiness`);
  const startup = await fetchJson(`${serviceUrl}/enterprise/startup/readiness`, {
    headers: createHeaders(adminToken),
  });
  const deployment = await fetchJson(`${serviceUrl}/enterprise/deployment/readiness`, {
    headers: createHeaders(adminToken),
  });
  const security = await fetchJson(`${serviceUrl}/enterprise/security/readiness`, {
    headers: createHeaders(adminToken),
  });

  const responseText = JSON.stringify({
    ui,
    missing,
    startup,
    deployment,
    security,
  });
  const passed = isStartupReady({
    ui,
    missing,
    startup,
    deployment,
    security,
    responseText,
  });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    userStorePath,
    auditLogPath,
    backupDir,
    startup,
    deployment,
    security,
    missing,
    ui,
    responseText,
    conclusion: passed ? "enterprise-startup-readiness-connected" : "enterprise-startup-readiness-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-startup-readiness-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isStartupReady({ ui, missing, startup, deployment, security, responseText }) {
  const data = startup?.body?.data ?? {};
  const checks = data.checks ?? [];
  return (
    ui?.httpStatus === 200 &&
    ui.text.includes("/enterprise/startup/readiness") &&
    missing?.httpStatus === 401 &&
    startup?.httpStatus === 200 &&
    data.status === "ready" &&
    data.mode === "enterprise-production-startup-readiness" &&
    data.service?.providerMode === "real" &&
    data.service?.realProviderEnabled === true &&
    data.service?.defaultProviderId === "nvidia" &&
    data.secrets?.NVIDIA_API_KEY?.present === true &&
    data.secrets?.NVIDIA_API_KEY?.valueExposed === false &&
    checks.some((check) => check.id === "provider_mode_real" && check.status === "ready") &&
    checks.some((check) => check.id === "nvidia_single_provider_startup" && check.status === "ready") &&
    checks.some((check) => check.id === "nvidia_api_key_present" && check.status === "ready") &&
    checks.some((check) => check.id === "knowledge_durable_startup" && check.status === "ready") &&
    deployment?.httpStatus === 200 &&
    deployment.body?.data?.status === "ready" &&
    security?.httpStatus === 200 &&
    security.body?.data?.status === "ready" &&
    !responseText.includes(nvidiaKey) &&
    !responseText.includes(adminToken)
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
  userStorePath,
  auditLogPath,
  backupDir,
  startup,
  deployment,
  security,
  missing,
  ui,
  responseText,
  conclusion,
  error,
}) {
  const data = startup?.body?.data ?? {};
  return {
    phase: PHASE,
    status,
    generatedAt,
    serviceUrl: serviceUrl ?? null,
    paths: {
      userStorePath: userStorePath ?? null,
      auditLogPath: auditLogPath ?? null,
      backupDir: backupDir ?? null,
    },
    enterprise: {
      uiHttpStatus: ui?.httpStatus ?? null,
      uiStartupReadinessPresent: Boolean(ui?.text?.includes("/enterprise/startup/readiness")),
      missingStartupReadinessStatus: missing?.httpStatus ?? null,
      startupHttpStatus: startup?.httpStatus ?? null,
      startupStatus: data.status ?? null,
      startupMode: data.mode ?? null,
      blockers: data.blockers ?? [],
      warnings: data.warnings ?? [],
      providerMode: data.service?.providerMode ?? null,
      realProviderEnabled: data.service?.realProviderEnabled ?? null,
      defaultProviderId: data.service?.defaultProviderId ?? null,
      nvidiaApiKeyPresent: data.secrets?.NVIDIA_API_KEY?.present ?? null,
      nvidiaApiKeyValueExposed: data.secrets?.NVIDIA_API_KEY?.valueExposed ?? null,
      deploymentReadinessStatus: deployment?.body?.data?.status ?? null,
      securityReadinessStatus: security?.body?.data?.status ?? null,
      responseContainsNvidiaKey: Boolean(responseText?.includes(nvidiaKey)),
      responseContainsAdminToken: Boolean(responseText?.includes(adminToken)),
    },
    error: error ?? null,
    conclusion,
  };
}

