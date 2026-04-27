import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-40a-enterprise-deployment-preflight";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-40a-enterprise-deployment-preflight.json");
const evidenceMdPath = resolve(evidenceDir, "phase-40a-enterprise-deployment-preflight.md");

const tenantId = "phase40-tenant";
const adminToken = "phase40-admin-token";
const nvidiaKey = "phase40-redacted-nvidia-key";

let server;
let evidence;

try {
  const rootDir = await mkdtemp(resolve(tmpdir(), "phase40a-enterprise-preflight-"));
  const userStorePath = resolve(rootDir, "users/enterprise-users.json");
  const auditLogPath = resolve(rootDir, "audit/enterprise-audit.jsonl");
  const backupDir = resolve(rootDir, "backups");
  const knowledgeDir = resolve(rootDir, "knowledge");
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: adminToken,
    PME_AUTH_USER_ID: "phase40-admin",
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
  const serviceHealth = await fetchJson(`${serviceUrl}/health/check`);
  const missingStartup = await fetchJson(`${serviceUrl}/enterprise/startup/readiness`);
  const deployment = await fetchJson(`${serviceUrl}/enterprise/deployment/readiness`, {
    headers: createHeaders(adminToken),
  });
  const startup = await fetchJson(`${serviceUrl}/enterprise/startup/readiness`, {
    headers: createHeaders(adminToken),
  });
  const security = await fetchJson(`${serviceUrl}/enterprise/security/readiness`, {
    headers: createHeaders(adminToken),
  });
  const vector = await fetchJson(`${serviceUrl}/knowledge/infra/readiness`, {
    headers: createHeaders(adminToken),
  });

  const responseText = JSON.stringify({
    serviceHealth,
    missingStartup,
    deployment,
    startup,
    security,
    vector,
  });
  const passed = isPreflightReady({
    ui,
    serviceHealth,
    missingStartup,
    deployment,
    startup,
    security,
    vector,
    responseText,
  });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    userStorePath,
    auditLogPath,
    backupDir,
    ui,
    serviceHealth,
    missingStartup,
    deployment,
    startup,
    security,
    vector,
    responseText,
    conclusion: passed ? "enterprise-deployment-preflight-connected" : "enterprise-deployment-preflight-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-deployment-preflight-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isPreflightReady({ ui, serviceHealth, missingStartup, deployment, startup, security, vector, responseText }) {
  return (
    ui?.httpStatus === 200 &&
    ui.text.includes("phase40a-enterprise-deployment-preflight") &&
    ui.text.includes("enterprise-preflight-run") &&
    ui.text.includes("/enterprise/deployment/readiness") &&
    ui.text.includes("/enterprise/startup/readiness") &&
    ui.text.includes("/enterprise/security/readiness") &&
    ui.text.includes("/knowledge/infra/readiness") &&
    serviceHealth?.httpStatus === 200 &&
    serviceHealth.body?.data?.status === "ready" &&
    missingStartup?.httpStatus === 401 &&
    deployment?.httpStatus === 200 &&
    deployment.body?.data?.status === "ready" &&
    startup?.httpStatus === 200 &&
    startup.body?.data?.status === "ready" &&
    security?.httpStatus === 200 &&
    security.body?.data?.status === "ready" &&
    vector?.httpStatus === 200 &&
    vector.body?.data?.mode === "local-keyword" &&
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
  ui,
  serviceHealth,
  missingStartup,
  deployment,
  startup,
  security,
  vector,
  responseText,
  conclusion,
  error,
}) {
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
    ui: {
      httpStatus: ui?.httpStatus ?? null,
      preflightPanelPresent: Boolean(ui?.text?.includes("phase40a-enterprise-deployment-preflight")),
      preflightButtonPresent: Boolean(ui?.text?.includes("enterprise-preflight-run")),
      deploymentReadinessPathPresent: Boolean(ui?.text?.includes("/enterprise/deployment/readiness")),
      startupReadinessPathPresent: Boolean(ui?.text?.includes("/enterprise/startup/readiness")),
      securityReadinessPathPresent: Boolean(ui?.text?.includes("/enterprise/security/readiness")),
      vectorReadinessPathPresent: Boolean(ui?.text?.includes("/knowledge/infra/readiness")),
    },
    enterprise: {
      serviceHealthStatus: serviceHealth?.body?.data?.status ?? null,
      missingStartupReadinessStatus: missingStartup?.httpStatus ?? null,
      deploymentReadinessStatus: deployment?.body?.data?.status ?? null,
      startupReadinessStatus: startup?.body?.data?.status ?? null,
      securityReadinessStatus: security?.body?.data?.status ?? null,
      vectorReadinessMode: vector?.body?.data?.mode ?? null,
      vectorReadinessStatus: vector?.body?.data?.status ?? null,
      responseContainsNvidiaKey: Boolean(responseText?.includes(nvidiaKey)),
      responseContainsAdminToken: Boolean(responseText?.includes(adminToken)),
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
  return `# Phase 40A Enterprise Deployment Preflight Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- User store path: ${body.paths?.userStorePath ?? "n/a"}
- Audit log path: ${body.paths?.auditLogPath ?? "n/a"}
- Backup dir: ${body.paths?.backupDir ?? "n/a"}
- UI preflight panel present: ${body.ui?.preflightPanelPresent}
- UI preflight button present: ${body.ui?.preflightButtonPresent}
- Deployment readiness path present: ${body.ui?.deploymentReadinessPathPresent}
- Startup readiness path present: ${body.ui?.startupReadinessPathPresent}
- Security readiness path present: ${body.ui?.securityReadinessPathPresent}
- Vector readiness path present: ${body.ui?.vectorReadinessPathPresent}
- Service health status: ${body.enterprise?.serviceHealthStatus ?? "n/a"}
- Missing startup readiness status: ${body.enterprise?.missingStartupReadinessStatus ?? "n/a"}
- Deployment readiness status: ${body.enterprise?.deploymentReadinessStatus ?? "n/a"}
- Startup readiness status: ${body.enterprise?.startupReadinessStatus ?? "n/a"}
- Security readiness status: ${body.enterprise?.securityReadinessStatus ?? "n/a"}
- Vector readiness mode: ${body.enterprise?.vectorReadinessMode ?? "n/a"}
- Vector readiness status: ${body.enterprise?.vectorReadinessStatus ?? "n/a"}
- Response contains NVIDIA key: ${body.enterprise?.responseContainsNvidiaKey}
- Response contains admin token: ${body.enterprise?.responseContainsAdminToken}
- Conclusion: ${body.conclusion}
`;
}
