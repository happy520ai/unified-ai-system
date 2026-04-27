import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const PHASE = "phase-108a-access-boundary";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-108a-access-boundary.json");
const evidenceMdPath = resolve(evidenceDir, "phase-108a-access-boundary.md");

let server;

try {
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");

  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const [ui, setupReadiness, authStatus, enterpriseHealth, rootPackage, servicePackage, readme, agents] = await Promise.all([
    fetchText(`${serviceUrl}/ui`),
    fetchJson(`${serviceUrl}/setup/readiness`),
    fetchJson(`${serviceUrl}/auth/status`),
    fetchJson(`${serviceUrl}/enterprise/health`),
    readFile(resolve(repoRoot, "package.json"), "utf8"),
    readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"),
    readFile(resolve(repoRoot, "README.md"), "utf8"),
    readFile(resolve(repoRoot, "AGENTS.md"), "utf8"),
  ]);

  const evidence = createEvidence({
    serviceUrl,
    ui,
    setupReadiness,
    authStatus,
    enterpriseHealth,
    rootPackage,
    servicePackage,
    readme,
    agents,
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = evidence.status === "passed" ? 0 : 1;
} catch (error) {
  const evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "access-boundary-not-closed",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function createEvidence({
  serviceUrl,
  ui,
  setupReadiness,
  authStatus,
  enterpriseHealth,
  rootPackage,
  servicePackage,
  readme,
  agents,
}) {
  const uiText = ui.text ?? "";
  const rootScripts = JSON.parse(rootPackage).scripts ?? {};
  const serviceScripts = JSON.parse(servicePackage).scripts ?? {};
  const scanText = [uiText, readme, agents].join("\n\n");

  const checks = {
    uiHttpOk: ui.httpStatus === 200,
    setupReadinessOk: setupReadiness.httpStatus === 200 && setupReadiness.body?.data?.status === "ready",
    authStatusOk: authStatus.httpStatus === 200 &&
      authStatus.body?.status === "ok" &&
      authStatus.body?.data?.enterprise?.status === "ready",
    enterpriseHealthOk: enterpriseHealth.httpStatus === 200 && enterpriseHealth.body?.data?.status === "ready",
    uiBoundaryMarker: uiText.includes("phase108a-access-boundary"),
    uiBoundaryCopy: [
      "当前适合本地或内部测试",
      "不要直接暴露公网给多用户使用",
      "账号体系",
      "权限隔离",
      "密钥加密存储",
      "多租户隔离",
      "Agent Workforce 不是真实员工执行器",
      "model registry / plan store",
    ].every((text) => uiText.includes(text)),
    readmeBoundaryPresent: [
      "Phase 108A",
      "verify:phase108a-access-boundary",
      "should not be exposed",
      "auth",
      "tenant isolation",
      "encrypted secret vault",
      "rate limit",
      "audit retention",
    ].every((text) => readme.includes(text)),
    agentsBoundaryPresent: [
      "verify:phase108a-access-boundary",
      "account system complete",
      "multi-tenant complete",
      "enterprise security complete",
      "global release complete",
    ].every((text) => agents.includes(text)),
    scriptsPresent: rootScripts["verify:phase108a-access-boundary"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase108a-access-boundary" &&
      serviceScripts["verify:phase108a-access-boundary"] === "node ./src/entrypoints/verifyAccessBoundary.js",
    noPlainSecretInUiDocs: findPlainSecretFindings(scanText, "phase108a-ui-docs").length === 0,
  };
  const passed = Object.values(checks).every(Boolean);

  return {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    checks,
    accessBoundary: {
      currentUse: "local/internal testing",
      publicMultiUserDeployment: "not-ready",
      requiredBeforeProduction: [
        "real account system",
        "tenant isolation",
        "encrypted secret vault",
        "rate limit",
        "audit retention",
        "dedicated security review",
      ],
    },
    safety: {
      accountSystemCompleted: false,
      multiTenantCompleted: false,
      enterpriseSecurityCompleted: false,
      globalReleaseCompleted: false,
      defaultChatMainLaneChanged: false,
      realFallbackExecution: false,
      realAgentExecution: false,
      plaintextApiKeyRecorded: false,
    },
    conclusion: passed ? "access-boundary-closed" : "access-boundary-not-closed",
  };
}

async function fetchText(url) {
  const response = await fetch(url);
  return {
    httpStatus: response.status,
    text: await response.text(),
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  return {
    httpStatus: response.status,
    body: text ? JSON.parse(text) : {},
  };
}

function listen(server, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, host, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

function close(server) {
  return new Promise((resolveClose) => server.close(() => resolveClose()));
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 108A Access Boundary Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- UI HTTP OK: ${body.checks?.uiHttpOk}
- Setup readiness OK: ${body.checks?.setupReadinessOk}
- Auth status OK: ${body.checks?.authStatusOk}
- Enterprise health OK: ${body.checks?.enterpriseHealthOk}
- UI boundary marker: ${body.checks?.uiBoundaryMarker}
- UI boundary copy: ${body.checks?.uiBoundaryCopy}
- README boundary present: ${body.checks?.readmeBoundaryPresent}
- AGENTS boundary present: ${body.checks?.agentsBoundaryPresent}
- Scripts present: ${body.checks?.scriptsPresent}
- Plaintext API key recorded: ${body.safety?.plaintextApiKeyRecorded}
- Account system completed: ${body.safety?.accountSystemCompleted}
- Multi-tenant completed: ${body.safety?.multiTenantCompleted}
- Enterprise security completed: ${body.safety?.enterpriseSecurityCompleted}
- Global release completed: ${body.safety?.globalReleaseCompleted}
- Conclusion: ${body.conclusion}
`;
}
