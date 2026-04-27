import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-46a-enterprise-release-candidate-ui";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-46a-enterprise-release-candidate-ui.json");
const evidenceMdPath = resolve(evidenceDir, "phase-46a-enterprise-release-candidate-ui.md");

const tenantId = "phase46-tenant";
const auditorToken = "phase46-auditor-token";
const nvidiaKey = "phase46-redacted-nvidia-key";

let server;
let evidence;

try {
  const rootDir = await mkdtemp(resolve(tmpdir(), "phase46a-enterprise-release-candidate-ui-"));
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: auditorToken,
    PME_AUTH_USER_ID: "phase46-auditor",
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
  const missingAuth = await fetchJson(`${serviceUrl}/enterprise/release-candidate/dry-run`);
  const releaseCandidate = await fetchJson(`${serviceUrl}/enterprise/release-candidate/dry-run`, {
    headers: createHeaders(auditorToken),
  });

  const responseText = JSON.stringify({ ui, missingAuth, releaseCandidate });
  const passed = isReleaseCandidateUiReady({ ui, missingAuth, releaseCandidate, responseText });

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    ui,
    missingAuth,
    releaseCandidate,
    responseText,
    conclusion: passed ? "enterprise-release-candidate-ui-connected" : "enterprise-release-candidate-ui-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-release-candidate-ui-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isReleaseCandidateUiReady({ ui, missingAuth, releaseCandidate, responseText }) {
  const data = releaseCandidate?.body?.data;
  const rc = data?.releaseCandidate;
  const checks = data?.checks;
  const safety = data?.safety;
  return (
    ui?.httpStatus === 200 &&
    ui.text.includes("phase46a-enterprise-release-candidate-ui") &&
    ui.text.includes("/enterprise/release-candidate/dry-run") &&
    ui.text.includes("Enterprise release-candidate dry-run") &&
    missingAuth?.httpStatus === 401 &&
    releaseCandidate?.httpStatus === 200 &&
    data?.mode === "read-only-existing-artifacts" &&
    data?.evidencePath === "apps/ai-gateway-service/evidence/phase-45a-enterprise-release-candidate-dry-run.json" &&
    rc?.sourcePhase === "phase-45a-enterprise-release-candidate-dry-run" &&
    rc?.status === "passed" &&
    rc?.mode === "read-only-dry-run" &&
    rc?.packageCreated === false &&
    rc?.releaseCreated === false &&
    rc?.artifactPublished === false &&
    checks?.docsStatus === "passed" &&
    checks?.scriptsStatus === "passed" &&
    checks?.evidenceStatus === "passed" &&
    checks?.evidenceRequiredCount >= 20 &&
    checks?.evidencePassedCount === checks?.evidenceRequiredCount &&
    checks?.evidenceMissingCount === 0 &&
    checks?.evidenceFailedCount === 0 &&
    checks?.uiStatus === "passed" &&
    checks?.boundaryStatus === "passed" &&
    checks?.envTemplateStatus === "passed" &&
    checks?.secretScanStatus === "passed" &&
    safety?.readOnlyDryRun === true &&
    safety?.providerCalls === false &&
    safety?.runtimeMutation === false &&
    safety?.releaseAutomation === false &&
    safety?.infrastructureProvisioning === false &&
    safety?.secretValuesRecorded === false &&
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

function createEvidence({ status, generatedAt, serviceUrl, ui, missingAuth, releaseCandidate, responseText, conclusion, error }) {
  const data = releaseCandidate?.body?.data;
  return {
    phase: PHASE,
    status,
    generatedAt,
    serviceUrl: serviceUrl ?? null,
    ui: {
      httpStatus: ui?.httpStatus ?? null,
      panelPresent: Boolean(ui?.text?.includes("phase46a-enterprise-release-candidate-ui")),
      routePresent: Boolean(ui?.text?.includes("/enterprise/release-candidate/dry-run")),
      titlePresent: Boolean(ui?.text?.includes("Enterprise release-candidate dry-run")),
    },
    route: {
      path: "/enterprise/release-candidate/dry-run",
      missingAuthHttpStatus: missingAuth?.httpStatus ?? null,
      authorizedHttpStatus: releaseCandidate?.httpStatus ?? null,
      mode: data?.mode ?? null,
      evidencePath: data?.evidencePath ?? null,
    },
    releaseCandidate: {
      sourcePhase: data?.releaseCandidate?.sourcePhase ?? null,
      sourceStatus: data?.releaseCandidate?.status ?? null,
      sourceConclusion: data?.releaseCandidate?.conclusion ?? null,
      mode: data?.releaseCandidate?.mode ?? null,
      packageCreated: data?.releaseCandidate?.packageCreated ?? null,
      releaseCreated: data?.releaseCandidate?.releaseCreated ?? null,
      artifactPublished: data?.releaseCandidate?.artifactPublished ?? null,
      docsStatus: data?.checks?.docsStatus ?? null,
      scriptsStatus: data?.checks?.scriptsStatus ?? null,
      evidenceStatus: data?.checks?.evidenceStatus ?? null,
      evidenceRequiredCount: data?.checks?.evidenceRequiredCount ?? null,
      evidencePassedCount: data?.checks?.evidencePassedCount ?? null,
      evidenceMissingCount: data?.checks?.evidenceMissingCount ?? null,
      evidenceFailedCount: data?.checks?.evidenceFailedCount ?? null,
      boundaryStatus: data?.checks?.boundaryStatus ?? null,
      secretScanStatus: data?.checks?.secretScanStatus ?? null,
    },
    safety: {
      readOnlyRoute: true,
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
  return `# Phase 46A Enterprise Release Candidate UI Evidence

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
- Evidence path: ${body.route?.evidencePath ?? "n/a"}
- Source phase: ${body.releaseCandidate?.sourcePhase ?? "n/a"}
- Source status: ${body.releaseCandidate?.sourceStatus ?? "n/a"}
- Source conclusion: ${body.releaseCandidate?.sourceConclusion ?? "n/a"}
- Source mode: ${body.releaseCandidate?.mode ?? "n/a"}
- Package created: ${body.releaseCandidate?.packageCreated}
- Release created: ${body.releaseCandidate?.releaseCreated}
- Artifact published: ${body.releaseCandidate?.artifactPublished}
- Evidence required: ${body.releaseCandidate?.evidenceRequiredCount ?? "n/a"}
- Evidence passed: ${body.releaseCandidate?.evidencePassedCount ?? "n/a"}
- Evidence missing: ${body.releaseCandidate?.evidenceMissingCount ?? "n/a"}
- Evidence failed: ${body.releaseCandidate?.evidenceFailedCount ?? "n/a"}
- Docs status: ${body.releaseCandidate?.docsStatus ?? "n/a"}
- Scripts status: ${body.releaseCandidate?.scriptsStatus ?? "n/a"}
- Boundary status: ${body.releaseCandidate?.boundaryStatus ?? "n/a"}
- Secret scan status: ${body.releaseCandidate?.secretScanStatus ?? "n/a"}
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
