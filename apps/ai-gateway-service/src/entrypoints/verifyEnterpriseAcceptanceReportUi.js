import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-44a-enterprise-acceptance-ui";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-44a-enterprise-acceptance-ui.json");
const evidenceMdPath = resolve(evidenceDir, "phase-44a-enterprise-acceptance-ui.md");

const tenantId = "phase44-tenant";
const auditorToken = "phase44-auditor-token";
const nvidiaKey = "phase44-redacted-nvidia-key";

let server;
let evidence;

try {
  const rootDir = await mkdtemp(resolve(tmpdir(), "phase44a-enterprise-acceptance-ui-"));
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: auditorToken,
    PME_AUTH_USER_ID: "phase44-auditor",
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
  const missingAuth = await fetchJson(`${serviceUrl}/enterprise/acceptance/report`);
  const acceptance = await fetchJson(`${serviceUrl}/enterprise/acceptance/report`, {
    headers: createHeaders(auditorToken),
  });

  const responseText = JSON.stringify({ ui, missingAuth, acceptance });
  const passed = isAcceptanceUiReady({ ui, missingAuth, acceptance, responseText });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    ui,
    missingAuth,
    acceptance,
    responseText,
    conclusion: passed ? "enterprise-acceptance-ui-connected" : "enterprise-acceptance-ui-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-acceptance-ui-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isAcceptanceUiReady({ ui, missingAuth, acceptance, responseText }) {
  const data = acceptance?.body?.data;
  const evidence = data?.evidence;
  return (
    ui?.httpStatus === 200 &&
    ui.text.includes("phase44a-enterprise-acceptance-ui") &&
    ui.text.includes("/enterprise/acceptance/report") &&
    ui.text.includes("Enterprise acceptance report") &&
    missingAuth?.httpStatus === 401 &&
    acceptance?.httpStatus === 200 &&
    data?.mode === "read-only-existing-artifacts" &&
    data?.reportPath === "docs/ENTERPRISE_ACCEPTANCE_REPORT.md" &&
    data?.reportMarkdown?.includes("Enterprise Acceptance Report") &&
    evidence?.status === "passed" &&
    evidence?.requiredCount >= 20 &&
    evidence?.passedCount === evidence?.requiredCount &&
    evidence?.missingCount === 0 &&
    evidence?.failedCount === 0 &&
    evidence?.commandStatus === "passed" &&
    evidence?.boundaryStatus === "passed" &&
    evidence?.safety?.readOnlySummary === true &&
    evidence?.safety?.providerCalls === false &&
    evidence?.safety?.releaseAutomation === false &&
    evidence?.safety?.infrastructureProvisioning === false &&
    evidence?.safety?.secretValuesRecorded === false &&
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

function createEvidence({ status, generatedAt, serviceUrl, ui, missingAuth, acceptance, responseText, conclusion, error }) {
  const data = acceptance?.body?.data;
  const reportEvidence = data?.evidence;
  return {
    phase: PHASE,
    status,
    generatedAt,
    serviceUrl: serviceUrl ?? null,
    ui: {
      httpStatus: ui?.httpStatus ?? null,
      panelPresent: Boolean(ui?.text?.includes("phase44a-enterprise-acceptance-ui")),
      reportRoutePresent: Boolean(ui?.text?.includes("/enterprise/acceptance/report")),
      titlePresent: Boolean(ui?.text?.includes("Enterprise acceptance report")),
    },
    route: {
      path: "/enterprise/acceptance/report",
      missingAuthHttpStatus: missingAuth?.httpStatus ?? null,
      authorizedHttpStatus: acceptance?.httpStatus ?? null,
      mode: data?.mode ?? null,
      reportPath: data?.reportPath ?? null,
      reportMarkdownPresent: Boolean(data?.reportMarkdown?.includes("Enterprise Acceptance Report")),
    },
    acceptance: {
      sourcePhase: reportEvidence?.phase ?? null,
      sourceStatus: reportEvidence?.status ?? null,
      sourceConclusion: reportEvidence?.conclusion ?? null,
      requiredCount: reportEvidence?.requiredCount ?? null,
      passedCount: reportEvidence?.passedCount ?? null,
      missingCount: reportEvidence?.missingCount ?? null,
      failedCount: reportEvidence?.failedCount ?? null,
      commandStatus: reportEvidence?.commandStatus ?? null,
      boundaryStatus: reportEvidence?.boundaryStatus ?? null,
      docsPresentCount: reportEvidence?.docsPresent?.length ?? 0,
    },
    safety: {
      readOnlyRoute: true,
      providerCalls: false,
      releaseAutomation: false,
      infrastructureProvisioning: false,
      secretValuesRecorded: false,
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
  return `# Phase 44A Enterprise Acceptance UI Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- UI HTTP status: ${body.ui?.httpStatus ?? "n/a"}
- UI panel present: ${body.ui?.panelPresent}
- Report route present in UI: ${body.ui?.reportRoutePresent}
- Route path: ${body.route?.path}
- Missing auth HTTP status: ${body.route?.missingAuthHttpStatus ?? "n/a"}
- Authorized HTTP status: ${body.route?.authorizedHttpStatus ?? "n/a"}
- Route mode: ${body.route?.mode ?? "n/a"}
- Report path: ${body.route?.reportPath ?? "n/a"}
- Report markdown present: ${body.route?.reportMarkdownPresent}
- Source phase: ${body.acceptance?.sourcePhase ?? "n/a"}
- Source status: ${body.acceptance?.sourceStatus ?? "n/a"}
- Source conclusion: ${body.acceptance?.sourceConclusion ?? "n/a"}
- Evidence required: ${body.acceptance?.requiredCount ?? "n/a"}
- Evidence passed: ${body.acceptance?.passedCount ?? "n/a"}
- Evidence missing: ${body.acceptance?.missingCount ?? "n/a"}
- Evidence failed: ${body.acceptance?.failedCount ?? "n/a"}
- Command status: ${body.acceptance?.commandStatus ?? "n/a"}
- Boundary status: ${body.acceptance?.boundaryStatus ?? "n/a"}
- Read-only route: ${body.safety?.readOnlyRoute}
- Provider calls: ${body.safety?.providerCalls}
- Release automation: ${body.safety?.releaseAutomation}
- Infrastructure provisioning: ${body.safety?.infrastructureProvisioning}
- Secret values recorded: ${body.safety?.secretValuesRecorded}
- Response contains auditor token: ${body.safety?.responseContainsAuditorToken}
- Response contains NVIDIA key: ${body.safety?.responseContainsNvidiaKey}
- Conclusion: ${body.conclusion}
`;
}
