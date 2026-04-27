import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-47a-enterprise-overview-ui";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-47a-enterprise-overview-ui.json");
const evidenceMdPath = resolve(evidenceDir, "phase-47a-enterprise-overview-ui.md");

const tenantId = "phase47-tenant";
const auditorToken = "phase47-auditor-token";
const nvidiaKey = "phase47-redacted-nvidia-key";

let server;
let evidence;

try {
  const rootDir = await mkdtemp(resolve(tmpdir(), "phase47a-enterprise-overview-ui-"));
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: auditorToken,
    PME_AUTH_USER_ID: "phase47-auditor",
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
  const missingAuth = await fetchJson(`${serviceUrl}/enterprise/overview`);
  const overview = await fetchJson(`${serviceUrl}/enterprise/overview`, {
    headers: createHeaders(auditorToken),
  });

  const responseText = JSON.stringify({ ui, missingAuth, overview });
  const passed = isOverviewReady({ ui, missingAuth, overview, responseText });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    ui,
    missingAuth,
    overview,
    responseText,
    conclusion: passed ? "enterprise-overview-ui-connected" : "enterprise-overview-ui-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-overview-ui-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isOverviewReady({ ui, missingAuth, overview, responseText }) {
  const data = overview?.body?.data;
  return (
    ui?.httpStatus === 200 &&
    ui.text.includes("phase47a-enterprise-overview-ui") &&
    ui.text.includes("/enterprise/overview") &&
    ui.text.includes("Enterprise overview") &&
    missingAuth?.httpStatus === 401 &&
    overview?.httpStatus === 200 &&
    data?.phase === PHASE &&
    data?.mode === "read-only-enterprise-overview" &&
    data?.status === "ready" &&
    Array.isArray(data?.blockers) &&
    data.blockers.length === 0 &&
    data?.governance?.authEnabled === true &&
    data?.governance?.roleCount >= 4 &&
    data?.governance?.auditEnabled === true &&
    data?.readiness?.deployment?.status === "ready" &&
    data?.readiness?.startup?.status === "ready" &&
    data?.readiness?.security?.status === "ready" &&
    data?.readiness?.vector?.mode === "local-keyword" &&
    data?.readiness?.vector?.status === "disabled" &&
    data?.acceptance?.status === "passed" &&
    data?.acceptance?.requiredCount >= 20 &&
    data?.acceptance?.passedCount === data?.acceptance?.requiredCount &&
    data?.acceptance?.missingCount === 0 &&
    data?.acceptance?.failedCount === 0 &&
    data?.releaseCandidate?.status === "passed" &&
    data?.releaseCandidate?.mode === "read-only-dry-run" &&
    data?.releaseCandidate?.packageCreated === false &&
    data?.releaseCandidate?.releaseCreated === false &&
    data?.releaseCandidate?.artifactPublished === false &&
    data?.releaseCandidate?.evidenceRequiredCount >= 20 &&
    data?.releaseCandidate?.evidencePassedCount === data?.releaseCandidate?.evidenceRequiredCount &&
    data?.releaseCandidate?.evidenceMissingCount === 0 &&
    data?.releaseCandidate?.evidenceFailedCount === 0 &&
    data?.safety?.readOnlyRoute === true &&
    data?.safety?.providerCalls === false &&
    data?.safety?.runtimeMutation === false &&
    data?.safety?.releaseAutomation === false &&
    data?.safety?.infrastructureProvisioning === false &&
    data?.safety?.secretValuesRecorded === false &&
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

function createEvidence({ status, generatedAt, serviceUrl, ui, missingAuth, overview, responseText, conclusion, error }) {
  const data = overview?.body?.data;
  return {
    phase: PHASE,
    status,
    generatedAt,
    serviceUrl: serviceUrl ?? null,
    ui: {
      httpStatus: ui?.httpStatus ?? null,
      panelPresent: Boolean(ui?.text?.includes("phase47a-enterprise-overview-ui")),
      routePresent: Boolean(ui?.text?.includes("/enterprise/overview")),
      titlePresent: Boolean(ui?.text?.includes("Enterprise overview")),
    },
    route: {
      path: "/enterprise/overview",
      missingAuthHttpStatus: missingAuth?.httpStatus ?? null,
      authorizedHttpStatus: overview?.httpStatus ?? null,
      mode: data?.mode ?? null,
      status: data?.status ?? null,
      blockerCount: data?.blockers?.length ?? null,
      warningCount: data?.warnings?.length ?? null,
    },
    readiness: {
      deploymentStatus: data?.readiness?.deployment?.status ?? null,
      startupStatus: data?.readiness?.startup?.status ?? null,
      securityStatus: data?.readiness?.security?.status ?? null,
      vectorMode: data?.readiness?.vector?.mode ?? null,
      vectorStatus: data?.readiness?.vector?.status ?? null,
    },
    acceptance: {
      sourcePhase: data?.acceptance?.phase ?? null,
      sourceStatus: data?.acceptance?.status ?? null,
      sourceConclusion: data?.acceptance?.conclusion ?? null,
      requiredCount: data?.acceptance?.requiredCount ?? null,
      passedCount: data?.acceptance?.passedCount ?? null,
      missingCount: data?.acceptance?.missingCount ?? null,
      failedCount: data?.acceptance?.failedCount ?? null,
    },
    releaseCandidate: {
      sourcePhase: data?.releaseCandidate?.phase ?? null,
      sourceStatus: data?.releaseCandidate?.status ?? null,
      sourceConclusion: data?.releaseCandidate?.conclusion ?? null,
      mode: data?.releaseCandidate?.mode ?? null,
      packageCreated: data?.releaseCandidate?.packageCreated ?? null,
      releaseCreated: data?.releaseCandidate?.releaseCreated ?? null,
      artifactPublished: data?.releaseCandidate?.artifactPublished ?? null,
      evidenceRequiredCount: data?.releaseCandidate?.evidenceRequiredCount ?? null,
      evidencePassedCount: data?.releaseCandidate?.evidencePassedCount ?? null,
      evidenceMissingCount: data?.releaseCandidate?.evidenceMissingCount ?? null,
      evidenceFailedCount: data?.releaseCandidate?.evidenceFailedCount ?? null,
    },
    safety: {
      readOnlyRoute: data?.safety?.readOnlyRoute ?? null,
      providerCalls: data?.safety?.providerCalls ?? null,
      runtimeMutation: data?.safety?.runtimeMutation ?? null,
      releaseAutomation: data?.safety?.releaseAutomation ?? null,
      infrastructureProvisioning: data?.safety?.infrastructureProvisioning ?? null,
      secretValuesRecorded: data?.safety?.secretValuesRecorded ?? null,
      responseContainsAuditorToken: Boolean(responseText?.includes(auditorToken)),
      responseContainsNvidiaKey: Boolean(responseText?.includes(nvidiaKey)),
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
  return `# Phase 47A Enterprise Overview UI Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- UI HTTP status: ${body.ui?.httpStatus ?? "n/a"}
- UI panel present: ${body.ui?.panelPresent}
- Route present in UI: ${body.ui?.routePresent}
- Route path: ${body.route?.path}
- Missing auth HTTP status: ${body.route?.missingAuthHttpStatus ?? "n/a"}
- Authorized HTTP status: ${body.route?.authorizedHttpStatus ?? "n/a"}
- Route mode: ${body.route?.mode ?? "n/a"}
- Overview status: ${body.route?.status ?? "n/a"}
- Blocker count: ${body.route?.blockerCount ?? "n/a"}
- Warning count: ${body.route?.warningCount ?? "n/a"}
- Deployment readiness status: ${body.readiness?.deploymentStatus ?? "n/a"}
- Startup readiness status: ${body.readiness?.startupStatus ?? "n/a"}
- Security readiness status: ${body.readiness?.securityStatus ?? "n/a"}
- Vector readiness mode: ${body.readiness?.vectorMode ?? "n/a"}
- Vector readiness status: ${body.readiness?.vectorStatus ?? "n/a"}
- Acceptance source phase: ${body.acceptance?.sourcePhase ?? "n/a"}
- Acceptance source status: ${body.acceptance?.sourceStatus ?? "n/a"}
- Acceptance evidence required: ${body.acceptance?.requiredCount ?? "n/a"}
- Acceptance evidence passed: ${body.acceptance?.passedCount ?? "n/a"}
- Acceptance evidence missing: ${body.acceptance?.missingCount ?? "n/a"}
- Acceptance evidence failed: ${body.acceptance?.failedCount ?? "n/a"}
- Release-candidate source phase: ${body.releaseCandidate?.sourcePhase ?? "n/a"}
- Release-candidate source status: ${body.releaseCandidate?.sourceStatus ?? "n/a"}
- Release-candidate mode: ${body.releaseCandidate?.mode ?? "n/a"}
- Package created: ${body.releaseCandidate?.packageCreated}
- Release created: ${body.releaseCandidate?.releaseCreated}
- Artifact published: ${body.releaseCandidate?.artifactPublished}
- Release-candidate evidence required: ${body.releaseCandidate?.evidenceRequiredCount ?? "n/a"}
- Release-candidate evidence passed: ${body.releaseCandidate?.evidencePassedCount ?? "n/a"}
- Release-candidate evidence missing: ${body.releaseCandidate?.evidenceMissingCount ?? "n/a"}
- Release-candidate evidence failed: ${body.releaseCandidate?.evidenceFailedCount ?? "n/a"}
- Read-only route: ${body.safety?.readOnlyRoute}
- Provider calls: ${body.safety?.providerCalls}
- Runtime mutation: ${body.safety?.runtimeMutation}
- Release automation: ${body.safety?.releaseAutomation}
- Infrastructure provisioning: ${body.safety?.infrastructureProvisioning}
- Secret values recorded: ${body.safety?.secretValuesRecorded}
- Response contains auditor token: ${body.safety?.responseContainsAuditorToken}
- Response contains NVIDIA key: ${body.safety?.responseContainsNvidiaKey}
- Conclusion: ${body.conclusion}
`;
}
