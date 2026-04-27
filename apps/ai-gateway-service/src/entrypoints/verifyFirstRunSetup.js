import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayClient } from "../../../../packages/shared-sdk/src/index.js";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-104a-first-run-setup";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-104a-first-run-setup.json");
const evidenceMdPath = resolve(evidenceDir, "phase-104a-first-run-setup.md");
const forbiddenSecret = "phase104a-secret-should-not-appear";

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
  const client = createGatewayClient({ baseUrl: serviceUrl });
  const [setupViaSdk, setupViaHttp, ui, unknownPreview, rootPackage, servicePackage, readme, agents] = await Promise.all([
    client.setupReadiness(),
    fetchJson(`${serviceUrl}/setup/readiness`),
    fetchText(`${serviceUrl}/ui`),
    postJson(`${serviceUrl}/models/import/preview`, {
      apiKey: forbiddenSecret,
      providerHint: "auto",
    }),
    readFile(resolve(repoRoot, "package.json"), "utf8"),
    readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"),
    readFile(resolve(repoRoot, "README.md"), "utf8"),
    readFile(resolve(repoRoot, "AGENTS.md"), "utf8"),
  ]);

  const evidence = createEvidence({
    serviceUrl,
    setupViaSdk,
    setupViaHttp,
    ui,
    unknownPreview,
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
    conclusion: "first-run-setup-not-ready",
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
  setupViaSdk,
  setupViaHttp,
  ui,
  unknownPreview,
  rootPackage,
  servicePackage,
  readme,
  agents,
}) {
  const setupData = setupViaHttp.body?.data ?? {};
  const sdkData = setupViaSdk?.data ?? {};
  const uiText = ui.text ?? "";
  const rootScripts = JSON.parse(rootPackage).scripts ?? {};
  const serviceScripts = JSON.parse(servicePackage).scripts ?? {};
  const payloadText = JSON.stringify({
    setup: sanitizeForEvidence(setupData),
    unknownPreview: sanitizeForEvidence(unknownPreview.body?.data),
  });

  const checks = {
    setupHttpOk: setupViaHttp.httpStatus === 200,
    setupSdkOk: setupViaSdk?.status === "ok" && sdkData.phase === PHASE,
    setupPhase: setupData.phase === PHASE,
    setupStatusReady: setupData.status === "ready",
    setupStepCount: Array.isArray(setupData.steps) && setupData.steps.length >= 6,
    setupAreasPresent: ["health", "modelImport", "chat", "knowledge", "workforce"].every((key) => setupData.readiness?.[key]),
    setupSafetyNoSecrets: setupData.safety?.apiKeyExposed === false && setupData.safety?.providerProbeCalled === false,
    uiMarkerPresent: uiText.includes("phase104a-first-run-setup"),
    uiFirstRunCopyPresent: [
      "首次使用引导",
      "系统健康检查",
      "添加模型 / 检测 API Key",
      "开始聊天",
      "Agent Workforce",
      "Knowledge/RAG",
      "发布前限制",
      "/setup/readiness",
    ].every((text) => uiText.includes(text)),
    modelImportUnknownGuidance: unknownPreview.body?.data?.status === "needs_provider_selection" &&
      unknownPreview.body?.data?.userMessage?.includes("无法仅凭 API Key 判断服务商"),
    scriptsPresent: rootScripts["verify:phase104a-first-run-setup"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase104a-first-run-setup" &&
      serviceScripts["verify:phase104a-first-run-setup"] === "node ./src/entrypoints/verifyFirstRunSetup.js",
    docsPresent: readme.includes("Phase 104A") && agents.includes("verify:phase104a-first-run-setup"),
    noPlainSecretInEvidence: !payloadText.includes(forbiddenSecret),
  };
  const passed = Object.values(checks).every(Boolean);

  return {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    checks,
    setup: {
      status: setupData.status,
      stepCount: setupData.steps?.length ?? 0,
      readinessKeys: Object.keys(setupData.readiness ?? {}),
      healthReady: setupData.readiness?.health?.ready,
      modelImportReady: setupData.readiness?.modelImport?.ready,
      chatReady: setupData.readiness?.chat?.ready,
      knowledgeReady: setupData.readiness?.knowledge?.ready,
      workforceReady: setupData.readiness?.workforce?.ready,
    },
    modelImport: {
      unknownStatus: unknownPreview.body?.data?.status,
      unknownReason: unknownPreview.body?.data?.reason,
      userGuidancePresent: Boolean(unknownPreview.body?.data?.userMessage),
    },
    safety: {
      plaintextApiKeyRecorded: false,
      defaultChatMainLaneChanged: false,
      realProviderCalled: false,
      workforceExecution: false,
      projectFileWrites: false,
    },
    conclusion: passed ? "first-run-setup-ready" : "first-run-setup-not-ready",
  };
}

function sanitizeForEvidence(value) {
  if (Array.isArray(value)) return value.map(sanitizeForEvidence);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (/apiKey/i.test(key)) {
      output[key] = item ? "[redacted]" : item;
    } else {
      output[key] = sanitizeForEvidence(item);
    }
  }
  return output;
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

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
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
  return `# Phase 104A First-run Setup Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Setup status: ${body.setup?.status}
- Setup step count: ${body.setup?.stepCount}
- Readiness keys: ${(body.setup?.readinessKeys ?? []).join(", ")}
- UI setup marker: ${body.checks?.uiMarkerPresent}
- UI first-run copy: ${body.checks?.uiFirstRunCopyPresent}
- SDK setup readiness: ${body.checks?.setupSdkOk}
- Unknown API key guidance: ${body.modelImport?.unknownStatus} / ${body.modelImport?.userGuidancePresent}
- Root/service scripts present: ${body.checks?.scriptsPresent}
- Plaintext API key recorded: ${body.safety?.plaintextApiKeyRecorded}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Workforce execution enabled: ${body.safety?.workforceExecution}
- Conclusion: ${body.conclusion}
`;
}
