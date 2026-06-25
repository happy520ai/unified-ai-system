import { mkdir, readFile, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, listen, close } from "./entrypointUtils.js";

const PHASE = "phase-102e-agent-workforce-user-guide";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-102e-agent-workforce-user-guide.json");
const evidenceMdPath = resolve(evidenceDir, "phase-102e-agent-workforce-user-guide.md");

let server;

try {
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");

  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const [health, agents, ui, readme, agentsDoc, packageJson] = await Promise.all([
    fetchJson(`${serviceUrl}/workforce/health`),
    fetchJson(`${serviceUrl}/workforce/agents`),
    fetchText(`${serviceUrl}/ui`),
    readFile(resolve(repoRoot, "README.md"), "utf8"),
    readFile(resolve(repoRoot, "AGENTS.md"), "utf8"),
    readFile(resolve(repoRoot, "package.json"), "utf8"),
  ]);

  const passed = isUserGuideClosed({
    health,
    agents,
    ui,
    readme,
    agentsDoc,
    packageJson,
  });
  const evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    health,
    agents,
    ui,
    readme,
    agentsDoc,
    packageJson,
    conclusion: passed ? "agent-workforce-user-guide-closed" : "agent-workforce-user-guide-not-closed",
  });

  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  const evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "agent-workforce-user-guide-not-closed",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isUserGuideClosed({ health, agents, ui, readme, agentsDoc, packageJson }) {
  const uiText = ui?.text ?? "";
  const packageScripts = JSON.parse(packageJson).scripts ?? {};

  return (
    health?.httpStatus === 200 &&
    health?.body?.data?.status === "ready" &&
    health?.body?.data?.safety?.realLlmCalls === false &&
    agents?.httpStatus === 200 &&
    agents?.body?.data?.agents?.length === 7 &&
    ui?.httpStatus === 200 &&
    uiText.includes("phase102e-workforce-user-guide") &&
    uiText.includes("当前是 AI 团队计划预览") &&
    uiText.includes("不是自动执行器") &&
    uiText.includes("需求拆解") &&
    uiText.includes("团队分工") &&
    uiText.includes("任务规划") &&
    uiText.includes("不会自动执行代码") &&
    uiText.includes("不会修改文件") &&
    uiText.includes("后续安全执行主线") &&
    readme.includes("Phase 102E") &&
    readme.includes("verify:phase102e-workforce-user-guide") &&
    readme.includes("requirement decomposition") &&
    readme.includes("does not call real LLMs") &&
    readme.includes("run 144 staff") &&
    readme.includes("workflow runs") &&
    agentsDoc.includes("verify:phase102e-workforce-user-guide") &&
    agentsDoc.includes("deterministic planning") &&
    agentsDoc.includes("Do not expand it into 144 staff") &&
    agentsDoc.includes("workflow runs") &&
    packageScripts["verify:phase102e-workforce-user-guide"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase102e-workforce-user-guide"
  );
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  health,
  agents,
  ui,
  readme,
  agentsDoc,
  packageJson,
  conclusion,
  error,
}) {
  const uiText = ui?.text ?? "";
  const packageScripts = packageJson ? JSON.parse(packageJson).scripts ?? {} : {};

  return {
    phase: PHASE,
    status,
    generatedAt,
    service: {
      url: serviceUrl,
      healthHttpStatus: health?.httpStatus ?? null,
      agentsHttpStatus: agents?.httpStatus ?? null,
      agentCount: agents?.body?.data?.agents?.length ?? null,
    },
    ui: {
      httpStatus: ui?.httpStatus ?? null,
      phaseMarkerPresent: uiText.includes("phase102e-workforce-user-guide"),
      previewWordingPresent: uiText.includes("当前是 AI 团队计划预览"),
      notExecutorWordingPresent: uiText.includes("不是自动执行器"),
      noCodeExecutionWordingPresent: uiText.includes("不会自动执行代码"),
      noFileMutationWordingPresent: uiText.includes("不会修改文件"),
      nextUseWordingPresent: uiText.includes("后续安全执行主线"),
    },
    docs: {
      readmePhasePresent: Boolean(readme?.includes("Phase 102E")),
      readmeVerifyPresent: Boolean(readme?.includes("verify:phase102e-workforce-user-guide")),
      readmeBoundaryPresent: Boolean(readme?.includes("does not call real LLMs") && readme?.includes("run 144 staff")),
      agentsVerifyPresent: Boolean(agentsDoc?.includes("verify:phase102e-workforce-user-guide")),
      agentsBoundaryPresent: Boolean(agentsDoc?.includes("Do not expand it into 144 staff") && agentsDoc?.includes("workflow runs")),
    },
    scripts: {
      rootScriptPresent: packageScripts["verify:phase102e-workforce-user-guide"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase102e-workforce-user-guide",
    },
    safety: {
      realLlmCalls: Boolean(health?.body?.data?.safety?.realLlmCalls),
      codeExecution: Boolean(health?.body?.data?.safety?.codeExecution),
      projectFileWrites: Boolean(health?.body?.data?.safety?.projectFileWrites),
      workflowRun: Boolean(health?.body?.data?.safety?.workflowRun),
      defaultChatLaneMutated: false,
      providerRegistryMutated: false,
      secretValuesRecorded: false,
    },
    error: error ?? null,
    conclusion,
  };
}

