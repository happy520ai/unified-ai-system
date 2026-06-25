import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, listen, close } from "./entrypointUtils.js";

const PHASE = "phase-48a-enterprise-overview-readability";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-48a-enterprise-overview-readability.json");
const evidenceMdPath = resolve(evidenceDir, "phase-48a-enterprise-overview-readability.md");

const tenantId = "phase48-tenant";
const auditorToken = "phase48-auditor-token";
const nvidiaKey = "phase48-redacted-nvidia-key";

let server;
let evidence;

try {
  const rootDir = await mkdtemp(resolve(tmpdir(), "phase48a-enterprise-overview-readability-"));
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: auditorToken,
    PME_AUTH_USER_ID: "phase48-auditor",
    PME_AUTH_TENANT_ID: tenantId,
    PME_AUTH_ROLE: "auditor",
    PME_AUTH_EXPIRES_AT: "2099-01-01T00:00:00.000Z",
    PME_ENTERPRISE_USER_STORE_PATH: resolve(rootDir, "users/enterprise-users.json"),
    PME_AUDIT_LOG_PATH: resolve(rootDir, "audit/enterprise-audit.jsonl"),
    PME_ENTERPRISE_BACKUP_DIR: resolve(rootDir, "backups"),
    AI_GATEWAY_PROVIDER_MODE: "real",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
    AI_GATEWAY_ROUTE_MODE: "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: "nvidia",
    AI_GATEWAY_ENABLED_PROVIDERS: "nvidia",
    NVIDIA_API_KEY: nvidiaKey,
    NVIDIA_MODEL: "meta/llama-3.1-8b-instruct",
    KNOWLEDGE_STORAGE_MODE: "file",
    KNOWLEDGE_PERSISTENCE_DIR: resolve(rootDir, "knowledge"),
    KNOWLEDGE_INFRA_MODE: "local-keyword",
  });

  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;

  const ui = await fetchText(`${serviceUrl}/ui`);
  const overview = await fetchJson(`${serviceUrl}/enterprise/overview`, {
    headers: createHeaders(auditorToken),
  });

  const responseText = JSON.stringify({ ui, overview });
  const passed = isReadableOverviewReady({ ui, overview, responseText });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    ui,
    overview,
    responseText,
    conclusion: passed ? "enterprise-overview-readable-summary-connected" : "enterprise-overview-readable-summary-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-overview-readable-summary-not-connected",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isReadableOverviewReady({ ui, overview, responseText }) {
  const data = overview?.body?.data;
  return (
    ui?.httpStatus === 200 &&
    ui.text.includes("phase47a-enterprise-overview-ui") &&
    ui.text.includes("phase48a-enterprise-overview-readable-summary") &&
    ui.text.includes("enterprise-overview-summary") &&
    ui.text.includes("enterprise-overview-run") &&
    ui.text.includes("renderEnterpriseOverview") &&
    ui.text.includes("overviewLine") &&
    ui.text.includes("原始 JSON 保留在下方") &&
    ui.text.includes("/enterprise/overview") &&
    overview?.httpStatus === 200 &&
    data?.phase === "phase-47a-enterprise-overview-ui" &&
    data?.status === "ready" &&
    data?.readiness?.deployment?.status === "ready" &&
    data?.readiness?.startup?.status === "ready" &&
    data?.readiness?.security?.status === "ready" &&
    data?.acceptance?.status === "passed" &&
    data?.releaseCandidate?.status === "passed" &&
    data?.safety?.readOnlyRoute === true &&
    data?.safety?.providerCalls === false &&
    data?.safety?.runtimeMutation === false &&
    data?.safety?.releaseAutomation === false &&
    data?.safety?.infrastructureProvisioning === false &&
    !responseText.includes(auditorToken) &&
    !responseText.includes(nvidiaKey)
  );
}

function createHeaders(token) {
  return {
    "content-type": "application/json",
    "x-pme-auth-token": token,
    "x-pme-tenant-id": tenantId,
  };
}

function createEvidence({ status, generatedAt, serviceUrl, ui, overview, responseText, conclusion, error }) {
  const data = overview?.body?.data;
  return {
    phase: PHASE,
    status,
    generatedAt,
    serviceUrl: serviceUrl ?? null,
    ui: {
      httpStatus: ui?.httpStatus ?? null,
      readableSummaryMarkerPresent: Boolean(ui?.text?.includes("phase48a-enterprise-overview-readable-summary")),
      summaryContainerPresent: Boolean(ui?.text?.includes("enterprise-overview-summary")),
      summaryButtonPresent: Boolean(ui?.text?.includes("enterprise-overview-run")),
      summaryRendererPresent: Boolean(ui?.text?.includes("renderEnterpriseOverview")),
      rawJsonPreserved: Boolean(ui?.text?.includes("enterprise-overview-output")),
    },
    route: {
      path: "/enterprise/overview",
      authorizedHttpStatus: overview?.httpStatus ?? null,
      status: data?.status ?? null,
      mode: data?.mode ?? null,
    },
    summary: {
      deploymentStatus: data?.readiness?.deployment?.status ?? null,
      startupStatus: data?.readiness?.startup?.status ?? null,
      securityStatus: data?.readiness?.security?.status ?? null,
      acceptanceStatus: data?.acceptance?.status ?? null,
      releaseCandidateStatus: data?.releaseCandidate?.status ?? null,
      readOnlyRoute: data?.safety?.readOnlyRoute ?? null,
      providerCalls: data?.safety?.providerCalls ?? null,
      runtimeMutation: data?.safety?.runtimeMutation ?? null,
      releaseAutomation: data?.safety?.releaseAutomation ?? null,
      infrastructureProvisioning: data?.safety?.infrastructureProvisioning ?? null,
    },
    safety: {
      responseContainsAuditorToken: Boolean(responseText?.includes(auditorToken)),
      responseContainsNvidiaKey: Boolean(responseText?.includes(nvidiaKey)),
    },
    error: error ?? null,
    conclusion,
  };
}

