import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-41a-enterprise-config-wizard";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-41a-enterprise-config-wizard.json");
const evidenceMdPath = resolve(evidenceDir, "phase-41a-enterprise-config-wizard.md");

const tenantId = "phase41-tenant";
const adminToken = "phase41-admin-token";
const nvidiaKey = "phase41-redacted-nvidia-key";
const pgvectorUri = "postgresql://phase41-redacted-uri";

let server;
let evidence;

try {
  const rootDir = await mkdtemp(resolve(tmpdir(), "phase41a-enterprise-config-"));
  const application = createGatewayApplication({
    ...process.env,
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: adminToken,
    PME_AUTH_USER_ID: "phase41-admin",
    PME_AUTH_TENANT_ID: tenantId,
    PME_AUTH_ROLE: "admin",
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
    PGVECTOR_CONNECTION_STRING: pgvectorUri,
  });

  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const ui = await fetchText(`${serviceUrl}/ui`);
  const responseText = ui.text ?? "";
  const passed = isConfigWizardReady(responseText, ui);

  evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    ui,
    responseText,
    conclusion: passed ? "enterprise-config-wizard-connected" : "enterprise-config-wizard-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "enterprise-config-wizard-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isConfigWizardReady(text, ui) {
  return (
    ui?.httpStatus === 200 &&
    text.includes("phase41a-enterprise-config-wizard") &&
    text.includes("enterprise-config-input") &&
    text.includes("enterprise-config-check") &&
    text.includes("enterprise-config-clear") &&
    text.includes("checkEnterpriseConfigDraft") &&
    text.includes("parseEnterpriseEnvText") &&
    text.includes("uploaded: false") &&
    text.includes("valuesEchoed: false") &&
    text.includes("NVIDIA_API_KEY") &&
    text.includes("PME_AUTH_TOKEN") &&
    text.includes("PGVECTOR_CONNECTION_STRING") &&
    !text.includes(nvidiaKey) &&
    !text.includes(adminToken) &&
    !text.includes(pgvectorUri)
  );
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

function createEvidence({ status, generatedAt, serviceUrl, ui, responseText, conclusion, error }) {
  return {
    phase: PHASE,
    status,
    generatedAt,
    serviceUrl: serviceUrl ?? null,
    ui: {
      httpStatus: ui?.httpStatus ?? null,
      configWizardPanelPresent: Boolean(responseText?.includes("phase41a-enterprise-config-wizard")),
      configInputPresent: Boolean(responseText?.includes("enterprise-config-input")),
      configCheckButtonPresent: Boolean(responseText?.includes("enterprise-config-check")),
      configClearButtonPresent: Boolean(responseText?.includes("enterprise-config-clear")),
      localParserPresent: Boolean(responseText?.includes("parseEnterpriseEnvText")),
      localCheckerPresent: Boolean(responseText?.includes("checkEnterpriseConfigDraft")),
      requiredNvidiaKeyMarkerPresent: Boolean(responseText?.includes("NVIDIA_API_KEY")),
      requiredEnterpriseTokenMarkerPresent: Boolean(responseText?.includes("PME_AUTH_TOKEN")),
      pgvectorMarkerPresent: Boolean(responseText?.includes("PGVECTOR_CONNECTION_STRING")),
    },
    safety: {
      uploadedFalseMarkerPresent: Boolean(responseText?.includes("uploaded: false")),
      valuesEchoedFalseMarkerPresent: Boolean(responseText?.includes("valuesEchoed: false")),
      responseContainsNvidiaKey: Boolean(responseText?.includes(nvidiaKey)),
      responseContainsAdminToken: Boolean(responseText?.includes(adminToken)),
      responseContainsPgvectorUri: Boolean(responseText?.includes(pgvectorUri)),
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
  return `# Phase 41A Enterprise Config Wizard Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- UI HTTP status: ${body.ui?.httpStatus ?? "n/a"}
- Config wizard panel present: ${body.ui?.configWizardPanelPresent}
- Config input present: ${body.ui?.configInputPresent}
- Config check button present: ${body.ui?.configCheckButtonPresent}
- Config clear button present: ${body.ui?.configClearButtonPresent}
- Local parser present: ${body.ui?.localParserPresent}
- Local checker present: ${body.ui?.localCheckerPresent}
- NVIDIA key marker present: ${body.ui?.requiredNvidiaKeyMarkerPresent}
- Enterprise token marker present: ${body.ui?.requiredEnterpriseTokenMarkerPresent}
- pgvector marker present: ${body.ui?.pgvectorMarkerPresent}
- Uploaded false marker present: ${body.safety?.uploadedFalseMarkerPresent}
- Values echoed false marker present: ${body.safety?.valuesEchoedFalseMarkerPresent}
- Response contains NVIDIA key: ${body.safety?.responseContainsNvidiaKey}
- Response contains admin token: ${body.safety?.responseContainsAdminToken}
- Response contains pgvector URI: ${body.safety?.responseContainsPgvectorUri}
- Conclusion: ${body.conclusion}
`;
}
